#!/bin/bash
# Envia uma mensagem de texto avulsa via Evolution API — para suporte manual
# (ex.: avisar um produtor de uma ação feita direto no banco).
#
# Uso:
#   EVOLUTION_BASE_URL=... EVOLUTION_INSTANCE_NAME=... EVOLUTION_API_KEY=... \
#     ./scripts/send_manual_message.sh <telefone> "<mensagem>"
#
# Ou exporte as três variáveis a partir do seu .env antes de chamar:
#   set -a; source .env; set +a
#   ./scripts/send_manual_message.sh 554891314552 "Oi! ..."
#
# <telefone> é o número completo com DDI, só dígitos (ex.: 554891314552).

set -euo pipefail

if [ -z "${1:-}" ] || [ -z "${2:-}" ]; then
    echo "Uso: $0 <telefone> <mensagem>" >&2
    exit 1
fi

PHONE="$1"
MESSAGE="$2"

: "${EVOLUTION_BASE_URL:?defina EVOLUTION_BASE_URL (ver .env.example)}"
: "${EVOLUTION_INSTANCE_NAME:?defina EVOLUTION_INSTANCE_NAME (ver .env.example)}"
: "${EVOLUTION_API_KEY:?defina EVOLUTION_API_KEY (ver .env.example)}"

json_escape() {
    if command -v node >/dev/null 2>&1; then
        node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0, "utf8")))'
    elif command -v python >/dev/null 2>&1; then
        python -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
    else
        # Fallback simples: escapa aspas e barras invertidas, sem suporte a quebras de linha.
        printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
        return
    fi
}

curl --fail --location --request POST "$EVOLUTION_BASE_URL/send/text" \
    --header "Content-Type: application/json" \
    --header "apikey: $EVOLUTION_API_KEY" \
    --data-raw "$(printf '{"number":"%s","text":%s,"instanceName":"%s"}' \
        "$PHONE" \
        "$(printf '%s' "$MESSAGE" | json_escape)" \
        "$EVOLUTION_INSTANCE_NAME")"

echo -e "\n✅ Mensagem enviada para $PHONE"
