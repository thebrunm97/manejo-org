#!/usr/bin/env bash
# Fase 4 — subir a stack na VPS SEM trafego real (sem o volume evolution_data
# ainda, ou seja: sem sessao de WhatsApp valida). Objetivo aqui é só validar
# que build/certificado/rede funcionam, antes do corte de verdade (Fase 5).
#
# Rodar na VPS, como o usuário de deploy criado na Fase 2 (grupo docker).
#
# Pré-requisitos:
#   - Fase 2 concluída (docker instalado, ufw liberando 80/443/22)
#   - DNS do SITE_DOMAIN já apontando pro IP desta VPS (Fase 3)
#   - .env.prod transferido por canal seguro (NUNCA via git/terminal em texto
#     puro — usar scp/rsync com a chave SSH já configurada) com SITE_DOMAIN e
#     ACME_EMAIL já preenchidos (ver TODOs deixados no arquivo)

set -euo pipefail

REPO_URL="${REPO_URL:?defina REPO_URL=git@github.com:... ou https://... antes de rodar}"
REPO_DIR="${REPO_DIR:-$HOME/manejo-org-app-clean}"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "==> Clonando repositorio em $REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
else
  echo "==> Repositorio já existe em $REPO_DIR, dando pull"
  git -C "$REPO_DIR" pull
fi

cd "$REPO_DIR"

if [ ! -f .env.prod ]; then
  echo "ERRO: .env.prod não encontrado em $REPO_DIR."
  echo "Transfira o arquivo antes de continuar (nunca versionado, nunca colado em texto puro no terminal):"
  echo "  scp .env.prod deploy@<IP_DA_VPS>:$REPO_DIR/.env.prod"
  exit 1
fi

if grep -q "TODO_definir" .env.prod; then
  echo "ERRO: .env.prod ainda tem placeholders TODO_definir (SITE_DOMAIN/ACME_EMAIL). Preencha antes de continuar."
  exit 1
fi

echo "==> Subindo a stack SEM o volume evolution_data (evolution-go sobe zerado, sem sessão WhatsApp)"
echo "    Isso é esperado nesta fase — só estamos validando build/TLS/rede."

docker compose --env-file .env.prod -f docker-compose.prod.yml build

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d \
  clockwork piper redis rabbitmq evolution-go pmo-bot-go caddy

echo "==> Aguardando containers estabilizarem..."
sleep 10

echo "==> Status dos containers:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "==> Checklist manual desta fase:"
echo "    [ ] Todos os containers estão 'Up' (nenhum em restart loop)?"
echo "    [ ] 'docker compose logs caddy' mostra certificado emitido com sucesso?"
echo "    [ ] curl -I https://\$SITE_DOMAIN responde (mesmo que 404/401, o importante é TLS ok)?"
echo "    [ ] 'docker compose logs pmo-bot-go' sem erro fatal de conexão (Supabase/Redis/RabbitMQ)?"
echo "    [ ] 'docker compose logs evolution-go' sobe limpo (mesmo sem sessão WhatsApp ainda)?"
echo ""
echo "Se tudo OK, a VPS está pronta pra Fase 5 (o corte de verdade)."
