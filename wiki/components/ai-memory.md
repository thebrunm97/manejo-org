---
title: Ai-memory (memória de longo prazo cross-agent)
type: component
related:
  - roteador-de-agentes-ia
created: 2026-09-08
updated: 2026-09-08
confidence: high
---

# Ai-memory (memória de longo prazo cross-agent)

Terceira camada de contexto do projeto, ao lado da [[roteador-de-agentes-ia|wiki de domínio]] e
do grafo de código do Cartographer: memória de processo/sessão que persiste entre
conversas e entre máquinas do mesmo usuário. Não substitui nenhuma das duas —
guarda observações de sessão, handoffs e páginas de longo prazo próprias, via
MCP `ai-memory` (`akitaonrails/ai-memory`).

Runbook completo de deploy/instalação:
[`pmo-bot-go/docs/RUNBOOK-ai-memory-setup.md`](../../pmo-bot-go/docs/RUNBOOK-ai-memory-setup.md).

## Topologia

```
Claude Code (Windows) → ai-memory.exe mcp-bridge (stdio local)
        → HTTPS + Bearer token → Caddy (memoria.fyto.io) → ai-memory:49374 (VPS)
```

- Servidor roda como container Docker na VPS Hostinger, na mesma stack do
  `pmo-bot-go` (`deploy/docker-compose.ai-memory.yml`), sem porta publicada no
  host — só o Caddy da stack principal alcança pela rede interna
  (`deploy/Caddyfile`, bloco `{$MEMORIA_DOMAIN}` → `reverse_proxy
  ai-memory:49374`).
- `AI_MEMORY_ALLOWED_HOSTS` no `.env.prod` da VPS é obrigatório — sem ele o
  servidor recusa qualquer requisição vinda do Caddy com `forbidden host`
  (defesa contra DNS-rebinding).
- Em cada máquina cliente, o binário `ai-memory.exe` + a pasta `hooks/` (ambos
  precisam estar lado a lado) ficam em `~/.local/bin`, registrados como MCP
  `stdio` no `~/.claude.json` global via `ai-memory install-mcp
  --session-aware` — o modo `--session-aware` é o que permite múltiplas
  sessões concorrentes do Claude Code terem contexto de projeto separado, em
  vez de uma URL HTTP direta compartilhada.

## Troubleshooting: MCP falhando com `CONNECTION_CLOSED`

Se o Claude Code reportar `ai-memory (CONNECTION_CLOSED)` ao listar servidores
MCP, a ordem de diagnóstico que já cobriu esse cenário (2026-09-08):

1. Container na VPS está de pé? `ssh <vps> "docker ps --filter name=ai-memory"`
   e `docker logs ai-memory --tail 50` — procurar por erros do watcher/router.
2. Roteamento HTTPS está OK? `curl -o /dev/null -w '%{http_code}' https://memoria.fyto.io/mcp`
   deve responder **401** (servidor de pé, exigindo o Bearer token — isso é
   sucesso, não falha). Um 404/timeout aponta para Caddy ou DNS.
3. O token local bate com o da VPS? Comparar o hash SHA-256 do
   `AI_MEMORY_AUTH_TOKEN` em `~/.claude.json` (campo `env` do server
   `ai-memory`) contra o do `.env.prod` na VPS, sem imprimir os dois valores
   em texto puro ao mesmo tempo.
4. O binário `ai-memory` está de fato no PATH **do processo que o Claude Code
   está rodando agora**? `Get-Command ai-memory` num PowerShell aberto por uma
   ferramenta da sessão pode dar negativo mesmo com o binário instalado e o
   PATH do usuário corrigido no registro do Windows — ver nota abaixo.

### Pegadinha recorrente: PATH atualizado não é herdado sem reiniciar o app

Instalar o `ai-memory.exe` e adicionar `~/.local/bin` ao PATH do usuário via
`[Environment]::SetEnvironmentVariable("Path", ..., "User")` **não** é
suficiente para o Claude Code enxergar o binário na mesma sessão. O processo
do aplicativo desktop herdou o PATH que existia no momento em que foi aberto;
ferramentas de shell chamadas de dentro de uma conversa nova continuam sendo
processos filhos desse mesmo processo pai, então também herdam o PATH antigo
— só iniciar uma nova conversa/sessão dentro do app **não** resolve.

A correção é fechar o Claude Code por completo (sair do processo, não só
abrir uma aba/sessão nova) e reabrir. Só assim o processo novo lê o PATH
atualizado do Windows. Vale para qualquer CLI novo instalado depois que o
Claude Code já estava aberto, não só para o `ai-memory`.

Relacionado: [[roteador-de-agentes-ia]].
