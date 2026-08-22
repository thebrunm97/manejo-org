#!/usr/bin/env bash
# DT-33 / DT-37 — gera tráfego sintético para popular a telemetria sem depender
# de usuários reais.
#
# Injeta mensagens direto no webhook do pmo-bot-go, no mesmo formato que o
# evolution-go usa. Todo o pipeline roda de verdade: roteador de intenção,
# orquestrador, ferramentas, guardrails e entrega.
#
# ⚠️  EFEITO COLATERAL: o bot RESPONDE de verdade pelo WhatsApp para o número
#     configurado em TELEFONE. Esse número precisa ter perfil cadastrado, senão
#     o bot rejeita antes de chamar o LLM e nada é medido.
#
# Uso:
#   ./scripts/simular_carga.sh              # corpus completo, 1 msg a cada 45s
#   ./scripts/simular_carga.sh 3            # só as 3 primeiras
#   INTERVALO=20 ./scripts/simular_carga.sh # ritmo mais rápido
#
# Depois:  ./scripts/analisar_telemetria.sh 2h

set -uo pipefail

TELEFONE="${TELEFONE:-553497317545}"
WEBHOOK="${WEBHOOK:-http://localhost:8080/webhook/evolution}"
TOKEN="${TOKEN:-ManejoOrgToken}"
INTERVALO="${INTERVALO:-45}"

# Corpus deliberadamente variado: a matriz intent × ferramenta só é útil se
# cobrir os caminhos que existem em produção. Inclui CHAT (zero ferramentas),
# que é o grupo de controle da hipótese de carga do DT-37.
MENSAGENS=(
  # ── CHAT: sem ferramentas — grupo de controle ──
  # Saudações puras ("Bom dia", "Olá") NÃO servem: são interceptadas pelo
  # greeting_guard_ultra, que responde deterministicamente sem tocar no LLM
  # (medido: 668ms, zero tokens) e portanto não geram telemetria alguma.
  "Você consegue me explicar o que você faz?"
  "Estou com dúvida sobre como usar esse sistema"
  # ── RAG: consulta externa (previsão) ──
  "Qual a previsão do tempo para hoje?"
  "Vai chover amanhã na minha propriedade?"
  "Como está a evapotranspiração essa semana?"
  # ── RAG: dúvida técnica / normativa ──
  "Posso usar calda bordalesa em tomate orgânico?"
  "O que a legislação orgânica diz sobre período de conversão?"
  "Como faço o controle de traça-do-tomateiro sem agrotóxico?"
  "Qual a distância mínima de uma lavoura convencional vizinha?"
  # ── DATABASE: escrita ──
  "Registra a colheita de 120 kg de tomate no talhão Gleba 1"
  "Anota que apliquei composto orgânico hoje na horta"
  "Registra a limpeza do galpão de hoje"
  # ── FINANCE ──
  "Quanto gastei esse mês com insumos?"
  "Registra uma venda de 300 reais de alface"
  "Me mostra o balanço financeiro do ano"
  # ── Consultas de leitura ──
  "Quais talhões eu tenho cadastrados?"
  "Quantos créditos ainda tenho?"
  # ── Ambíguo: estressa o roteador ──
  "Uberlândia, Minas Gerais"
  "Sim"
  "E sobre o milho?"
)

LIMITE="${1:-${#MENSAGENS[@]}}"

echo "════════════════════════════════════════════════════════"
echo " Simulação de carga — DT-33"
echo "════════════════════════════════════════════════════════"
echo "  destino  : $WEBHOOK"
echo "  telefone : $TELEFONE  (vai RECEBER as respostas no WhatsApp)"
echo "  mensagens: $LIMITE de ${#MENSAGENS[@]}"
echo "  intervalo: ${INTERVALO}s"
echo

for i in $(seq 0 $((LIMITE - 1))); do
  MSG="${MENSAGENS[$i]}"
  # ID único por envio: o webhook deduplica por ID em memória e descartaria
  # repetições silenciosamente, o que falsearia a contagem.
  ID="SIM$(date +%s%N | tail -c 12)$i"
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # O payload é montado em Python, e escrito como BYTES UTF-8 explícitos.
  #
  # Duas armadilhas já queimaram aqui, ambas silenciosas:
  #  1. Escapar aspas com `sed` — a expressão falhava sem alarde (stderr
  #     descartado) e os acentos viravam U+FFFD.
  #  2. Usar `print()` — no Windows o Python codifica stdout na codepage ANSI
  #     (cp1252), então "ê" saía como 0xEA em vez de 0xC3 0xAA. O JSON ficava
  #     tecnicamente válido, mas com texto corrompido, e isso chegou a poluir
  #     mensagens reais no banco antes de ser percebido.
  # sys.stdout.buffer.write ignora a locale e resolve os dois casos.
  PAYLOAD=$(MSG="$MSG" ID="$ID" TS="$TS" TELEFONE="$TELEFONE" python -c '
import json, os, sys
payload = {
    "event": "Message",
    "data": {
        "info": {
            "ID": os.environ["ID"],
            "Chat": os.environ["TELEFONE"] + "@s.whatsapp.net",
            "Sender": os.environ["TELEFONE"] + "@s.whatsapp.net",
            "IsFromMe": False,
            "Timestamp": os.environ["TS"],
            "Type": "conversation",
        },
        "message": {"conversation": os.environ["MSG"]},
    },
}
sys.stdout.buffer.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
')

  printf "[%2d/%d] %-58s " "$((i + 1))" "$LIMITE" "$(printf '%.56s' "$MSG")"

  HTTP=$(curl -s -o /tmp/_sim_resp.txt -w '%{http_code}' \
    -X POST "$WEBHOOK?token=$TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary "$PAYLOAD" 2>/dev/null)

  if [ "$HTTP" = "200" ]; then
    echo "→ $(head -c 60 /tmp/_sim_resp.txt)"
  else
    echo "→ ERRO HTTP $HTTP: $(head -c 80 /tmp/_sim_resp.txt)"
  fi

  # Espaçamento intencional: o pipeline é assíncrono (fila + workers) e
  # enfileirar tudo de uma vez mediria contenção da fila, não a latência do LLM.
  if [ "$i" -lt "$((LIMITE - 1))" ]; then
    sleep "$INTERVALO"
  fi
done

echo
echo "Envios concluídos. Aguarde o processamento e rode:"
echo "  bash scripts/analisar_telemetria.sh 2h"
echo "════════════════════════════════════════════════════════"
