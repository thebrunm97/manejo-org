# Correção de Timeout, Relógio e Leak Financeiro

## Goal
Resolver os problemas de timeout do roteador, injeção da data atual para o LLM não errar o mês da colheita, e a perda do parâmetro `valor_total` na inserção de transações financeiras pela colheita.

## Tasks
- [ ] Task 1: Aumentar timeout do roteador em `fsm.go` de 10s para 30s → Verify: Ler arquivo `fsm.go` após a alteração.
- [ ] Task 2: Injetar `"Data atual do sistema: [DATA]"` em `manager.go` no Orquestrador e Roteador → Verify: Ler os arquivos afetados para validar o formato.
- [ ] Task 3: Criar migração SQL `20260606_fix_registrar_colheita.sql` com fallback para a categoria financeira e garantia de inserção → Verify: Validar sintaxe da query e checar banco de dados.
- [ ] Task 4: Aplicar migrações e reconstruir o container com `docker compose -f docker-compose.prod.yml up -d --build pmo-bot-go` → Verify: Verificar logs de inicialização sem erro.

## Done When
- [ ] Timeout aumentado com sucesso
- [ ] Data atual do sistema injetada em todos os prompts principais
- [ ] `valor_total` da Colheita inserido em `transacoes_financeiras` sem silently failing
- [ ] Container do bot subiu corretamente com as alterações.
