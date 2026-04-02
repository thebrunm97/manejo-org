# ⚙️ FSM — Finite State Machine (Orquestrador)

## Visão Geral
A FSM (Máquina de Estados Finitos) controla o fluxo conversacional de cada produtor no WhatsApp. Após a refatoração recente, o sistema evoluiu de um modelo monolítico para uma arquitetura de **Orquestrador e Handlers Especializados**, melhorando a manutenibilidade e a clareza da lógica de negócio.

## Arquitetura de Decomposição

O arquivo `internal/state/fsm.go` agora atua estritamente como o **Orquestrador Principal** (`ProcessMessage`), responsável por:
1.  **Resolução de Contexto**: Identificar o produtor e o PMO ativo via Supabase.
2.  **Processamento de Mídia**: Orquestrar transcrição de áudio (Groq) e visão computacional (Gemini).
3.  **Roteamento de Intenção**: Filtragem inicial e despacho para o handler correto.
4.  **Gestão de Estados Ativos**: Invocar o handler correspondente se houver uma "entrevista" em curso.

A lógica específica de cada domínio foi movida para arquivos dedicados:

| Arquivo | Responsabilidade |
|---------|------------------|
| `handlers_manejo.go` | Registro de atividades agrícolas (Plantio, Manejo, Colheita). |
| `handlers_financeiro.go` | Fluxo de caixa, compras de insumos e vendas (Phases 03+). |
| `handlers_limpeza.go` | Comandos de reset de estado e limpeza de logs. |
| `specialized_handlers.go` | Handlers para estados complexos (AguardandoQuantidade, Dúvida Técnica). |
| `utils.go` | Funções auxiliares de parsing, feedback via WhatsApp/TTS e métricas. |

## Diagrama de Estados

```mermaid
stateDiagram-v2
    [*] --> StateInitial
    StateInitial --> StateAguardandoQuantidade: Registro sem quantidade ou NeedsInfo=true
    StateInitial --> StateAguardandoCompra: Compra sem fornecedor
    StateInitial --> StateInitial: Resposta completa / Dúvida técnica
    
    StateAguardandoQuantidade --> StateInitial: Quantidade informada -> Salvar (Manejo Handler)
    StateAguardandoQuantidade --> StateAguardandoQuantidade: Quantidade inválida
    
    StateAguardandoCompra --> StateInitial: Fornecedor informado -> Salvar (Financeiro Handler)
    StateAguardandoCompra --> StateAguardandoCompra: Dados incompletos
```

## Tabela de Estados (pmo-bot-go)

| Estado | Nome no Código | Descrição |
|--------|----------------|-----------|
| **Inicial** | `StateInitial` ("") | Estado padrão. O bot aguarda uma nova intenção do usuário. |
| **Aguardando Quantidade** | `StateAguardandoQuantidade` | Disparado quando um registro de atividade é detectado mas a quantidade não foi extraída. |
| **Aguardando Compra** | `StateAguardandoCompra` | Disparado especificamente para "Compra/Aquisição" quando o fornecedor é omitido. |

## LoopGuard (Anti-Recursão)

O sistema utiliza um mecanismo de **LoopGuard** para evitar que a IA entre em loops infinitos ou gaste tokens desnecessariamente.

- **Implementação:** `internal/mcp/loopguard.go`
- **Funcionamento:** Bloqueia se o loop de ferramentas exceder **5 iterações** ou se a mesma ferramenta for chamada com argumentos idênticos mais de **2 vezes**.

## Guia: Como Adicionar um Novo Fluxo/Estado

Para estender a lógica de conversação, siga o padrão modular:

1.  **Definir Constante**: Adicione o novo estado em `internal/state/fsm.go`.
2.  **Identificar o Domínio**: Verifique se a lógica pertence a Manejo, Financeiro ou um novo domínio.
3.  **Criar o Handler**: Implemente a função de processamento no arquivo de handler correspondente (ex: `handlers_manejo.go`).
4.  **Registrar no Orquestrador**:
    *   No switch de `ProcessMessage` (para intenções novas).
    *   No switch de `handleActiveState` (para recuperação de estados pendentes).
5.  **Limpeza**: Sempre chame `historyManager.ClearFSMState(phone)` após concluir o fluxo com sucesso.
