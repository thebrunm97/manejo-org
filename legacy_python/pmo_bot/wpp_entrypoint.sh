#!/bin/sh
echo "🧹 Limpando locks do Chrome..."
rm -rf /usr/src/wpp-server/userDataDir/agro_vivo/SingletonLock
rm -rf /usr/src/wpp-server/userDataDir/agro_vivo/SingletonSocket
rm -rf /usr/src/wpp-server/userDataDir/agro_vivo/SingletonCookie
echo "Locks removidos. Iniciando servidor..."
exec npm start
