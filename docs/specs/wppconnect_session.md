# WPPConnect - Sessão e Troubleshooting

## 📁 Paths Importantes

| Descrição | Path Local (Windows) | Path Container (Docker) |
|-----------|---------------------|-------------------------|
| **Tokens/Sessão WhatsApp** | `C:\Users\brunn\Documents\PROGRAMAÇÃO\manejo-org-app-clean\pmo_bot\tokens` | `/usr/src/wpp-server/tokens` |
| **Dados do Navegador** | `.\wppconnect-data` (montado via volume) | `/usr/src/wpp-server/userDataDir/agro_vivo` |
| **Config WPPConnect** | `.\wppconnect-server\config.json` | `/usr/src/wpp-server/config.json` |

## 🔧 Troubleshooting: Erro "Profile in use by another Chromium process"

### Causa
Quando o container Docker é reiniciado/recriado, os arquivos de lock do Chromium não são removidos corretamente, causando conflito.

### Solução Rápida (Windows PowerShell)

```powershell
# 1. Parar containers
docker-compose down

# 2. Limpar locks do Chromium
Remove-Item -Force -ErrorAction SilentlyContinue ".\wppconnect-data\SingletonLock"
Remove-Item -Force -ErrorAction SilentlyContinue ".\wppconnect-data\SingletonSocket"
Remove-Item -Force -ErrorAction SilentlyContinue ".\wppconnect-data\SingletonCookie"

# 3. Reiniciar
docker-compose up -d
```

### Solução Drástica (Perde sessão - precisa escanear QR Code novamente)

```powershell
docker-compose down
Remove-Item -Recurse -Force ".\wppconnect-data"
docker-compose up -d
```

## ⚙️ Limpeza Automática

O `Dockerfile.wppconnect` contém um script de startup que limpa automaticamente os locks:

```bash
echo "🧹 Limpando locks do Chrome..."
rm -f /usr/src/wpp-server/userDataDir/agro_vivo/SingletonLock
rm -f /usr/src/wpp-server/userDataDir/agro_vivo/SingletonSocket
rm -f /usr/src/wpp-server/userDataDir/agro_vivo/SingletonCookie
# ... e mais
```

## 🔄 Após Rebuild

Se você fizer `docker-compose up -d --build`, será necessário escanear o QR Code novamente pois o container é recriado.
