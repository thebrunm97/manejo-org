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

echo "✅ Locks removidos. Iniciando servidor..."
cd /usr/src/wpp-server
exec node -r /usr/src/wpp-server/patches/wppconnect-patch.js /usr/src/wpp-server/dist/server.js
