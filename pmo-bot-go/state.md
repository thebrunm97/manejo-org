# Estado Atual do Projeto (PMO Bot)

## 🎯 O que Concluímos até agora:

1. **Agentic Loop (Fase 1: Read-Only Tool Calling)**
   - Abandonámos o fluxo rígido de FSM (Máquina de Estados) no Orquestrador (`internal/state/orchestrator.go`).
   - Implementámos um ciclo autónomo (`for` com limite de turnos) capaz de interpretar chamadas de ferramentas (`ToolCalls`) e devolver os resultados ao LLM de forma dinâmica.
   - Adicionámos o "Bypass" para a intenção de `CHAT`, economizando iterações quando o utilizador apenas quer conversar.

2. **Ferramenta de RAG (`ConsultarLeiOrganica_RAG`)**
   - Ferramenta registada e conectada aos vetores reais de 3072 dimensões (Gemini) armazenados no Supabase.
   - Adicionámos validações rigorosas (Fallback) para evitar *panics* caso o LLM envie argumentos malformados na Tool Call.

3. **Arena de Modelos (Shootout)**
   - Construímos um teste automatizado (`benchmark_shootout_test.go`) para validar o Agentic Loop com vários modelos via OpenRouter.
   - **Resultados:** 
     - `tencent/hy3-preview`: Passou com sucesso (O mecanismo de FAIL-OPEN atuou graciosamente quando a avaliação do Meta-RAG falhou por timeout).
     - `deepseek/deepseek-v4-flash`: Passou com sucesso.
     - `moonshotai/kimi-k2.6`: Falhou devido a um timeout extremo da API na geração da resposta base.

4. **Laboratório de Embeddings (Open-Source vs Gemini)**
   - Construímos um script 100% offline em NodeJS (`scratch/benchmark_os_local.js`) utilizando `Transformers.js`.
   - Testámos os modelos `Xenova/all-MiniLM-L6-v2` (Inglês) e `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (Multilingue) - ambos com 384 dimensões.
   - **Conclusão Crítica:** Ambos os modelos open-source falharam redondamente ao dar match preciso em palavras-chave importantes no idioma Português (ex: "glifosato"). Comprovámos empiricamente que a decisão de manter os vetores originais do `gemini-embedding-2` (3072 dimensões) no Supabase é de facto a melhor e mais segura arquitetura para o projeto.

---

## 🚀 Próximos Passos (Próxima Sessão):

1. **Limpeza do Laboratório Local:**
   - Remover a diretoria `scratch/` e os pacotes npm, pois o teste de embeddings foi concluído com sucesso.

2. **Agentic Loop (Fase 2: Ferramentas de Mutação):**
   - Agora que o RAG (Read-Only) está perfeitamente estável com o loop de Tool Calling, o próximo grande passo é introduzir as ferramentas de Escrita na Base de Dados (ex: criar fazendas, registar colheitas).
   - *Iniciado:* Criação da ferramenta de **Escrita em Lote (Batch Writing)** para registo de múltiplas operações numa única requisição.

3. **Otimização de Latência e UX:**
   - *Concluído:* Implementado o indicador de "digitando..." (Chat Presence) integrado à Evolution API, que mascara ativamente a latência das ferramentas de LLM e RAG.
