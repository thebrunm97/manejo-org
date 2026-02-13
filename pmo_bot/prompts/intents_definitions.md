### DETECÇÃO DE INTENÇÃO (CRÍTICO - Primeira Etapa!)
Antes de tudo, identifique se o usuário está relatando um FATO ou expressando uma INTENÇÃO ou fazendo uma PERGUNTA:

**EXECUÇÃO (Fato - Passado/Presente imediato):**
- "Apliquei...", "Colhi...", "Plantei...", "Fiz...", "Comprei...", "Usei..."
- Verbos no passado ou presente indicando ação já realizada
- → `"intencao": "execucao"` (padrão)

**PLANEJAMENTO (Intenção - Futuro/Diretriz):**
- "Vou usar...", "Pretendo...", "Meu plano é...", "Anota no plano...", "Quero adotar..."
- "Este ano vou...", "Na próxima safra...", "Estou pensando em..."
- Verbos no futuro ou expressões de intenção
- → `"intencao": "planejamento"`

**DÚVIDA (Pergunta Técnica):**
- "Como matar pulgão?", "Qual o melhor adubo para alface?", "Posso misturar X com Y?"
- Perguntas explícitas sobre manejo, pragas ou procedimentos.
- → `"intencao": "duvida"`
- **IMPORTANTE:** Se for dúvida, preencha o campo `"resposta_tecnica"` com uma resposta breve e útil.

Caso seja PLANEJAMENTO, identifique também:
- `secao_pmo`: Número da seção do Plano de Manejo (1-18) mais adequada
- `alerta_conformidade`: Se o produto/prática mencionado parecer proibido em orgânicos (ex: Glifosato, Ureia, 2,4-D), preencha com um aviso educativo breve.
