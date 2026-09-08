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
   AI_MEMORY_AUTH_TOKEN=
   ```
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

Em cada máquina (desktop, laptop):

1. Adicionar ao `.mcp.json` do projeto (ou config equivalente do
   cliente) — **não commitar o token**, `.mcp.json` já está no
   `.gitignore` deste repo:
   ```json
   "ai-memory-remote": {
     "url": "https://memoria.fyto.io/mcp",
     "headers": { "Authorization": "Bearer <TOKEN_AQUI>" }
   }
   ```

2. Instalar os hooks locais (captura automática de sessão). Confirme o
   comando exato com `ai-memory --help` na sua máquina antes — o release
   v2.0 documenta `install-mcp`; hooks de lifecycle podem estar sob um
   subcomando diferente dependendo da versão instalada:
   ```bash
   ai-memory install-mcp --client claude-code --server https://memoria.fyto.io --auth-token <TOKEN_AQUI>
   ```

3. Repetir para outros projetos em `DEV/` se quiser memória compartilhada
   entre eles (mesmo servidor, mesmo token — o ai-memory separa por
   projeto internamente via o nome do diretório do checkout).

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
