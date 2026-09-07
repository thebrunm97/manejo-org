#!/usr/bin/env bash
# Fase 5 (lado VPS) — recebe o evolution_data transferido por
# 03-cutover-local.sh e sobe a stack completa, com trafego real.
#
# Rodar NA VPS, logo depois do rsync do script local ter terminado.
# Acompanhe os logs ao vivo — este é o ponto de maior risco da migração.

set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/manejo-org-app-clean}"
cd "$REPO_DIR"

if [ ! -d evolution_data ] || [ -z "$(ls -A evolution_data 2>/dev/null)" ]; then
  echo "ERRO: evolution_data vazio ou ausente. O rsync do lado local rodou?"
  exit 1
fi

echo "==> Conferindo se a stack de validação (Fase 4) está de pé"
docker compose -f docker-compose.prod.yml ps

echo "==> Recriando evolution-go e pmo-bot-go com os dados reais (evolution_data já veio pelo rsync)"
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate evolution-go pmo-bot-go

echo "==> Acompanhando logs do evolution-go por 30s (Ctrl+C não é necessário, o comando encerra sozinho)"
timeout 30 docker compose -f docker-compose.prod.yml logs -f evolution-go || true

echo ""
echo "==> Verifique acima:"
echo "    - Se aparecer 'Already logged in with JID: ...' -> sessão recuperada, SEM precisar de QR novo. ÓTIMO."
echo "    - Se pedir QR novo -> pare, chame o Bruno antes de prosseguir (reconexão manual)."
echo ""
echo "==> Status final:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "==> Se tudo certo, siga pra:"
echo "    1. Reapontar webhooks externos pro novo domínio (\$SITE_DOMAIN)"
echo "    2. Atualizar a env var correspondente na Vercel (WEBHOOK_URL ou"
echo "       equivalente que hoje aponta pro túnel ngrok/local)"
echo "    3. Rodar deploy/scripts/05-validate-fase6.sh (Fase 6)"
echo "    4. Só depois de validar tudo: desligar a stack antiga na máquina local"
echo "       (o backup em _backups/ já existe, mas só descarte depois de uns"
echo "       dias de operação estável na VPS)"
