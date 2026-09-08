#!/usr/bin/env bash
# ai-memory (memoria de longo prazo cross-agent/cross-maquina) -- deploy na
# mesma VPS do pmo-bot-go, integrado ao Caddy ja existente (sem proxy
# reverso concorrente, sem porta nova publicada no host).
#
# Rodar na VPS, dentro do diretorio do repo (mesmo lugar de 02-deploy-fase4.sh),
# como o usuario de deploy (grupo docker).
#
# Pre-requisitos:
#   - Stack principal (pmo-bot-go/Caddy) ja rodando -- este script so
#     adiciona um servico novo, nao substitui nada.
#   - DNS de MEMORIA_DOMAIN ja apontando pro IP desta VPS (mesmo processo
#     ja usado para SITE_DOMAIN/FRONTEND_DOMAIN).
#   - .env.prod com MEMORIA_DOMAIN e AI_MEMORY_AUTH_TOKEN preenchidos
#     (ver instrucoes abaixo se AI_MEMORY_AUTH_TOKEN ainda nao existe).

set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/manejo-org-app-clean}"
cd "$REPO_DIR"

if [ ! -f .env.prod ]; then
  echo "ERRO: .env.prod nao encontrado em $REPO_DIR. Rode isso depois da Fase 4 (02-deploy-fase4.sh)."
  exit 1
fi

if ! grep -q "^MEMORIA_DOMAIN=" .env.prod; then
  echo "ERRO: MEMORIA_DOMAIN nao esta definido em .env.prod."
  echo "  Adicione uma linha tipo: MEMORIA_DOMAIN=memoria.fyto.io"
  exit 1
fi

if ! grep -q "^AI_MEMORY_AUTH_TOKEN=" .env.prod || grep -q "^AI_MEMORY_AUTH_TOKEN=$" .env.prod; then
  echo "AI_MEMORY_AUTH_TOKEN ainda nao esta definido em .env.prod."
  echo ""
  echo "Gerando um agora com a propria imagem do ai-memory (nao precisa instalar nada):"
  TOKEN=$(docker run --rm akitaonrails/ai-memory:latest generate-auth-token)
  echo ""
  echo "Token gerado. Adicione esta linha ao .env.prod ANTES de continuar:"
  echo "  AI_MEMORY_AUTH_TOKEN=$TOKEN"
  echo ""
  echo "Guarde esse token tambem fora da VPS (gerenciador de senhas) -- ele"
  echo "vai ser usado nos clientes MCP locais (Fase 3) e nao aparece de novo."
  exit 1
fi

echo "==> Subindo o ai-memory (mesclado ao compose principal, mesma network pmo_prod_net)"
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.ai-memory.yml up -d ai-memory

echo "==> Recarregando o Caddy para pegar o bloco novo do Caddyfile (memoria.fyto.io)"
docker compose -f docker-compose.prod.yml restart caddy

echo "==> Aguardando o ai-memory ficar saudavel..."
sleep 5
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.ai-memory.yml ps ai-memory

echo ""
echo "==> Checklist manual desta fase:"
echo "    [ ] 'docker compose logs ai-memory' sem erro fatal?"
echo "    [ ] curl -I https://\$MEMORIA_DOMAIN responde com TLS ok (mesmo que 401 sem token)?"
echo "    [ ] curl -H \"Authorization: Bearer \$AI_MEMORY_AUTH_TOKEN\" https://\$MEMORIA_DOMAIN/mcp responde (nao 401)?"
echo ""
echo "Se tudo OK, a VPS esta pronta para a Fase 3 (conectar os agentes locais)."
