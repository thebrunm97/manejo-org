#!/usr/bin/env bash
# Deploy automático da VPS (DT-128) — modelo "pull", rodado pelo cron do
# usuário de deploy a cada 5 min. Não precisa de chave SSH nem secret no
# GitHub: a VPS é quem busca o origin/main.
#
# Fluxo a cada execução:
#   1. git fetch; se origin/main não mudou desde o último deploy, sai.
#   2. Portões (qualquer um falhando = não faz nada, só registra no log):
#      - working tree limpo (arquivos versionados), na branch main, e HEAD
#        ancestral do origin/main (fast-forward possível) — nunca atropela
#        trabalho em andamento no diretório de produção;
#      - workflow "Tests & Coverage" verde no GitHub para o commit;
#      - se o backend mudou: `go test ./internal/...` num worktree separado.
#   3. Fast-forward, build só dos serviços afetados, `up -d --no-deps`.
#   4. Health check (container rodando, sem restart, sem panic nos logs; o
#      frontend precisa responder 200). Falhou → volta a imagem anterior
#      (tag :pre-auto-deploy) e marca o commit como falho, sem retentar.
#
# Fora do escopo automático (só avisa no log, deploy continua manual):
#   evolution-go (sessão do WhatsApp) e serviços de infra cujo compose mudou.
#
# Log: ~/.local/state/pmo-auto-deploy/deploy.log
# Instalação (uma vez): deploy/scripts/auto-deploy.sh --install-cron

set -euo pipefail

export PATH="/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
STATE_DIR="${STATE_DIR:-$HOME/.local/state/pmo-auto-deploy}"
GH_REPO="${GH_REPO:-thebrunm97/manejo-org}"
CI_WORKFLOW_NAME="${CI_WORKFLOW_NAME:-Tests & Coverage}"
COMPOSE=(docker compose --env-file .env.prod -f docker-compose.prod.yml)
PROJECT="pmo-prod-stack"

mkdir -p "$STATE_DIR"
LOG="$STATE_DIR/deploy.log"

log() { echo "$(date -u +%FT%TZ) $*" >>"$LOG"; }

if [ "${1:-}" = "--install-cron" ]; then
  linha="*/5 * * * * $REPO_DIR/deploy/scripts/auto-deploy.sh >>$STATE_DIR/cron.log 2>&1"
  (crontab -l 2>/dev/null | grep -v 'auto-deploy.sh' || true; echo "$linha") | crontab -
  git -C "$REPO_DIR" rev-parse HEAD >"$STATE_DIR/last_deployed"
  echo "cron instalado; último deploy marcado como $(cat "$STATE_DIR/last_deployed")"
  exit 0
fi

exec 9>"$STATE_DIR/lock"
flock -n 9 || exit 0

cd "$REPO_DIR"

# Registra um motivo de "não fiz deploy" só uma vez por commit, pra o log
# não crescer a cada 5 min enquanto a situação persiste.
skip() {
  local marca="$alvo $1"
  if [ "$(cat "$STATE_DIR/last_skip" 2>/dev/null)" != "$marca" ]; then
    log "SKIP ${alvo:0:7}: $1"
    echo "$marca" >"$STATE_DIR/last_skip"
  fi
  exit 0
}

git fetch -q origin main
alvo="$(git rev-parse origin/main)"
ultimo="$(cat "$STATE_DIR/last_deployed" 2>/dev/null || true)"
[ -n "$ultimo" ] || { log "ERRO: $STATE_DIR/last_deployed ausente — rode --install-cron"; exit 1; }
[ "$alvo" != "$ultimo" ] || exit 0
[ "$alvo" != "$(cat "$STATE_DIR/failed" 2>/dev/null)" ] || exit 0

# --- Portões -----------------------------------------------------------------

[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || skip "diretório de produção fora da branch main"
[ -z "$(git status --porcelain --untracked-files=no)" ] || skip "há alterações não commitadas no diretório de produção"
git merge-base --is-ancestor HEAD "$alvo" || skip "HEAD local tem commits que não estão no origin/main"

ci="$(curl -fsS "https://api.github.com/repos/$GH_REPO/actions/runs?head_sha=$alvo&per_page=50" |
  python3 -c "
import sys, json
runs = [r for r in json.load(sys.stdin).get('workflow_runs', []) if r['name'] == sys.argv[1]]
if not runs: print('ausente')
elif runs[0]['status'] != 'completed': print('pendente')
else: print(runs[0]['conclusion'])
" "$CI_WORKFLOW_NAME")" || { log "AVISO: falha ao consultar a API do GitHub"; exit 0; }

case "$ci" in
  success) ;;
  pendente|ausente) exit 0 ;; # tenta de novo no próximo ciclo
  *) log "SKIP ${alvo:0:7}: CI '$CI_WORKFLOW_NAME' = $ci"; echo "$alvo" >"$STATE_DIR/failed"; exit 0 ;;
esac

mudou="$(git diff --name-only "$ultimo" "$alvo")"
tem() { grep -E "$1" <<<"$mudou" | grep -vE '(\.md$|/docs/)' | grep -q .; }

servicos=()
tem '^pmo-bot-go/' && servicos+=(pmo-bot-go)
tem '^pmo-frontend/' && servicos+=(pmo-frontend)
recarregar_caddy=false
tem '^deploy/Caddyfile$' && recarregar_caddy=true
tem '^evolution-go-source/' && log "AVISO ${alvo:0:7}: evolution-go mudou — deploy dele continua MANUAL (sessão do WhatsApp)"
tem '^docker-compose\.prod\.yml$' && log "AVISO ${alvo:0:7}: docker-compose.prod.yml mudou — serviços de infra não são recriados automaticamente"

if printf '%s\n' "${servicos[@]}" | grep -qx pmo-bot-go; then
  wt="$STATE_DIR/worktree"
  git worktree remove --force "$wt" 2>/dev/null || true
  git worktree add -q --detach "$wt" "$alvo"
  if ! (cd "$wt/pmo-bot-go" && timeout 600 go test ./internal/... >"$STATE_DIR/go-test.log" 2>&1); then
    git worktree remove --force "$wt"
    log "FALHA ${alvo:0:7}: go test ./internal/... falhou (ver $STATE_DIR/go-test.log) — nada foi alterado"
    echo "$alvo" >"$STATE_DIR/failed"
    exit 1
  fi
  git worktree remove --force "$wt"
fi

# --- Deploy ------------------------------------------------------------------

git merge -q --ff-only "$alvo"

if [ ${#servicos[@]} -eq 0 ] && ! $recarregar_caddy; then
  echo "$alvo" >"$STATE_DIR/last_deployed"
  log "OK ${alvo:0:7}: nada implantável mudou (só docs/migrations/etc.)"
  exit 0
fi

log "INICIO ${alvo:0:7}: serviços=[${servicos[*]}] caddy=$recarregar_caddy"

for s in "${servicos[@]}"; do
  docker tag "$PROJECT-$s:latest" "$PROJECT-$s:pre-auto-deploy"
done

if [ ${#servicos[@]} -gt 0 ]; then
  if ! "${COMPOSE[@]}" build "${servicos[@]}" >"$STATE_DIR/build.log" 2>&1; then
    log "FALHA ${alvo:0:7}: build falhou (ver $STATE_DIR/build.log) — produção intacta"
    echo "$alvo" >"$STATE_DIR/failed"
    exit 1
  fi
  "${COMPOSE[@]}" up -d --no-deps "${servicos[@]}" >>"$STATE_DIR/build.log" 2>&1
fi

saudavel() {
  local s="$1" c="$PROJECT-$1-1"
  [ "$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null)" = running ] || return 1
  [ "$(docker inspect -f '{{.RestartCount}}' "$c")" = 0 ] || return 1
  if docker logs --since 5m "$c" 2>&1 | grep -qE '^panic:|fatal error:'; then return 1; fi
  if [ "$s" = pmo-frontend ]; then
    docker exec "$c" wget -q -O /dev/null http://localhost/ || return 1
  fi
}

falhos=()
if [ ${#servicos[@]} -gt 0 ]; then
  sleep 45
  for s in "${servicos[@]}"; do saudavel "$s" || falhos+=("$s"); done
  if [ ${#falhos[@]} -eq 0 ]; then
    sleep 45
    for s in "${servicos[@]}"; do saudavel "$s" || falhos+=("$s"); done
  fi
fi

if [ ${#falhos[@]} -gt 0 ]; then
  for s in "${servicos[@]}"; do
    docker tag "$PROJECT-$s:latest" "$PROJECT-$s:falhou-auto-deploy"
    docker tag "$PROJECT-$s:pre-auto-deploy" "$PROJECT-$s:latest"
  done
  "${COMPOSE[@]}" up -d --no-deps "${servicos[@]}" >>"$STATE_DIR/build.log" 2>&1
  log "ROLLBACK ${alvo:0:7}: health check falhou em [${falhos[*]}] — imagens anteriores restauradas (a quebrada ficou em :falhou-auto-deploy)"
  echo "$alvo" >"$STATE_DIR/failed"
  exit 1
fi

# O git troca o arquivo por rename (inode novo) e o bind mount de arquivo
# continua vendo o antigo — por isso restart do container, não `caddy reload`.
if $recarregar_caddy; then
  if docker run --rm --env-file .env.prod -v "$REPO_DIR/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine \
       caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >"$STATE_DIR/caddy-validate.log" 2>&1; then
    "${COMPOSE[@]}" restart caddy >/dev/null 2>&1 || log "AVISO ${alvo:0:7}: restart do caddy falhou"
  else
    log "AVISO ${alvo:0:7}: deploy/Caddyfile inválido — Caddy NÃO reiniciado (ver $STATE_DIR/caddy-validate.log)"
  fi
fi

echo "$alvo" >"$STATE_DIR/last_deployed"
log "OK ${alvo:0:7}: deploy concluído [${servicos[*]}]"
