#!/bin/bash
set -e

echo "🧹 Realizando limpeza agressiva de locks do Chrome..."

# Caminhos definidos no docker-compose.yml
USER_DATA_DIR="/usr/src/wpp-server/userDataDir"
BROWSER_PROFILE="/tmp/browser_profile"

# Limpeza recursiva e agressiva
for DIR in "$USER_DATA_DIR" "$BROWSER_PROFILE"; do
  if [ -d "$DIR" ]; then
    echo "Limpando locks em: $DIR"
    find "$DIR" -name "Singleton*" -delete 2>/dev/null || true
    find "$DIR" -name "Lock" -delete 2>/dev/null || true
    find "$DIR" -name ".org.chromium.*" -delete 2>/dev/null || true
    find "$DIR" -name "*.lock" -delete 2>/dev/null || true
  fi
done

# Garantir que o Webhook URL está preenchido (Fallback de segurança)
export WPPCONNECT_TOKEN=${WPPCONNECT_TOKEN:-${SECRET_KEY}}
export WEBHOOK_URL=${WEBHOOK_URL:-"http://pmo-bot-go:8080/webhook/wppconnect?token=$WPPCONNECT_TOKEN"}

echo "⚙️ Injetando configuração global de Webhook..."
cat <<EOF > /usr/src/wpp-server/config.json
{
  "secretKey": "${SECRET_KEY}",
  "host": "0.0.0.0",
  "port": "${PORT:-21465}",
  "deviceName": "WppConnect",
  "poweredBy": "WPPConnect-Server",
  "startAllSession": true,
  "tokenStoreType": "file",
  "maxListeners": 15,
  "customUserDataDir": "./userDataDir/",
  "webhook": {
    "url": "${WEBHOOK_URL}",
    "autoDownload": true,
    "readMessage": true,
    "allUnreadOnStart": false,
    "listenAcks": true,
    "onPresenceChanged": true,
    "onParticipantsChanged": true,
    "onReactionMessage": true,
    "onPollResponse": true,
    "onRevokedMessage": true,
    "onLabelUpdated": true,
    "onSelfMessage": false,
    "ignore": ["status@broadcast"]
  },
  "log": {
    "level": "silly",
    "logger": ["console"]
  }
}
EOF

echo "✅ Locks removidos e configuração injetada. Iniciando servidor..."
cd /usr/src/wpp-server
exec node -r /usr/src/wpp-server/patches/wppconnect-patch.js /usr/src/wpp-server/dist/server.js
