# Changelog ManejoORG

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [0.20.0] - 2026-09-08 - "Mapa por satélite, novos canais de atendimento e blindagem de dados 🛰️"

Um mês inteiro de trabalho de bastidor: o mapa da propriedade ganhou visão de satélite com saúde da lavoura por talhão, o assistente passou a atender também por Telegram e Chat Web (além do WhatsApp), e a plataforma migrou para infraestrutura própria com uma varredura de segurança que fechou uma série de brechas de isolamento entre contas. Também entra a primeira consulta de janela de plantio usando dados oficiais do MAPA (ZARC).

### ✨ Funcionalidades (Features)
* **Mapa por Satélite com NDVI:** Novo painel de camadas no mapa da propriedade, com imagens de satélite (Google Tiles, com fallback Esri) via Google Earth Engine e cálculo do NDVI médio dentro do polígono de cada talhão — um indicador visual de vigor da lavoura direto no mapa.
* **Janela de Plantio (ZARC/MAPA):** Nova consulta que cruza cultura, cidade/UF e safra com a tábua de risco climático do Zoneamento Agrícola de Risco Climático do MAPA, indicando a janela recomendada de plantio.
* **Atendimento Multicanal:** O assistente deixa de depender só do WhatsApp — a arquitetura de envio/entrega de mensagens (`ChannelSender`/`DeliveryManager`) agora suporta Telegram e Chat Web/PWA como canais adicionais.
* **Onboarding por Link Mágico:** Cadastro e login simplificados com vínculo de conta existente via código enviado por e-mail (OTP), sem precisar criar senha nem duplicar perfil.
* **Fila e Rate Limiting no Redis:** Novo limitador de taxa integrado ao Redis (com modo "degradar aberto" para não travar o atendimento se o Redis cair) e integração com RabbitMQ para desacoplar o processamento de mensagens.
* **Sincronização Offline:** Motor inicial de sincronização para produtores logados, preparando o app para uso em campo com conexão instável.

### 🛡 Segurança (Zero-Trust Hardening)
* **Fechamento de Brechas de Isolamento entre Contas (IDOR/RLS):** Corrigidas múltiplas falhas que, em cenários específicos, permitiam bypass de Row Level Security e vazamento de dados entre organizações/tenants — incluindo a view de conversas recentes, RPCs sem checagem de argumento e funções `SECURITY DEFINER` órfãs.
* **Validação de CPF/CNPJ:** O bot agora valida o dígito verificador antes de gravar CPF/CNPJ, rejeitando documentos inválidos na origem.
* **Sem Vazamento de Token em Log:** Corrigida uma falha que expunha o token de autenticação da Evolution API em texto plano nos logs.
* **Deduplicação de Mensagens:** Proteção contra reprocessamento do mesmo `msg_id` recebido mais de uma vez pelo webhook.

### 🛠 Infraestrutura e Deploy
* **Migração para VPS Própria:** Backend, frontend e serviços de suporte (RabbitMQ, banco local) migraram da Vercel/infraestrutura anterior para uma VPS dedicada (Hostinger), com hardening de rede e scripts de migração documentados.
* **Streaming e Auto-Recuperação:** As chamadas ao Gemini passaram a usar streaming com detecção de travamento por tempo até o primeiro token (TTFT); o self-heal de reconexão do WhatsApp deixou de rodar em modo simulado (dry-run) e agora reconecta de verdade em produção.
* **RAG Unificado:** Pipeline de ingestão de documentos consolidado em uma única tabela (`farm_documents`), com fallback de OCR para documentos sem texto extraível.

### 🐛 Correções de Bugs (Bug Fixes)
* **Onboarding:** Corrigido travamento em saudações iniciais e em fluxos de aprovação humana (HITL) sem cadastro prévio.
* **Registros Offline:** Corrigidos bugs de registro de limpeza/compostagem, cancelamento de limpeza, análise de solo com valor zero e retry de reconhecimento de voz (STT).
* **Compressão de Histórico:** Corrigida corrupção de histórico de conversa durante compressão assíncrona e status incorreto de job de ingestão de documentos.
* **Webhook:** O bot deixa de processar como mensagem de usuário os próprios eventos de status, grupo e eco enviados por ele mesmo.
* **Mapa:** Diversos ajustes de estabilidade — edição de talhão não recarrega mais a tela inteira, painel do talhão reposicionado e resumido no celular, e distinção entre permissão negada e falha de comunicação com o Earth Engine.

## [0.19.0] - 2026-08-24 - "Monitoramento 24h: agora sabemos na hora se algo sai do ar 📡"

Reforçamos os bastidores do assistente do WhatsApp para detectar e avisar a equipe imediatamente em caso de instabilidade — antes que o produtor precise perceber.

### ✨ Melhorias (Improvements)
* **Alerta Instantâneo:** A equipe técnica agora recebe um aviso automático assim que o assistente perde a conexão, permitindo uma resposta muito mais rápida a qualquer instabilidade.
* **Verificação de Saúde Contínua:** O sistema confirma periodicamente que está tudo funcionando normalmente, reduzindo o tempo que uma eventual falha passaria despercebida.

## [0.18.0] - 2026-07-21 - "O Novo Cérebro do PMO Bot: Multi-Agentes, Zero-Trust e Gestão Financeira 🌐"

Esta é uma das maiores atualizações já lançadas. Desde abril, focamos em reestruturar a arquitetura interna do PMO Bot para garantir mais resiliência, flexibilidade de provedores de IA e segurança absoluta nos dados (Zero-Trust). Além disso, o módulo financeiro recebeu sua expansão definitiva.

### ✨ Funcionalidades (Features)
* **LLM Agnóstico (Multi-Provedor):** Lançamento das Fases 1 e 2 do adaptador de LLM. O bot deixou de ser dependente exclusivo de um provedor e agora conta com uma *Factory* de provedores, incluindo suporte nativo a adaptadores compatíveis com OpenAI.
* **CFO Digital e Financeiro Fase 2:** Implementada a ferramenta standalone "CFO" baseada em IA para consultas interativas de saldo e relatórios. O painel financeiro agora possui tabela de transações em tempo real e sincronização de formulários de compras.
* **Fila de Mensagens Persistente & HITL:** Novo sistema de *Persistent Message Queue* integrado ao *Human-in-the-Loop* (HITL) workflow. Se a IA tiver dúvida crítica, a mensagem vai para uma fila de aprovação humana visível no novo *Queue Observability Dashboard*.
* **Monitoramento em Tempo Real:** Novo *Live Chat Monitor* e Painel de Limites de Segurança (Security Limits Dashboard) para controle de uso e quotas no frontend.
* **Avaliador RAG:** Adicionado o avaliador meta-rag *listwise* baseado no framework CMM, aumentando a precisão nas buscas no conhecimento agronômico.

### 🛡 Segurança e Confiabilidade (Zero-Trust Guardrails)
* **Deterministic Guardrails & LoopGuard:** A máquina de estados (FSM) agora conta com *fail-safes* globais para proteção contra loops infinitos e alucinações das ferramentas da IA.
* **Auditoria Determinística:** O banco de dados (Supabase) recebeu schemas específicos de auditoria com restrições severas de *Row Level Security* (RLS).
* **Tratamento de Falhas Parciais:** O bot agora suporta entidades pendentes (`PendingEntities`). Se uma operação em lote falhar no meio, ele salva o que conseguiu e pergunta sobre os dados restantes, sem perder o histórico (utilizando semáforos e `WaitGroup`).

### 🛠 Refatorações e Performance (Chores/Refactors)
* **Orquestração e Roteamento:** Extração do *RouterSystemPrompt* para JSON e refatoração completa das ferramentas MCP. O Roteador agora decide e delega para sub-agentes sem inflar o contexto global.
* **Frontend Resiliente:** Melhorias profundas na proteção de cliques em polígonos no mapa (UX guardrails) para evitar travamentos com dados espaciais corrompidos.
* **Banco de Dados:** Otimização de chaves estrangeiras no SQLite e *ON CONFLICT* seguras nas inserções para evitar duplicidades de eventos recebidos pela Evolution API.
* **Testes Extensivos:** Cobertura de testes e2e de multimodalidade (Compliance Multimodality Suite) abrangendo cenários críticos e *Zero-Trust*.

## [0.17.0] - 2026-04-14 - "Integridade de Dados e Feedback IA 🛡️"

### 🛠 Correções de Bugs (Bug Fixes)
* **Backend (pmo-bot-go):** Solucionada falha silenciosa de persistência em fazendas convencionais. O sistema agora converte corretamente `pmo_id: 0` para `NULL` antes de enviar ao Supabase, evitando violações de chave estrangeira.
* **Telemetria e Treinamento:** Restaurado o fluxo de logs para o Dashboard de Treinamento. Interações agênticas (RAG/Dúvidas) agora são registradas com extrações sintéticas enriquecidas com o `trace` de execução para facilitar auditorias técnicas.
* **Prompts (IA):** Atualizado o `OUTPUT_FORMAT_SCHEMA` nos prompts de sistema para eliminar mensagens de "falso positivo". O bot agora aguarda a confirmação real da ferramenta antes de exibir emojis de sucesso.

## [0.16.0] - 2026-04-09 - "Resiliência e IA Multiprovedor 🧬"

### ✨ Funcionalidades (Features)
* **Backend (pmo-bot-go):** Implementação de arquitetura de LLM agnóstica com suporte a fallback automático para OpenRouter/OpenAI em caso de falha no provedor principal (Gemini).
* **Orquestração:** Novo `ExecuteAgenticLoop` resiliente com suporte a injeção de Reasoning Tokens e histórico de conversa comum entre provedores.

### 🛠 Refatorações e Performance (Chores/Refactors)
* **LLM:** Introdução de `FerramentaAgnostica` e adapters dedicados para cada provedor, desacoplando o negócio dos SDKs proprietários.
* **Estado:** Limpeza de handlers redundantes e centralização da lógica de decisão no Orquestrador.

## [0.15.0] - 2026-04-08 - "Blindagem de Tipos e Evolução do Cérebro IA 🧠"

## [0.14.0] - 2026-04-04 - "A Era da Gestão Analítica e Consultoria IA 📈"

### ✨ Funcionalidades (Features)
* **Marketplace B2B2C:** Implementação do Mural de Demandas para Produtores e Torre de Controle para Gestores de Cooperativas.
* **Dashboard Financeiro:** Lançamento do motor de visualização de performance (DRE, Lucro/Prejuízo por Talhão).
* **Rastreabilidade Pública:** Adicionada rota pública (Mobile-First) acessível via QR Code para o consumidor final (em conformidade com INC 02/2018).

### 🛠 Refatorações e Performance (Chores/Refactors)
* **Frontend (React):** Modularização completa do `ManualRecordDialog` em sub-formulários independentes, resolvendo gargalos de renderização e facilitando manutenção futura (resolução de `DEBT-01`).
* **Backend (Go/Gemini):** Refatoração estrita do mapeamento de JSON Schema do Gemini (Function Calling) com conversão recursiva e injeção dummy, solucionando definitivamente falhas persistentes de `googleapi: Error 400`. Implementado bypass inteligente do SDK ChatSession para ferramentas MCP visando estabilidade térmica.
* **Banco de Dados (Supabase/SQL):** Otimizações ativas de consulta por meio da criação de índices otimizados (GIN/B-Tree) para buscas textuais e relacionamentos de integridade, além de blindagem de RLS para painéis administrativos B2B. Implementação dos novos procedimentos RPC do Engine Agronômico de NPK.
