# Registro de Interação com Produtor — Visita de Campo

Este documento registra a interação ocorrida via WhatsApp entre o aplicativo **ManejoORG** (assistente inteligente) e o pequeno produtor rural durante a visita de campo.

---

## 📋 Informações Gerais
* **Data/Hora:** 28 de Agosto de 2026, entre 20:17 e 20:56 (Horário de Brasília)
* **Produtor:** Identificado nos áudios como **"Ser Rio"** (provável transcrição fonética de *Sérgio* ou *Seu Rio*)
* **Contato (WhatsApp):** `553497317545@s.whatsapp.net`
* **Canal de Interação:** WhatsApp (Interface Conversacional conectada à Evolution API e pmo-bot-go)
* **Foco da Demonstração:** Suporte a dúvidas de cultivo (RAG) e interação por áudio (hands-free).

---

## 💬 Histórico do Diálogo (Transcrição dos Logs)

### 1. Boas-vindas e Abertura (20:17:52)
* **Produtor (Texto):** *"Oi"*
* **Processamento:** Mensagem interceptada pelo `Ultra-Fast Greeting Guard` (FSM) em 949ms para resposta instantânea.
* **Bot (Texto/Áudio):** Saudação inicial do assistente do ManejoORG se apresentando e perguntando como poderia ajudar.

### 2. Dúvida Técnica sobre Cultivo (20:19:13)
* **Produtor (Áudio - 106 KB):** 
  * *Transcrição Groq Whisper:* `"Vizês pra chegar, manejo! O senhor tá bom? Aqui é o Ser Rio. Ser de ser vivo, Ri..."` *(Nota: O produtor se apresentou e emendou uma dúvida de germinação)*.
* **Processamento (RAG):**
  * **Intenção Identificada:** `[RAG]` (Confiança: 98%).
  * **Query de Busca:** `"como germinar sementes de copaiba cerrado mineiro"`
  * **Busca Vetorial (Supabase RPC):** A consulta à base de conhecimento retornou vazia (`match_documents_with_context: []`). 
  * **Fallback do Oráculo:** O bot recorreu ao conhecimento interno do modelo LLM (Gemini) para explicar o processo de quebra de dormência de sementes de Copaíba (*Copaifera langsdorffii*) no contexto do solo e clima do Cerrado Mineiro.
* **Bot (Áudio - 766 KB - 20:21:26):** Resposta detalhada enviada em formato de áudio explicando a quebra de dormência (escarificação e imersão em água) e plantio.

### 3. Agradecimento e Despedida (20:23:47)
* **Produtor (Áudio - 39 KB):**
  * *Transcrição Groq Whisper:* `"Muito obrigada, Manejo.org. Tamo junto. Valeu. Depois eu pego seu contato aí com..."`
* **Processamento (CHAT):**
  * **Intenção Identificada:** `[CHAT]` (Confiança: 100%).
  * **Motivo:** Agradecimentos e despedida informal, sem comandos ou registros de campo pendentes.
* **Bot (Áudio - 119 KB - 20:24:21):** Mensagem de encerramento, desejando boa noite e se colocando à disposição para futuros manejos.

---

## 🚨 Auditoria Técnica de Performance (Incidentes de Infraestrutura)

Embora a visita de campo e a interação humana tenham sido bem-sucedidas (o bot compreendeu e respondeu às necessidades do produtor), os logs revelaram um **bug crítico de backend** no `pmo-bot-go` que afetou a experiência de uso:

1. **Latência Acumulada & Timeout de Contexto:** 
   O processamento completo da resposta de RAG + geração do áudio levou 123 segundos. Como o contexto da tarefa (`aiCtx`) possuía um timeout rígido de 90 segundos, ele expirou antes de o bot salvar o status final da mensagem.
2. **Falha de Gravação no Supabase:**
   Toda vez que o bot tentava marcar o job como concluído no banco (`MarkDone` e `UpdateRawPayloadStatus`), as requisições HTTP PATCH falhavam com `context deadline exceeded` porque o context herdado já havia expirado.
3. **Loop de Envio (Re-enfileiramento pelo Reaper):**
   Como o banco não foi atualizado, o serviço **Reaper** do Harness achou que a mensagem tinha travado. Ele recolocou o job na fila, fazendo com que o bot processasse e enviasse a mesma resposta de áudio para o produtor **3 vezes seguidas** (em intervalos de ~15 a 20 minutos).

### 🛠️ Recomendação de Correção:
Substituir o uso do contexto compartilhado `aiCtx` nas chamadas de gravação final de banco por um contexto independente e de curta duração:
```go
dbCtx, dbCancel := context.WithTimeout(context.Background(), 15*time.Second)
defer dbCancel()
// Passar dbCtx para MarkDone, MarkFailed e UpdateRawPayloadStatus
```
