# 📚 Documentação Técnica - AgroVivo PMO

Bem-vindo à documentação técnica do sistema de Planos de Manejo Orgânico (PMO) da AgroVivo.

---

## 📑 Índice de Documentos

### 🏗️ Arquitetura e Estrutura de Dados

| Documento | Descrição | Última Atualização |
|-----------|-----------|-------------------|
| **[PMO_DATA_STRUCTURE.md](./PMO_DATA_STRUCTURE.md)** | Estrutura canônica do `form_data` (JSONB) no Supabase. Contrato entre backend Python e frontend React. | 21/12/2024 |

### 🔄 Integrações

| Documento | Descrição | Status |
|-----------|-----------|--------|
| `WHATSAPP_INTEGRATION.md` | Fluxo de sincronização via WhatsApp → Whisper → Llama 3.3 | ✅ Implementado (WPPConnect) |
| `SUPABASE_SCHEMA.md` | Esquema completo do banco de dados Supabase | 🚧 Planejado |

### 🎨 Frontend

| Documento | Descrição | Status |
|-----------|-----------|--------|
| `COMPONENTS_GUIDE.md` | Guia de componentes React/MUI reutilizáveis | 🚧 Planejado |
| `FORM_VALIDATION.md` | Regras de validação por seção do formulário | 🚧 Planejado |

### 🐍 Backend

| Documento | Descrição | Status |
|-----------|-----------|--------|
| `API_ENDPOINTS.md` | Documentação de endpoints Flask | 🚧 Planejado |
| `AI_PROMPTS.md` | Prompts do Llama 3.3 para extração de dados | ✅ Implementado |

---

## 🚀 Arquitetura do Sistema

### Backend (Python/Flask)
O backend foi refatorado para uma arquitetura orientada a serviços e modelos fortes:

- **Models (`pmo_bot/models/`)**: Uso de **Pydantic** para validação rigorosa de dados.
  - `records.py`: Modelos para registros de campo (Plantio, Manejo, Colheita).
  - `whatsapp.py`: Modelos para payloads do WhatsApp.
- **Services (`pmo_bot/services/`)**: Lógica de negócios isolada.
  - `notification_service.py`: Gerenciamento centralizado de notificações via WPPConnect.
- **Modules (`pmo_bot/modules/`)**: Handlers de banco de dados e processamento de IA.

### Frontend (React/MUI)
O frontend implementa o formulário completo do PMO dividido em seções:
- **Seções 1-18**: Componentes `SecaoX_MUI.jsx` implementados.
- **Diário de Campo**: Tabela dinâmica (`FieldDiaryTableV2`) para gestão de registros.
- **Padrão de UI**: Material UI com temas personalizados.

---

## � Início Rápido

### Para Desenvolvedores Backend

1. **Validação com Pydantic:**
   Sempre use os modelos para validar dados antes de processar.

   **Exemplo:**
   ```python
   from models.records import AtividadeItem

   # Validação automática de tipos e regras de negócio
   item = AtividadeItem(
       produto="ALFACE",
       quantidade=50.0,
       unidade="unid",
       local={"talhao": "T1", "canteiro": "C2"}
   )
   ```

2. **Envio de Notificações:**
   Use o `NotificationService` para enviar mensagens WhatsApp.

   **Exemplo:**
   ```python
   from services.notification_service import NotificationService

   service = NotificationService()
   service.enviar_mensagem("5511999999999", "Olá, produtor! Seu PMO foi atualizado.")
   ```

### Para Desenvolvedores Frontend

1. **Estrutura de Componentes:**
   Cada seção segue o padrão `SecaoX_MUI.jsx` e consome props `formData` e `onSectionChange`.

2. **Debug:**
   Utilize o `render_diffs` ou inspecione o console para verificar a propagação de mudanças no `form_data`.

---

## 🐛 Resolução de Problemas Comuns

### 1. "WPPConnect desconectado (404)"
**Causa:** Sessão caiu ou QR Code não foi lido.
**Solução:**
1. Reinicie o container `wppconnect-server`.
2. Acesse `http://localhost:21465/api/my-session/start-session` para gerar novo QR Code.
3. Escaneie com o app do WhatsApp.

### 2. "Erro de validação Pydantic"
**Erro:** `ValidationError: 1 validation error for AtividadeItem...`
**Solução:** Verifique se os tipos de dados enviados correspondem aos definidos em `models/records.py`. O sistema exige tipagem estrita (ex: float para quantidades).

---

## 📊 Status do Projeto

| Métrica | Valor Atual | Meta |
|---------|-------|------|
| Seções Backend Implementadas | Múltiplas | 18/18 |
| Seções Frontend Implementadas | 18/18 | 18/18 |
| Integração WhatsApp | ✅ Ativa | Ativa |
| Cobertura de Testes | Parcial | 80% |

**Última atualização automática:** 13/01/2026