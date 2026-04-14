# 🚀 Future Spike: In-App AI Assistant (Omnichannel)

**Status:** 💡 Em Pesquisa / Spike  
**Data:** Fevereiro 2026  
**Área:** AI / Interface / Native Features

## Objetivos
Desenvolver uma interface de chat nativa dentro do ecossistema React/PWA para reduzir a dependência do gateway WPPConnect, melhorar o tempo de resposta e permitir interações ricas (gráficos e cards).

## Requisitos Técnicos Identificados

### 1. Chat UI Engine
Implementação de uma interface de mensagens usando Tailwind CSS, com suporte a:
- Estados de "Typing..."
- Balões de mensagens diferenciados (User vs AI)
- Scroll automático para o final da conversa (Auto-scroll)

### 2. Native Audio Recording (Web API)
- Utilização da `MediaRecorder API` para captura de áudio nativo no navegador/PWA.
- Implementação de fallback para formatos de áudio (`audio/webm` ou `audio/ogg`) compatíveis com o processamento do backend Gemini/Whisper.
- Gestão de permissões de microfone no iOS/Android.

### 3. Backend Integration
- Criação de um endpoint direto no FastAPI (`pmo-bot`) para receber o Blob de áudio via Multipart Form Data.
- Bypass da fila do Redis para mensagens In-App (prioridade de baixa latência).

### 4. Rich Content Rendering
Capacidade da IA retornar JSON que o Front-end renderize como componentes React, por exemplo:
- Mini-gráfico de colheita.
- Card de confirmação de insumo.
- Widgets de previsão do tempo contextuais.

## Prós de Engenharia
- **Redução de Custo/Infra:** Eliminação do overhead de instâncias Chrome Headless para usuários In-App.
- **Segurança Apple Store:** Interface de chat própria, evitando rejeições por uso de APIs de terceiros (WhatsApp) em fluxos críticos.
- **UX Superior:** Menor latência e suporte a elementos visuais não suportados pelo WhatsApp Markdown.

## Próximos Passos
1. POC de gravação de áudio no iOS PWA.
2. Definição do contrato de JSON para Rich Components.
3. Protótipo da UI de chat no Dashboard.
