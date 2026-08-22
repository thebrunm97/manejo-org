#!/usr/bin/env bash
# DT-33 / DT-37 — agrega a telemetria de LLM dos logs do container.
#
# Uso:  ./scripts/analisar_telemetria.sh [janela]
#       ./scripts/analisar_telemetria.sh 2h
#
# Responde três perguntas que só podem ser respondidas com dado de produção:
#   1. Os timeouts se concentram em quais tamanhos de payload?
#   2. Qual a distribuição real de latência?
#   3. Quais ferramentas cada intent de fato usa? (base para apertar o filtro)

set -uo pipefail

JANELA="${1:-6h}"
CONTAINER="${CONTAINER:-pmo-prod-stack-pmo-bot-go-1}"

LOGS="$(docker logs "$CONTAINER" --since "$JANELA" 2>&1)"

# Arquivo de acumulação.
#
# Recriar o contêiner (`docker compose up --build`) descarta os logs dele. Como
# a coleta do DT-33 leva dias e o serviço é reconstruído com frequência, cada
# execução deste script arquiva as linhas de telemetria vistas até aqui. A
# deduplicação por `sort -u` torna a execução repetida idempotente.
ARQUIVO="${ARQUIVO_TELEMETRIA:-$(dirname "$0")/../.telemetria_acumulada.log}"
grep -E 'event=(llm_call|llm_provider_call|llm_fallback|tool_invoked)' <<<"$LOGS" >> "$ARQUIVO" 2>/dev/null || true
if [ -f "$ARQUIVO" ]; then
  sort -u "$ARQUIVO" -o "$ARQUIVO" 2>/dev/null || true
  # A partir daqui analisa-se o HISTÓRICO acumulado, não apenas a janela atual.
  LOGS="$(cat "$ARQUIVO")
$LOGS"
fi

echo "════════════════════════════════════════════════════════"
echo " Telemetria LLM — últimas $JANELA"
echo "════════════════════════════════════════════════════════"

# O drift é medido pelo sentinela e não depende de tráfego de LLM — por isso vem
# antes de qualquer saída antecipada.
echo
echo "── Clock drift (DT-26) ──"
DRIFT="$(docker logs "${CLOCK_CONTAINER:-pmo-prod-stack-clockwork-1}" --since "$JANELA" 2>&1 \
  | grep -o 'offset:[+-][0-9.]*' | cut -d: -f2 | tail -20)"
if [ -z "$DRIFT" ]; then
  echo "  (sem leituras)"
else
  echo "$DRIFT" | awk '
    { v=$1+0; a=(v<0?-v:v); n++; s+=a; if(a>mx) mx=a }
    END{
      printf "  leituras=%d  média=%.3fs  máximo=%.3fs\n", n, s/n, mx
      if (mx > 2)
        print "  🚨 CRÍTICO: acima de 2s o WhatsApp devolve 403 nos downloads de mídia."
      else if (mx > 1)
        print "  ⚠️  ATENÇÃO: drift subindo — verifique o serviço W32Time no Windows."
      else
        print "  ✅ dentro da tolerância"
    }'
fi

CHAMADAS="$(grep -c 'event=llm_call' <<<"$LOGS" || true)"
if [ "$CHAMADAS" -eq 0 ]; then
  echo
  echo "Nenhuma chamada de LLM registrada nesta janela."
  echo "Use o bot no WhatsApp e rode de novo para popular as demais seções."
  echo "════════════════════════════════════════════════════════"
  exit 0
fi

OK="$(grep -c 'event=llm_call status=ok' <<<"$LOGS" || true)"
ERRO="$(grep -c 'event=llm_call status=erro' <<<"$LOGS" || true)"

echo
echo "── Resumo ──"
echo "  chamadas : $CHAMADAS"
echo "  sucesso  : $OK"
echo "  erro     : $ERRO"
if [ "$CHAMADAS" -gt 0 ]; then
  awk -v o="$OK" -v t="$CHAMADAS" 'BEGIN{printf "  taxa erro: %.1f%%\n", 100*(t-o)/t}'
fi

echo
echo "── Motivo das escaladas (infraestrutura vs capacidade) ──"
grep -o 'motivo_do_fallback=[a-z_]*' <<<"$LOGS" | sort | uniq -c | sort -rn | sed 's/^/  /' || echo "  (nenhuma)"

echo
echo "── Latência das chamadas bem-sucedidas (ms) ──"
grep 'event=llm_call status=ok' <<<"$LOGS" \
  | grep -o 'latency_ms=[0-9]*' | cut -d= -f2 | sort -n > /tmp/_lat.txt
if [ -s /tmp/_lat.txt ]; then
  awk '
    { a[NR] = $1; s += $1 }
    END {
      if (NR == 0) exit
      p50 = int(NR * 0.50); if (p50 < 1) p50 = 1
      p95 = int(NR * 0.95); if (p95 < 1) p95 = 1
      printf "  n=%d  média=%.0f  p50=%d  p95=%d  máx=%d\n", NR, s/NR, a[p50], a[p95], a[NR]
    }' /tmp/_lat.txt
fi

echo
echo "── Payload: sucesso vs erro (req_bytes) ──"
echo "  Se os erros se concentram nos payloads maiores, o gargalo é a carga."
for st in ok erro; do
  grep "event=llm_call status=$st" <<<"$LOGS" \
    | grep -o 'req_bytes=[0-9]*' | cut -d= -f2 \
    | awk -v s="$st" '{n++; t+=$1; if($1>m) m=$1}
        END{ if(n) printf "  %-5s n=%-4d média=%-8.0f máx=%d\n", s, n, t/n, m }'
done

echo
echo "── Ferramentas realmente usadas, por intent (DT-37) ──"
echo "  Ferramentas ofertadas mas nunca usadas são candidatas a corte."
grep -o 'event=tool_invoked intent=[A-Z_]* tool=[a-zA-Z_]*' <<<"$LOGS" \
  | sed 's/event=tool_invoked intent=//; s/ tool=/ → /' \
  | sort | uniq -c | sort -rn | sed 's/^/  /' || echo "  (nenhuma)"

echo
echo "── Ferramentas ofertadas por chamada ──"
grep -o 'ferramentas=[0-9]*' <<<"$LOGS" | cut -d= -f2 | sort -n | uniq -c \
  | awk '{printf "  %s ferramentas ofertadas em %s chamadas\n", $2, $1}'

echo
echo "════════════════════════════════════════════════════════"
