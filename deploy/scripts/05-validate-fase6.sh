#!/usr/bin/env bash
# Fase 6 — validação ponta a ponta na VPS, depois do corte (Fase 5).
# Rodar NA VPS. Não derruba nada — só checa.

set -euo pipefail
REPO_DIR="${REPO_DIR:-$HOME/manejo-org-app-clean}"
cd "$REPO_DIR"

pass() { echo "  [OK] $1"; }
fail() { echo "  [FALHOU] $1"; }

echo "== 1. Containers no ar =="
docker compose -f docker-compose.prod.yml ps
echo ""

echo "== 2. TLS / Caddy =="
if [ -n "${SITE_DOMAIN:-}" ]; then
  if curl -sSI --max-time 10 "https://$SITE_DOMAIN" >/dev/null; then
    pass "https://$SITE_DOMAIN responde"
  else
    fail "https://$SITE_DOMAIN não respondeu (checar 'docker compose logs caddy')"
  fi
else
  echo "  (defina SITE_DOMAIN=seu.dominio antes de rodar pra testar TLS automaticamente)"
fi
echo ""

echo "== 3. TTS do Piper =="
if docker compose -f docker-compose.prod.yml exec -T piper wget -qO- --timeout=5 http://localhost:5000/health 2>/dev/null; then
  pass "piper respondeu no /health"
else
  echo "  (endpoint /health pode não existir nesta imagem — checar manualmente com um POST /v1/audio/speech de teste)"
fi
echo ""

echo "== 4. Fila do RabbitMQ =="
if docker compose -f docker-compose.prod.yml exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
  pass "rabbitmq respondeu ao ping"
else
  fail "rabbitmq não respondeu"
fi
echo "  Filas registradas:"
docker compose -f docker-compose.prod.yml exec -T rabbitmq rabbitmqctl list_queues 2>/dev/null || echo "  (não consegui listar — checar credenciais RABBITMQ_USER/PASSWORD)"
echo ""

echo "== 5. Clockwork (drift do relógio) =="
docker compose -f docker-compose.prod.yml logs --tail=5 clockwork
echo "  (offset deve estar próximo de 0 e estável — se estiver crescendo, investigar NTP do host antes de prosseguir)"
echo ""

echo "== 6. evolution-go conectado =="
docker compose -f docker-compose.prod.yml logs --tail=20 evolution-go | grep -iE "connected|logged in" || echo "  (não achei confirmação de conexão nos últimos logs — checar manualmente)"
echo ""

echo "== Checklist manual (não automatizável daqui) =="
echo "  [ ] Mandar uma mensagem de teste real pro número do bot e confirmar resposta"
echo "  [ ] Testar um fluxo que gere áudio (TTS Piper) ponta a ponta"
echo "  [ ] Confirmar que o frontend (Vercel) está batendo no domínio novo, não mais no ngrok"
echo "  [ ] Deixar rodando estável por pelo menos algumas horas/1 dia antes de desligar a máquina local"
