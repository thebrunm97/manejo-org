# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato baseia-se no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [v1.1.0] - 2026-03-05

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

## [v1.0.0-beta.1] - 2026-03-04

### 🚀 Added
- **Audio Hands-Free Pipeline**: Fluxo híbrido (Inbound Voice -> Text / Outbound Text -> TTS Voice).
- **Quota Subsystem Parity**: Lógica autônoma de reset diário in-memory lendo as tabelas `daily_request_count`, e `last_usage_date` do banco com enforcement do limite hardcoded `FREE_TIER_DAILY_LIMIT = 100`.
- **RAG Local Ingestion**: Funcionalidades iniciais de ingestão pelo File API do SDK nativo do Gemini (v1beta).
