#!/bin/bash
set -e

echo "🩹 Iniciando recuperação de conexão..."

# 1. Parar apenas bot
echo "1️⃣ Parando pmo-bot..."
docker-compose stop pmo-bot

# 2. Limpar locks do Chrome (manter tokens)
echo "2️⃣ Limpando locks do Chromium..."
docker-compose exec wppconnect rm -f \
  /usr/src/wpp-server/userDataDir/agro_vivo/SingletonLock \
  /usr/src/wpp-server/userDataDir/agro_vivo/SingletonSocket \
  /usr/src/wpp-server/userDataDir/agro_vivo/SingletonCookie

# 3. Reiniciar bot
echo "3️⃣ Reiniciando pmo-bot..."
docker-compose start pmo-bot

# 4. Aguardar 10s
echo "⏳ Aguardando inicialização..."
sleep 10

# 5. Verificar status
echo "4️⃣ Verificando conexão..."
docker-compose exec pmo-bot python scripts/check_status.py

echo ""
echo "✅ Recuperação concluída!"
echo "📋 Se mostrou 'CONNECTED', está tudo OK"
echo "📋 Se mostrou QR Code, escaneie novamente"
