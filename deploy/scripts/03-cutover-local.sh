#!/usr/bin/env bash
# Fase 5 (lado LOCAL) — o corte de verdade. NÃO RODAR SEM VOCÊ PRESENTE E
# ACOMPANHANDO: este script derruba o WhatsApp que está rodando agora.
#
# Rodar no computador onde a stack local está de pé hoje (Windows, dentro do
# terminal que tem acesso ao Docker Desktop — não necessariamente esta shell
# do Cowork). Requer: docker compose, rsync (ou scp), acesso SSH à VPS já
# funcionando (Fase 2 concluída) e Fase 4 já validada com sucesso.
#
# O que faz, em ordem:
#   1. Derruba a stack local (pra SQLite não ficar sendo escrito durante a cópia)
#   2. Roda checkpoint WAL manual antes de derrubar (garante que -wal/-shm
#      estão consistentes, embora copiar os três arquivos juntos já seja
#      seguro com o container parado)
#   3. Empacota evolution_data inteiro (auth.db, sqlite.db, -wal/-shm, sessão)
#   4. Guarda uma cópia local de rollback com timestamp, FORA do volume ativo
#   5. Envia o pacote pra VPS via rsync (retomável, preserva permissões)
#
# O que este script NÃO faz (de propósito — exige sua decisão/presença):
#   - Não sobe a stack na VPS (isso é o 04-cutover-vps.sh, rodado na VPS)
#   - Não reconecta o WhatsApp (isso pode pedir novo QR — acompanhe ao vivo)
#   - Não reaponta webhooks nem atualiza a env var na Vercel

set -euo pipefail

REPO_DIR="${REPO_DIR:-$(pwd)}"
VPS_HOST="${VPS_HOST:?defina VPS_HOST=usuario@ip_da_vps antes de rodar}"
VPS_REPO_DIR="${VPS_REPO_DIR:-~/manejo-org-app-clean}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/_backups}"
TS="$(date +%Y%m%d-%H%M%S)"

cd "$REPO_DIR"
mkdir -p "$BACKUP_DIR"

echo "==> ATENÇÃO: isto vai derrubar a stack local (WhatsApp incluso)."
read -p "Confirma que quer seguir com o corte agora? Digite 'sim': " CONFIRMA
[ "$CONFIRMA" = "sim" ] || { echo "Abortado."; exit 1; }

echo "==> Checkpoint manual do WAL do SQLite antes de parar (best-effort)"
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 evolution_data/sqlite.db "PRAGMA wal_checkpoint(TRUNCATE);" || echo "    (checkpoint falhou/pulado, seguimos — o container parado já garante consistência)"
  sqlite3 evolution_data/auth.db "PRAGMA wal_checkpoint(TRUNCATE);" || true
else
  echo "    sqlite3 não disponível localmente, pulando checkpoint manual (ok — parar o container basta)"
fi

echo "==> Derrubando a stack local"
docker compose --env-file .env.prod -f docker-compose.prod.yml down

echo "==> Empacotando evolution_data"
tar -czf "$BACKUP_DIR/evolution_data-$TS.tar.gz" evolution_data/

echo "==> Cópia de rollback salva em: $BACKUP_DIR/evolution_data-$TS.tar.gz"
echo "    GUARDE ESSE ARQUIVO até confirmar que a VPS está 100% estável."

echo "==> Enviando evolution_data pra VPS (rsync, retomável)"
rsync -avz --progress evolution_data/ "$VPS_HOST:$VPS_REPO_DIR/evolution_data/"

echo ""
echo "==> Feito. Próximos passos (na VPS, com você acompanhando):"
echo "    1. ssh $VPS_HOST"
echo "    2. cd $VPS_REPO_DIR && bash deploy/scripts/04-cutover-vps.sh"
echo "    3. Acompanhar os logs do evolution-go — se pedir QR novo, aí sim é"
echo "       preciso escanear (não deveria acontecer se auth.db veio íntegro,"
echo "       mas é o ponto de maior risco da migração inteira)."
echo "    4. Só depois disso: reapontar webhooks externos e atualizar a env"
echo "       var na Vercel (ver deploy/scripts/05-validate-fase6.sh)."
