# Runbook — deploy do ai-memory (memória de longo prazo cross-agent)

> Fase 2 e 3 do plano de ecossistema de memória
> ([contexto completo na conversa de 2026-09-08]). Fase 1 (roteamento
> local: `CLAUDE.md`, `AGENTS.md`, mcpvault) já está feita e commitada.

## Pré-requisitos

- Stack principal (`pmo-bot-go` + Caddy) já rodando na VPS.
- DNS: registro `memoria.fyto.io` (ou o subdomínio que preferir) apontando
  pro IP da VPS — mesmo processo já usado para `bot.fyto.io`/`manejo.fyto.io`.
- Arquivos já commitados neste repo: `deploy/docker-compose.ai-memory.yml`,
  bloco novo em `deploy/Caddyfile`, `deploy/scripts/06-deploy-ai-memory.sh`.

## Fase 2 — Deploy na VPS

1. Puxar as mudanças na VPS:
   ```bash
   ssh deploy@<IP_DA_VPS>
   cd ~/manejo-org-app-clean
   git pull
   ```

2. Adicionar duas linhas no `.env.prod` **da VPS** (não no local, que está
   desatualizado — verifique com `grep MEMORIA .env.prod` antes):
   ```
   MEMORIA_DOMAIN=memoria.fyto.io
   AI_MEMORY_ALLOWED_HOSTS=memoria.fyto.io,localhost,127.0.0.1
   AI_MEMORY_AUTH_TOKEN=
   ```
   `AI_MEMORY_ALLOWED_HOSTS` é obrigatório — sem ele o ai-memory recusa
   qualquer requisição vinda do Caddy com `forbidden host` (defesa contra
   DNS-rebinding, não é opcional para deploy atrás de proxy reverso).
   Deixe `AI_MEMORY_AUTH_TOKEN` vazio por enquanto — o script do passo 3
   detecta que está faltando e te dá o comando pra gerar.

3. Rodar o script:
   ```bash
   bash deploy/scripts/06-deploy-ai-memory.sh
   ```
   Na primeira vez ele vai parar e pedir pra você colar o token gerado no
   `.env.prod` antes de continuar (nunca digite o token direto no
   terminal como comando — só cole dentro do arquivo com um editor). Rode
   o script de novo depois de salvar o `.env.prod`.

4. Confirmar (checklist já impresso pelo próprio script):
   ```bash
   curl -I https://memoria.fyto.io
   curl -H "Authorization: Bearer $AI_MEMORY_AUTH_TOKEN" https://memoria.fyto.io/mcp
   ```

## Fase 3 — Conectar os agentes locais

Verificado e funcionando (2026-09-08, Windows nativo, sem WSL2). Em cada
máquina:

1. Baixar `ai-memory-windows-x86_64.zip` da [release mais recente](https://github.com/akitaonrails/ai-memory/releases/latest),
   conferir o `.sha256` correspondente, e extrair. Copiar `ai-memory.exe`
   **e a pasta `hooks/` inteira** para o mesmo diretório (ex.:
   `~/.local/bin/`) — sem a pasta `hooks/` ao lado do exe, o passo 3
   falha com "could not locate hooks directory". Adicionar esse
   diretório ao PATH do usuário (persistente):
   ```powershell
   $dir = "C:\Users\<usuario>\.local\bin"
   $current = [Environment]::GetEnvironmentVariable("Path", "User")
   [Environment]::SetEnvironmentVariable("Path", "$current;$dir", "User")
   ```
   (reiniciar terminais/Claude Code depois, pra herdar o PATH novo)

2. Registrar o MCP server **no escopo global** do Claude Code
   (`~/.claude.json`, vale pra todos os projetos — não usar `.mcp.json`
   por projeto pra isso, a menos que você queira memória isolada por
   repositório):
   ```bash
   ai-memory install-mcp --client claude-code --apply --session-aware \
     --server-url "https://memoria.fyto.io/mcp" \
     --auth-token "<TOKEN_AQUI>"
   ```
   `--session-aware` registra um bridge `stdio` local (`ai-memory
   mcp-bridge`) em vez de uma URL HTTP direta — é o que permite múltiplas
   sessões concorrentes do Claude Code terem contexto de projeto
   separado. `--apply` já escreve direto em `~/.claude.json` com backup
   automático.

3. Instalar os hooks de lifecycle (captura automática — sem isso você
   precisaria chamar as ferramentas `memory_*` manualmente):
   ```bash
   ai-memory install-hooks --agent claude-code --apply \
     --server-url "https://memoria.fyto.io" \
     --auth-token "<TOKEN_AQUI>" \
     --project-strategy repo-root
   ```
   `--project-strategy repo-root` faz cada sessão resolver o projeto pela
   raiz do repo git (bom para monorepos com subpastas/worktrees, evita
   fragmentar a memória por subdiretório). Isso escreve em
   `~/.claude/settings.json` (com backup automático) usando o binário
   nativo (`ai-memory.exe hook --event ...`), sem depender dos `.ps1`.

4. Reiniciar o Claude Code pra carregar o MCP server novo. Testar com uma
   chamada real (ex.: pedir pra IA rodar `memory_status` ou
   `memory_briefing`).

5. Repetir os passos 1-3 em cada máquina (desktop, laptop). Como o
   registro é global (`~/.claude.json`), memória fica automaticamente
   compartilhada entre todos os projetos em `DEV/` que você abrir — o
   ai-memory separa por projeto internamente (nome do diretório/repo,
   não precisa reconfigurar nada por projeto).

## Notas de segurança

- O `AI_MEMORY_AUTH_TOKEN` é equivalente a uma senha de acesso total ao
  servidor de memória — trate como qualquer outro segredo de produção
  (nunca colar em terminal visível, nunca commitar).
- `ai-memory` não substitui `wiki/` (Obsidian) nem `.cartographer/`
  (grafo de código) — é uma terceira camada, memória de processo/sessão.
- Se a VPS mostrar sinais de pressão de recursos depois do deploy
  (`docker stats`), o primeiro alvo pra aliviar é o
  `AI_MEMORY_EMBEDDING_PROVIDER` (ver `.env.production.example` do
  próprio projeto) — não é este runbook que define isso, é opcional e já
  vem num modo leve por padrão na v2.0.
