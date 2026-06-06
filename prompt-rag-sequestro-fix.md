# Plano de Blindagem do Prompt do Agrônomo contra Sequestro Semântico

## Objetivo
Evitar que o bot copie e cole tabelas e dados de hortaliças/olericultura de forma genérica quando for questionado sobre milho ou culturas não descritas nos manuais de olericultura, forçando uma redação humanizada e filtragem semântica rigorosa.

## Tarefas
- [x] Task 1: Modificar o arquivo `pmo-bot-go/internal/gemini/prompts/agronomist.md` adicionando regras explícitas na seção `AGRONOMIC REALITY CHECK` para ignorar documentos que não mencionam a cultura pesquisada. → Verify: Visualizar o arquivo md modificado.
- [x] Task 2: Adicionar proibição explícita de "copiar e colar tabelas brutas" ou vomitar listas exaustivas de dados não relacionados ao prompt. → Verify: Revisar a seção `PROIBIÇÕES ABSOLUTAS` do prompt.
- [x] Task 3: Atualizar o arquivo de controle de tarefas do Antigravity. → Verify: Verificar se o `task.md` está atualizado.

## Done When
- [x] As regras anti-papagaio e anti-sequestro semântico estiverem devidamente descritas no prompt do agrônomo.
- [x] Nenhuma menção a IDs técnicos ou tabelas sem formatação esteja presente nas regras.
