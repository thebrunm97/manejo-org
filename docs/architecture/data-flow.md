# 🔄 Fluxos de Dados

Este documento detalha os principais fluxos de informação no ecossistema ManejoORG, desde a interação do produtor até a persistência auditável no banco de dados.

## 1. Fluxo: WhatsApp → Resposta
Este é o fluxo principal de interação do sistema, orquestrado pela FSM (Finite State Machine) no backend Go.

```mermaid
sequenceDiagram
    participant P as Produtor
    participant W as Evolution API
    participant G as Go Backend
    participant R as AI Router
    participant A as Agent (DB/Agro)
    participant S as Supabase

    P->>W: Mensagem/Áudio/Imagem
    W->>G: POST /webhook/evolution (HMAC Signature)
    G->>G: Valida HMAC + Deduplica Mensagem
    alt É Áudio
        G->>G: Transcreve via Groq (Whisper)
    else É Imagem
        G->>G: Descreve via Gemini 1.5 Flash Vision
    end
    G->>R: Classifica Intenção (Registro vs Dúvida)
    R->>A: Roteia para Agente Especialista
    A->>S: Executa RPC ou Vector Search
    S-->>A: Retorna Dados/Status
    A-->>G: Gera Resposta Contextualizada
    Note over G: Loop de Ferramentas (LoopGuard Ativo)
    G-->>W: POST /message/send
    W-->>P: Resposta no WhatsApp
```

---

## 2. Fluxo: Offline Sync (Frontend)
O sistema PWA garante a integridade dos dados mesmo sem sinal de internet no campo.

```mermaid
sequenceDiagram
    participant U as Usuário
    participant FE as Frontend (UI)
    participant IDB as Local DB (IndexedDB)
    participant Q as Offline Queue
    participant BE as Backend / Supabase

    U->>FE: Salva Registro (ex: Plantio)
    FE->>IDB: Persiste com ID temporário ('offline_...')
    FE->>Q: Adiciona tarefa à fila de sincronização
    Note over FE: Monitorando navigator.onLine
    alt Conexão Detectada
        Q->>BE: Tenta enviar Payload
        alt Sucesso
            BE-->>Q: Retorna ID Real do Database
            Q->>IDB: Atualiza/Remove item e marca como 'Sync'
        else Erro Temporário
            Note over Q: Inicia Backoff Exponencial (Retry)
        end
    end
```

---

## 3. Fluxo: Compliance Engine
A lógica de conformidade é aplicada antes de qualquer persistência para garantir a validade dos registros orgânicos.

```mermaid
flowchart TD
    Start([Início do Registro]) --> Input{Analisar Insumo/Atividade}
    Input -- "Contém Proibidos?" --> Blacklist{Blacklist Check}
    Blacklist -- "Sim (Glifosato, NPK, etc)" --> Reject([REJEITAR: Notificar Proibição])
    Blacklist -- "Não" --> Spec{Especificidade?}
    
    Spec -- "Genérico ('Insumo', 'Veneno')" --> AskDetail([SOLICITAR: Pedir Detalhes])
    Spec -- "Específico" --> Precaution{Alerta Orgânico?}
    
    Precaution -- "Sim (ex: Calcário com restrição)" --> Warning([APROVAR: Com Nota de Precaução])
    Precaution -- "Não" --> Approve([APROVAR: Registro Limpo])
    
    Warning --> RPC[Chamar rpc_registrar_operacao_campo]
    Approve --> RPC
    RPC --> Log[Gravar Audit Log: logs_processamento]
    Log --> End([Fim do Fluxo])
```

---

## 4. Detalhes de Implementação

### 4.1 Validação HMAC
Todas as requisições vindas da `Evolution API` são validadas usando uma chave secreta e o algoritmo HMAC-SHA256 para garantir que a origem é autêntica.

### 4.2 LoopGuard
Para evitar custos excessivos e loops infinitos da IA, o orquestrador Go mantém um contador de chamadas de ferramentas por turno. Se exceder o limite (default: 5), a IA é forçada a parar e retornar o estado atual.

### 4.3 Estratégia de Sincronização
O frontend utiliza uma estratégia de "Claim-then-Delete", onde o item é reservado na fila antes do envio. Em caso de falha persistente ou conflito de dados, o usuário é notificado via Dashboard.
