#!/usr/bin/env bash
#
# Instala os git hooks versionados deste repositorio.
#
#   bash scripts/install-git-hooks.sh
#   npm run hooks:install
#
# Funciona em Linux, macOS e Windows (Git Bash -- que vem junto com o Git for
# Windows, entao nao ha dependencia nova). NAO use PowerShell para gerar ou
# editar arquivos de config aqui: o PowerShell 5.1 grava UTF-16 e ja corrompeu
# arquivos deste repositorio antes (corrigido no commit fd86039).
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

printf '==> Apontando core.hooksPath para .githooks\n'
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

printf '    core.hooksPath = %s\n' "$(git config core.hooksPath)"

printf '\n==> Verificando gitleaks\n'
GITLEAKS=""
if [ -n "${GITLEAKS_BIN:-}" ] && [ -x "$GITLEAKS_BIN" ]; then
  GITLEAKS="$GITLEAKS_BIN"
elif command -v gitleaks >/dev/null 2>&1; then
  GITLEAKS="$(command -v gitleaks)"
elif command -v go >/dev/null 2>&1; then
  GOBIN="$(go env GOPATH)/bin"
  for c in "$GOBIN/gitleaks" "$GOBIN/gitleaks.exe"; do
    [ -x "$c" ] && GITLEAKS="$c" && break
  done
fi

if [ -z "$GITLEAKS" ]; then
  printf '    gitleaks NAO encontrado.\n\n'
  if command -v go >/dev/null 2>&1; then
    printf '    Instalando via Go (leva ~1 min na primeira vez)...\n'
    # ATENCAO: o modulo se chama zricethezav/gitleaks, nao gitleaks/gitleaks.
    # O segundo caminho falha com "version constraints conflict".
    go install github.com/zricethezav/gitleaks/v8@latest
    GOBIN="$(go env GOPATH)/bin"
    for c in "$GOBIN/gitleaks" "$GOBIN/gitleaks.exe"; do
      [ -x "$c" ] && GITLEAKS="$c" && break
    done
  else
    cat <<'MSG'
    Go nao esta disponivel. Instale o gitleaks por outra via:
      brew install gitleaks
      winget install gitleaks
      https://github.com/gitleaks/gitleaks/releases
MSG
    exit 1
  fi
fi

printf '    gitleaks: %s\n' "$GITLEAKS"

case ":$PATH:" in
  *":$(dirname "$GITLEAKS"):"*) ;;
  *)
    printf '\n    AVISO: %s nao esta no PATH.\n' "$(dirname "$GITLEAKS")"
    printf '    O hook consegue achar o binario mesmo assim (ele procura no GOPATH/bin),\n'
    printf '    mas para rodar `gitleaks` na mao adicione ao PATH:\n\n'
    printf '        export PATH="$PATH:%s"\n\n' "$(dirname "$GITLEAKS")"
    ;;
esac

printf '\n==> Teste de fumaca: um segredo falso deve ser bloqueado\n'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# Literal de alta entropia sem prefixo conhecido -- o formato exato do DT-45.
printf 'apiKey := "Zx9Kq2Wm7Rt4Yb1Nc6Vd3Fg8Hj5Ls0PaQwErTyUiOpAsDfGhJkLzXcVbNmQ"\n' > "$TMP/fake.go"  # gitleaks:allow -- literal descartavel do proprio teste, nunca autenticou nada
if "$GITLEAKS" stdin --no-banner --redact --log-level error \
     --config "$REPO_ROOT/.gitleaks.toml" --exit-code 2 < "$TMP/fake.go"; then
  printf '\n    FALHOU: o segredo de teste passou. Nao confie neste hook ainda.\n'
  printf '    Verifique se .gitleaks.toml esta integro (deve comecar com [extend]).\n'
  exit 1
else
  status=$?
  if [ "$status" -ne 2 ]; then
    printf '\n    FALHOU: gitleaks retornou %d (erro de execucao, nao deteccao).\n' "$status"
    exit 1
  fi
fi
printf '    OK -- segredo de teste detectado e bloqueado.\n'

printf '\nPronto. Todo `git commit` agora passa pelo gate de segredos.\n'
printf 'Para escanear a arvore inteira sob demanda: npm run scan:secrets\n'
