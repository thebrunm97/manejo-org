#!/usr/bin/env bash
# DT-38 — mede a degradação do Piper (TTS) sob requisições simultâneas.
#
# POR QUE ESTE TESTE EXISTE
#
# A VPS contratada terá 2 vCPUs. Do pipeline inteiro, o Piper é o ÚNICO passo
# que consome CPU local de forma pesada — transcrição, LLM e envio são todos
# limitados por rede. Ou seja, a capacidade da VPS é essencialmente a
# capacidade do Piper.
#
# A medição é fiel porque o container JÁ roda com `cpus: 1.0` (confirmado:
# NanoCPUs=1000000000), exatamente o teto que teria na VPS. O que NÃO transfere
# é o resto: aqui sobram 13 vCPUs para bot/evolution/redis, enquanto na VPS
# sobraria 1. Portanto este teste mede o PISO da degradação, não o teto.
#
# Uso:
#   ./scripts/simular_carga_tts.sh          # testa 1, 2, 3 e 4 simultâneos
#   CONCORRENCIAS="1 2" ./scripts/simular_carga_tts.sh

set -uo pipefail

PIPER_URL="${PIPER_URL:-http://localhost:5000/v1/audio/speech}"
VOZ="${VOZ:-pt_BR-faber-medium}"
CONCORRENCIAS="${CONCORRENCIAS:-1 2 3 4}"

# Texto do tamanho de uma resposta real de previsão do tempo — o caso que mais
# aparece em produção e um dos mais longos que o bot gera.
TEXTO="Para hoje em Uberlandia, ceu limpo, com temperatura maxima de 28 graus Celsius e minima de 13 graus Celsius. O indice de radiacao ultravioleta esta em 7,35 e a evapotranspiracao e de 5,08 milimetros. Como os indices estao elevados, fique atento a necessidade de irrigacao das suas culturas para evitar estresse hidrico."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# O Piper roda dentro da rede do compose; se a porta não estiver publicada no
# host, o teste usa `docker exec` a partir do próprio container do bot.
usar_docker=0
if ! curl -s -o /dev/null --max-time 3 "$PIPER_URL" 2>/dev/null; then
  usar_docker=1
fi

sintetizar() {
  local idx="$1"
  local inicio fim bytes
  inicio=$(date +%s%N)

  if [ "$usar_docker" -eq 1 ]; then
    docker exec pmo-prod-stack-pmo-bot-go-1 sh -c \
      "wget -q -O /tmp/tts_$idx --header='Content-Type: application/json' \
       --post-data='{\"model\":\"$VOZ\",\"voice\":\"$VOZ\",\"input\":\"$TEXTO\",\"response_format\":\"mp3\"}' \
       http://piper:5000/v1/audio/speech && stat -c %s /tmp/tts_$idx" 2>/dev/null > "$TMP/bytes_$idx"
  else
    curl -s -o "$TMP/audio_$idx" -X POST "$PIPER_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"model\":\"$VOZ\",\"voice\":\"$VOZ\",\"input\":\"$TEXTO\",\"response_format\":\"mp3\"}" 2>/dev/null
    stat -c %s "$TMP/audio_$idx" 2>/dev/null > "$TMP/bytes_$idx"
  fi

  fim=$(date +%s%N)

  # Valida que houve SÍNTESE, não apenas resposta rápida.
  #
  # Sem esta checagem o script mede a velocidade dos erros: uma voz inexistente
  # devolve 404 em ~500ms e seria contabilizada como "47x mais rápida" que a
  # voz real. Aconteceu de fato ao testar `pt_BR-faber-low`, que não existe no
  # catálogo — o resultado parecia um ganho espetacular e era só uma falha.
  bytes=$(cat "$TMP/bytes_$idx" 2>/dev/null | tr -dc '0-9')
  if [ -z "$bytes" ] || [ "$bytes" -lt 1000 ]; then
    echo "FALHA" > "$TMP/lat_$idx"
    return
  fi

  echo $(( (fim - inicio) / 1000000 )) > "$TMP/lat_$idx"
}

echo "════════════════════════════════════════════════════════════"
echo " Capacidade do Piper (TTS) — simulação de carga  [DT-38]"
echo "════════════════════════════════════════════════════════════"
echo "  Piper limitado a 1.0 vCPU (mesmo teto da VPS)"
echo "  Texto: ${#TEXTO} caracteres (resposta típica de previsão)"
echo "  Acesso: $([ "$usar_docker" -eq 1 ] && echo 'via docker exec' || echo 'porta publicada')"
echo

printf "%-14s %10s %10s %10s %12s\n" "SIMULTÂNEOS" "min(ms)" "média(ms)" "máx(ms)" "vs 1 req"
printf "%-14s %10s %10s %10s %12s\n" "───────────" "───────" "─────────" "───────" "────────"

base_media=0
for n in $CONCORRENCIAS; do
  rm -f "$TMP"/lat_*

  for i in $(seq 1 "$n"); do
    sintetizar "$i" &
  done
  wait

  falhas=$(grep -l FALHA "$TMP"/lat_* 2>/dev/null | wc -l | tr -d ' ')
  if [ "$falhas" -gt 0 ]; then
    printf "%-14s %10s %10s %10s %12s\n" "$n" "—" "—" "—" "$falhas FALHA(S)"
    echo "   ⚠️  Voz '$VOZ' não sintetizou. Verifique se existe no catálogo do Piper."
    continue
  fi

  # shellcheck disable=SC2012
  medias=$(cat "$TMP"/lat_* 2>/dev/null | awk '
    { n++; s+=$1; if(mn==0||$1<mn) mn=$1; if($1>mx) mx=$1 }
    END{ if(n) printf "%d %d %d", mn, s/n, mx }')

  mn=$(echo "$medias" | cut -d' ' -f1)
  md=$(echo "$medias" | cut -d' ' -f2)
  mx=$(echo "$medias" | cut -d' ' -f3)

  if [ "$n" -eq 1 ] || [ "$base_media" -eq 0 ]; then
    base_media="$md"
    fator="baseline"
  else
    fator=$(awk -v a="$md" -v b="$base_media" 'BEGIN{printf "%.1fx", a/b}')
  fi

  printf "%-14s %10s %10s %10s %12s\n" "$n" "$mn" "$md" "$mx" "$fator"
done

echo
echo "Leitura: o bot roda 2 AIWorkers, então 2 é a concorrência máxima real"
echo "hoje. Valores acima disso indicam o que aconteceria se esse limite fosse"
echo "elevado — ou se a fila acumulasse."
echo "════════════════════════════════════════════════════════════"
