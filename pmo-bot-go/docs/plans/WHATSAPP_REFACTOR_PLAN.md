# WHATSAPP_REFACTOR_PLAN.md - Operação: Hexagonal WhatsApp

Este documento detalha a especificação técnica para a transição do sistema `pmo-bot-go` para o Padrão Adapter (Ports and Adapters), visando o desacoplamento do provedor WPPConnect.

## 1. As Portas (Ports)

O arquivo `internal/ports/whatsapp.go` será a nossa única fonte de verdade para o que o domínio espera de um serviço de mensageria.

```go
package ports

import (
	"time"
)

// MessageSender define as operações de saída que o sistema pode realizar.
type MessageSender interface {
	SendMessage(to, message string) error
	SendVoice(to, base64Audio string, isPtt bool) error
	SendReply(to, message, replyToMessageID string) error
	DownloadAudio(messageID string) ([]byte, error)
	DownloadImage(messageID string) ([]byte, string, error)
}

// IncomingMessage representa uma mensagem recebida de forma agnóstica ao provider.
type IncomingMessage struct {
	ID        string    // ID único da mensagem para deduplicação
	From      string    // Identificador do remetente (ex: fone)
	Body      string    // Conteúdo textual
	Type      string    // text, image, ptt, audio
	IsAudio   bool      // Helper para rápido acesso
	IsImage   bool      // Helper para rápido acesso
	Timestamp time.Time // Momento exato do recebimento
}
```

## 2. O Adaptador (Adapter) WPPConnect

A pasta `internal/whatsapp` será movida para `internal/adapter/wppconnect`. O pacote será renomeado para `wppconnect`.

### Tradução de Protocolo
O adapter será responsável por parsear o JSON bruto do WPPConnect e convertê-lo para o nosso `ports.IncomingMessage`.

```go
// internal/adapter/wppconnect/webhook.go

func ParseWebhook(rawBody []byte) (ports.IncomingMessage, error) {
    // 1. Unmarshal para a struct interna WPPMessage (que já existe no webhook/handler.go)
    // 2. Aplicar lógica de normalização (ID, fone, timestamp)
    // 3. Retornar ports.IncomingMessage
}
```

## 3. O Desacoplamento da Máquina de Estados (FSM)

Todos os arquivos em `internal/state/` devem parar de referenciar `*whatsapp.Client` e passar a usar a interface.

### Mudanças de Assinatura:
- **fsm.go:** `ProcessMessage(... wpClient ports.MessageSender, ...)`
- **utils.go:** `sendFeedback(wpClient ports.MessageSender, ...)`
- **specialized_handlers.go:** `handleActiveState(... wpClient ports.MessageSender, ...)`
- **specialized_handlers.go:** `handleDuvidaFallback(wpClient ports.MessageSender, ...)`
- **handlers_manejo.go / limpeza.go / financeiro.go:** Todas as funções internas que recebem o cliente.

## 4. Checklist de Implementação (Fase 3)

- [ ] **Step 1: Definição de Contratos**
  - [ ] Criar diretório `internal/ports/`.
  - [ ] Criar `internal/ports/whatsapp.go` com interface e struct.
- [ ] **Step 2: Migração do Adapter**
  - [ ] Criar diretório `internal/adapter/wppconnect/`.
  - [ ] Mover arquivos de `internal/whatsapp/` para o novo diretório.
  - [ ] Atualizar pacotes e implementar a interface `MessageSender`.
  - [ ] Mover `WPPMessage` de `handler.go` para o adapter e criar `ParseWebhook`.
- [ ] **Step 3: Refatoração da Camada de Domínio**
  - [ ] Atualizar imports em `internal/state/`.
  - [ ] Substituir tipos concretos pela interface `ports.MessageSender`.
- [ ] **Step 4: Atualização do Webhook e Entry Points**
  - [ ] Atualizar `internal/webhook/handler.go` para usar a interface e o novo parser.
  - [ ] Atualizar `cmd/server/main.go` para injetar o adapter via interface.
- [ ] **Step 5: Validação Final**
  - [ ] Rodar `go test ./...`.
  - [ ] Verificar logs de conexão do WPPConnect.
