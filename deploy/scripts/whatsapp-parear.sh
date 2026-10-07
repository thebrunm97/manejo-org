#!/usr/bin/env bash
# Reconecta o WhatsApp do bot no evolution-go quando a sessão cai (ex.: log
# "Logged out for reason 401: logged out from another device").
#
# Rodar na VPS, com o celular do número do bot NA MÃO — o código expira em
# poucos minutos:
#
#   deploy/scripts/whatsapp-parear.sh            # código de pareamento (recomendado)
#   deploy/scripts/whatsapp-parear.sh --status   # só mostra se está conectado
#
# No celular do bot: WhatsApp → Configurações → Aparelhos conectados →
# Conectar aparelho → "Conectar com número de telefone" → digitar o código.
#
# Lê a URL e as chaves do .env.prod sem imprimi-las.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_DIR/.env.prod"
API="http://127.0.0.1:8082" # porta do evolution-go, só em localhost (DT-125)

valor() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"; }

TOKEN="$(valor EVOLUTION_API_KEY)"
TELEFONE="${BOT_PHONE:-553497202727}" # número do bot, só dígitos, com DDI

[ -n "$TOKEN" ] || { echo "EVOLUTION_API_KEY ausente em $ENV_FILE"; exit 1; }

status() {
  curl -fsS "$API/instance/status" -H "apikey: $TOKEN" \
    | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print('Conectado:', d.get('Connected'), '| Logado:', d.get('LoggedIn'))"
}

if [ "${1:-}" = "--status" ]; then
  status
  exit 0
fi

echo "Estado atual:"; status || true
echo
# Depois de um logout o cliente interno fica com o websocket morto, mas o
# evolution-go o considera "já rodando": o /instance/connect não o recria e o
# /instance/pair falha calado (engole o erro e devolve código vazio).
# Reiniciar o container cria um cliente novo, pronto para parear. Só roda
# quando a sessão já está deslogada — não derruba uma sessão ativa.
if status 2>/dev/null | grep -q "Logado: False"; then
  echo "Sessão deslogada — reiniciando o evolution-go para abrir um cliente novo..."
  docker restart pmo-prod-stack-evolution-go-1 >/dev/null
  sleep 20
fi

# Webhook e eventos iguais aos que o bot configura sozinho a cada minuto.
echo "Abrindo conexão com o WhatsApp..."
curl -fsS -X POST "$API/instance/connect" -H "apikey: $TOKEN" -H "Content-Type: application/json" \
  -d '{"webhookUrl":"http://pmo-bot-go:8080/webhook/evolution","subscribe":["MESSAGE","SEND_MESSAGE","CONNECTION","QRCODE"]}' >/dev/null
sleep 5

echo "Gerando código de pareamento para +$TELEFONE..."
curl -fsS -X POST "$API/instance/pair" -H "apikey: $TOKEN" -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TELEFONE\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print('\nCÓDIGO:', d.get('PairingCode') or d)"
echo
echo "Digite o código no celular do bot em até ~2 minutos (se expirar, rode de novo)."
echo "Depois confira com: $0 --status"
