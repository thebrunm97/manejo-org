# Git Atomic Commits Plan

## Goal
Organizar e realizar múltiplos commits atômicos, limpando e selecionando apenas o código da aplicação e banco de dados, enquanto exclui scripts, arquivos sensíveis e alterações do frontend.

## Tasks
- [x] Task 1: Ajustar `.gitignore` para corrigir o espaçamento de `evolution_data/` e incluir quaisquer novas exclusões se necessário → Verify: `git diff .gitignore` mostra apenas a correção.
- [x] Task 2: Executar testes atuais do Go em `pmo-bot-go` para garantir estabilidade antes do commit → Verify: `go test ./...` retorna sucesso.
- [x] Task 3: Criar Commit 1 (DB/Migração) adicionando arquivos de migração e dedup → Verify: `git show --stat` do commit correspondente.
- [x] Task 4: Criar Commit 2 (Worker/Fila) adicionando webhook handler, FSM, orchestrator e cliente Gemini → Verify: `git show --stat` do commit correspondente.
- [x] Task 5: Criar Commit 3 (WhatsApp/Config) adicionando adapters, MCP, main, docker e configs → Verify: `git show --stat` do commit correspondente.
- [x] Task 6: Criar Commit 4 (GitIgnore) adicionando a limpeza do arquivo `.gitignore` → Verify: `git show --stat` do commit correspondente.
- [x] Task 7: Rodar verificação final e testar compilação do Go → Verify: `go build` no diretório do bot.
- [x] Task 8: Criar Commit 5 (Frontend/Financeiro) com as alterações de componentes, hooks e tipos do frontend → Verify: `git show --stat` do commit correspondente.
- [x] Task 9: Atualizar `.gitignore` com as regras para ignorar scripts locais e planos md, e criar o Commit 6 (GitIgnore/Cleanup) → Verify: `git status` limpo de arquivos indesejados.

## Done When
- [x] Todos os 6 commits foram criados e validados individualmente.
- [x] Scripts, rascunhos de testes e planos md não commitados foram totalmente ignorados pelo `.gitignore`.
- [x] O repositório está em estado consistente e o bot compila com sucesso.

## ✅ PHASE X COMPLETE
- Unit Tests: ✅ Pass (all internal units pass)
- Build: ✅ Success
- Date: 2026-06-07
