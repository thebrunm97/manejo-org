# 🔌 Contratos de Integração - PMO Bot

> Especificação HTTP para integrações externas

---

## 📱 WPPConnect Server

**Base URL**: `http://localhost:21465`  
**Sessão**: `NERDWHATS_AMERICA`  
**Autenticação**: Bearer Token (`WPP_TOKEN` no `.env`)

---

### 1. Webhook de Mensagens (Recebimento)

O WPPConnect envia mensagens para o bot via webhook.

**Endpoint do Bot**: `POST /webhook`  
**Content-Type**: `application/json`

#### Payload Recebido
```json
{
  "event": "onmessage",
  "from": "5531999999999@c.us",
  "fromMe": false,
  "id": "3EB0XXXXXXXXXXXX",
  "type": "chat",
  "body": "Colhi 20kg de tomate hoje",
  "chatId": "5531999999999@c.us",
  "timestamp": 1736679692
}
```

#### Campos Importantes
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `event` | string | Tipo de evento. Processa apenas `onmessage` |
| `from` | string | ID do remetente (`phone@c.us` ou `phone@lid`) |
| `fromMe` | boolean | Ignorar se `true` (mensagem própria) |
| `id` | string | ID único da mensagem (usado para baixar mídia) |
| `type` | string | `chat` (texto), `ptt` (áudio), `audio` |
| `body` | string | Conteúdo texto (vazio se áudio) |

#### Respostas do Bot
| Status | Body | Significado |
|--------|------|-------------|
| `200` | `{"status": "ignored"}` | Mensagem própria ou evento não processado |
| `200` | `{"status": "linked"}` | Código de vinculação aceito |
| `200` | `{"status": "unauthorized"}` | Usuário não cadastrado |
| `200` | `{"status": "no_pmo"}` | Usuário sem PMO ativo |
| `200` | `{"status": "greeting"}` | Saudação respondida |
| `200` | `{"status": "blocked"}` | Ação bloqueada por compliance |
| `200` | `{"status": "success"}` | Registro salvo com sucesso |

---

### 2. Envio de Mensagens

Envia resposta para o usuário no WhatsApp.

**Endpoint**: `POST /api/{session}/send-message`  
**Headers**: `Authorization: Bearer {WPP_TOKEN}`

#### Request
```json
{
  "phone": "5531999999999@c.us",
  "message": "✅ Registro Salvo!\n🚜 Atividade: Colheita\n📝 Colhi 20kg de tomate hoje",
  "isGroup": false
}
```

#### Response (Sucesso)
```json
{
  "status": "success",
  "response": {
    "id": "true_5531999999999@c.us_3AXXXX"
  }
}
```

---

### 3. Download de Mídia (Áudio)

Baixa arquivo de áudio para transcrição.

**Endpoint**: `GET /api/{session}/get-media-by-message/{messageId}`  
**Headers**: `Authorization: Bearer {WPP_TOKEN}`

#### Response
- **Content-Type**: `text/plain` (Base64)
- **Body**: String Base64 do arquivo OGG

#### Processamento
```python
# Pode vir com prefixo data:audio/ogg;base64,...
if "base64," in dados:
    dados = dados.split("base64,")[1]

# Salvar como .ogg
with open(f"temp_{message_id}.ogg", "wb") as f:
    f.write(base64.b64decode(dados))
```

---

### 4. Verificação de Sessão (Opcional)

**Endpoint**: `GET /api/{session}/check-connection-session`  
**Headers**: `Authorization: Bearer {WPP_TOKEN}`

#### Response
```json
{
  "status": true,
  "session": "NERDWHATS_AMERICA",
  "message": "Connected"
}
```

---

## 🗄️ Supabase

**Base URL**: `https://{project}.supabase.co`  
**Autenticação**: API Key (`SUPABASE_KEY`)  
**Client**: `supabase-py`

---

### Tabelas Utilizadas

#### 1. `profiles` (Leitura)
Perfis de usuário para vinculação.

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | uuid | PK, FK para `pmos.user_id` |
| `nome` | text | Nome do produtor |
| `telefone` | text | WhatsApp (`phone@c.us`) |
| `pmo_ativo_id` | bigint | FK para PMO ativo |
| `codigo_vinculo` | text | Código 6 chars para pareamento |

**Queries**:
```python
# Buscar por telefone
supabase.table("profiles").select("id, nome, pmo_ativo_id").eq("telefone", phone)

# Vincular telefone
supabase.table("profiles").update({"telefone": phone, "codigo_vinculo": None}).eq("id", user_id)
```

---

#### 2. `pmos` (Leitura/Escrita)
Planos de Manejo Orgânico com dados JSONB.

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | bigint | PK |
| `user_id` | uuid | FK para `profiles.id` |
| `form_data` | jsonb | Dados do formulário (18 seções) |
| `status` | text | RASCUNHO, CONCLUÍDO |

**Queries**:
```python
# Buscar form_data
supabase.table("pmos").select("form_data").eq("id", pmo_id).single()

# Atualizar form_data
supabase.table("pmos").update({"form_data": form_data}).eq("id", pmo_id)

# PMO mais recente do usuário
supabase.table("pmos").select("id").eq("user_id", user_id).order("created_at", desc=True).limit(1)
```

---

#### 3. `caderno_campo` (Escrita)
Log de todas as atividades registradas.

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | uuid | PK (auto) |
| `pmo_id` | bigint | FK |
| `talhao_id` | int | FK para talhões (opcional) |
| `tipo_atividade` | text | Plantio, Manejo, Colheita... |
| `produto` | text | Uppercase |
| `talhao_canteiro` | text | Localização texto livre |
| `data_registro` | timestamp | Data da atividade |
| `quantidade_valor` | float | Valor numérico |
| `quantidade_unidade` | text | kg, L, unid... |
| `observacao_original` | text | Texto original + alertas |
| `detalhes_tecnicos` | jsonb | Subtipo, dosagem, etc. |
| `secao_origem` | text | `wppconnect` |

**Insert**:
```python
supabase.table("caderno_campo").insert({
    "pmo_id": pmo_id,
    "talhao_id": talhao_id,  # Opcional, se encontrar match
    "tipo_atividade": "Manejo",
    "produto": "CALDA BORDALESA",
    # ...
})
```

---

#### 4. `talhoes` (Leitura)
Áreas/parcelas georreferenciadas.

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | int | PK |
| `pmo_id` | bigint | FK |
| `nome` | text | Nome do talhão |
| `status_certificacao` | text | Certificado, Em Conversão, Não Orgânico |

**Queries**:
```python
# Listar talhões do PMO
supabase.table("talhoes").select("id, nome").eq("pmo_id", pmo_id)

# Verificar status
supabase.table("talhoes").select("status_certificacao").eq("pmo_id", pmo_id).ilike("nome", f"%{nome}%")
```

---

#### 5. `pmo_equipamentos` (Leitura)
Inventário de equipamentos para higienização.

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | int | PK |
| `user_id` | uuid | FK |
| `nome` | text | Nome do equipamento |
| `tipo_uso` | text | Categoria |
| `status_limpeza` | text | Último status |

---

#### 6. `pmo_manejo` (Leitura)
Planejamento de insumos permitidos.

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | int | PK |
| `pmo_id` | bigint | FK |
| `insumo` | text | Nome do insumo planejado |

**Query**:
```python
# Validar insumo planejado
supabase.table("pmo_manejo").select("id").eq("pmo_id", pmo_id).ilike("insumo", f"%{nome}%")
```

---

## 🤖 Groq API

**Base URL**: Via SDK `groq-python`  
**Autenticação**: API Key (`GROQ_API_KEY`)

---

### 1. Chat Completions (LLM)

Extração de dados estruturados.

```python
from groq import Groq

client = Groq(api_key=GROQ_API_KEY)

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": texto_usuario}
    ],
    temperature=0.0,
    max_tokens=600
)

# response.choices[0].message.content → JSON string
```

---

### 2. Audio Transcriptions (STT)

Transcrição de áudios em português.

```python
with open(caminho_ogg, "rb") as f:
    transcription = client.audio.transcriptions.create(
        file=(caminho_ogg, f.read()),
        model="whisper-large-v3",
        language="pt"
    )

# transcription.text → Texto transcrito
```

---

## 🔮 Backend Futuro (Planejado)

Quando o backend centralizado existir, o bot deverá:

1. **Autenticar** via JWT obtido do Supabase Auth
2. **Consultar catálogo** do produtor:
   - `GET /api/v1/pmos/{pmo_id}/catalogo`
   - Retorna produtos, insumos, talhões válidos
3. **Registrar atividade**:
   - `POST /api/v1/caderno`
   - Body: payload estruturado
4. **Validar compliance server-side**:
   - O backend aplica regras + audit trail

---

**Última atualização**: Janeiro 2026
