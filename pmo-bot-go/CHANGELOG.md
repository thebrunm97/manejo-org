# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato baseia-se no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### 🚀 Épico Concluído: Arquitetura Híbrida Multi-Agente (OKF + Triador Llama-3)

**Resumo Executivo**
Foi implementada com sucesso a evolução da arquitetura do PMO Bot Go, transacionando de um modelo monolítico de mega-prompt para uma Arquitetura Híbrida Multi-Agente guiada por domínios. 

O valor de negócio gerado inclui:
- **Redução de Poluição de Tokens:** Ao fragmentar as regras do Open Knowledge Format (OKF) por área (Agronomia, Finanças, Suporte, Geral), evitamos injetar instruções irrelevantes nos prompts, o que melhora o desempenho dos agentes e o seu poder de raciocínio focado.
- **Mitigação de Custos e Latência:** A triagem na camada FSM, orquestrada por um modelo ultrarrápido (Groq Llama-3), filtra a intenção no turno inicial da conversa, ativando as `tools` e a memória apropriada *antes* de evocar o LLM de peso-pesado (Orquestrador).
- **Isolamento de Regras (Governance):** A separação das regras possibilita uma evolução independente por domínio de negócio, onde especialistas podem contribuir via arquivos de texto `.md` sem risco colateral para outros fluxos operacionais.

**Alterações Estruturais**
- **Taxonomia de Conhecimento Segmentada (`knowledge/`):** A diretoria principal de conhecimento foi reestruturada para suportar as subpastas baseadas em domínios lógicos (`agronomy`, `finance`, `support`, `general`). O ficheiro `loader.go` agora gere múltiplos contextos paralelamente e fornece métodos dinâmicos como `GetContextForDomain()`.
- **Atualização Condicional de Ferramentas (MCP):** O `PromptManager` e o `Orchestrator` agora recebem dinamicamente a propriedade `agentDomain`. Consequentemente, o isolamento garante que instruções conflituantes de fallback (ex: RAG) só são evocadas nos domínios precisos (como agronomia).
- **Triador Groq na FSM:** Integração do motor de Classificação JSON (`Triador`) na *goroutine* de extração da Máquina de Estados (`fsm.go`), com fallbacks de resiliência e validação estrita.

**Como Testar (Para Developers)**
Com o servidor ativo (porta `8080`), utilize os comandos `cURL` abaixo para simular as intenções conversacionais. Nos *logs* do servidor, verifique qual domínio (`agronomy` / `finance`) foi classificado pelo Triador e as ferramentas carregadas.

*Exemplo 1: Simulação Agronômica*
`curl -X POST http://localhost:8080/webhook/evolution?token=ManejoOrgToken -H "Content-Type: application/json" -d '{"event": "messages.upsert", "data": {"key": {"remoteJid": "5511999999999@s.whatsapp.net"}, "message": {"conversation": "Como combater a lagarta no milho?"}}}'`

*Exemplo 2: Simulação Financeira*
`curl -X POST http://localhost:8080/webhook/evolution?token=ManejoOrgToken -H "Content-Type: application/json" -d '{"event": "messages.upsert", "data": {"key": {"remoteJid": "5511999999999@s.whatsapp.net"}, "message": {"conversation": "Vendi 50 sacas de soja"}}}'`


### 🚀 Added
- **Compras (Formulário 06)**: Novo módulo E2E para registro de Compras de Insumos. Integração frontend na aba `ComprasTab` com submissão off-line ready. Nova ferramenta MCP `registrar_compra_insumo` inclusa no backend para captura via WhatsApp.
- **Inteligência de Limpeza**: Atualização de regras de extração no `system_prompt.md` (item de área, produto, dosagem) garantindo liberação imediata da entidade para registros do Formulário 04.

## [0.13.0] - 2026-03-28

### 🚀 Added
- **RPCs de Banco de Dados**: Adoção de `criar_infraestrutura_pmo`, `rpc_registrar_compra_insumo`, e `rpc_registrar_operacao_campo`.
- **Atomicidade Garantida**: Resolução automática de IDs (Talhões, Canteiros) diretamente via PL/pgSQL.

### 🛠 Refactored / Fixed
- **Thin Backend**: Remoção massiva de inserções iterativas Go, delegando transações para o PostgreSQL de forma declarativa.

## [0.12.0] - 2026-03-27

### 🚀 Added
- **Router LLM**: Orquestrador de intenções inteligente para FSM vs RAG.
- **Sanitizador UI**: Correção de artefatos markdown antes do encaminhamento à API WhatsApp.
- **Security Middlewares**: Fallbacks e validações de timeout (90s) contra processamento fantasma.

### 🛠 Refactored / Fixed
- **FSM Context Management**: Introdução pragmática do `LoopGuard` para travar intenções repetitivas.

## [v0.11.5] - 2026-03-19

### 🚀 Added
- **FSM State Persistence (Context Retention)**: Implementação de Máquina de Estados Finita (FSM) com persistência in-memory por telefone. Agora o bot retém o contexto de registros incompletos (Atividade, Item, Local) e aguarda informações faltantes (ex: Quantidade) sem sofrer de "amnésia".
- **Entrevista Ativa (Interactive Dialogue)**: Fluxo de diálogo inteligente para "Compra/Aquisição" e registros bloqueados pelo Choke Point, guiando o usuário até a conclusão do dado obrigatório.
- **Global Guardrail (Choke Point)**: Barreira universal ativada imediatamente após extração NER, impedindo salvamentos prematuros no Supabase e redirecionando o fluxo para estados de espera.

### 🛠 Refactored / Fixed
- **FSM Logic Execution Order**: Reordenamento crítico da resolução de perfis e telefones. Agora os dados do usuário são resolvidos ANTES do processamento de áudio STT e vinculação de dispositivos, garantindo telemetria e logs precisos em todos os cenários.
- **Audio Redundancy Cleanup**: Remoção de blocos duplicados de processamento de áudio e transcrição Whisper na `fsm.go`.
- **Typing & Compilation**: Corrigidos erros de tipagem de tempo (`time.Time`) e variáveis de contexto não utilizadas no orquestrador da FSM.

## [v0.11.1] - 2026-03-05

### 🚀 Added
- **Observabilidade (Ingestão RAG)**: Nova tabela `ingestion_jobs` e sistema de rastreamento no backend para monitorar estados de processamento (pendente, processando, concluído, falhou).
- **Dashboard de Monitoramento**: Página administrativa `/admin/conhecimento` com visualização em tempo real do progresso de ingestão (Supabase Realtime).
- **Subsistema de Cotas**: Implementação de trava multi-tenancy que limita a ingestão a 3 documentos para usuários no plano 'free'.
- **Interface de Cotas**: Card de status na página de monitoramento exibindo uso atual e nível do plano.

### 🛠 Refactored / Fixed
- **Reorganização Modular**: Movimentação das ferramentas `cmd/tester` para subdiretórios específicos (`e2e`, `rag`, `list_models`), resolvendo conflitos de redeclaração de pacotes.
- **Limpeza de Lint**: Correção de avisos de variáveis não utilizadas em testes e parâmetros obsoletos no cliente TTS.
- **Otimização de Dependências**: Sincronização do `go.mod` e remoção de lógica fallback não utilizada no Orchestrator TTS.
- **Navegação**: Link "Ingestão (RAG)" adicionado à sidebar para administradores.


### 🐛 Fixed (Bugfixes Críticos de Schema e Mídia)
- **DB Schema (`caderno_campo`)**: Corrigida a coluna fantasma na inserção. A struct `CadernoCampoInsert.UsuarioID` agora converte para o JSON `"user_id"` em vez de `"usuario_id"`, prevenindo o HTTP 400 Bad Request.
- **Tipagem de UUIDs (`canteiros`)**: Ajustada toda a pirâmide relacional de canteiros. Modificado `LookupCanteiroIDs`, FSM State e `InsertCanteiroVinculos` para trabalharem com cadeias de caracteres (`[]string`) no lugar de `[]int64`, alinhando-se aos UUIDs de produção do Supabase. Resolvido o mascaramento do erro `Cannot unmarshal string into int64`.
- **Comando Onboarding (`CONECTAR`)**: Reparado o ponteiro de pesquisa na vinculação de dispositivos web. A query passou de `codigo_vinculacao` para a tabela exata de produção `codigo_vinculo`.
- **Áudio TTS Rejeitado (`WPPConnect`)**: Substituído o MIME header pré-fixado gerado pelo fallback do HTGoTTS (Google) de `data:audio/mp3;base64,` para `data:audio/mpeg;base64,`. Previne o erro `InvalidMediaCheckRepairFailedType` originado por rejeição na stream formatada do ffmpeg inserida no core do WhatsApp.

## [v0.11.0-beta.1] - 2026-03-04

### 🚀 Added
- **Audio Hands-Free Pipeline**: Fluxo híbrido (Inbound Voice -> Text / Outbound Text -> TTS Voice).
- **Quota Subsystem Parity**: Lógica autônoma de reset diário in-memory lendo as tabelas `daily_request_count`, e `last_usage_date` do banco com enforcement do limite hardcoded `FREE_TIER_DAILY_LIMIT = 100`.
- **RAG Local Ingestion**: Funcionalidades iniciais de ingestão pelo File API do SDK nativo do Gemini (v1beta).
