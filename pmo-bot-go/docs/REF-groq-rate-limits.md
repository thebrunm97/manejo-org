# Groq API — Rate Limits (Referência)

> **Fonte:** <https://console.groq.com/docs/rate-limits>
> **Capturado em:** 2026-08-23

---

## 1. Unidades de Medida

| Sigla  | Significado              |
| ------ | ------------------------ |
| RPM    | Requests per minute      |
| RPD    | Requests per day         |
| TPM    | Tokens per minute        |
| TPD    | Tokens per day           |
| ASH    | Audio seconds per hour   |
| ASD    | Audio seconds per day    |
| ITPM   | Input tokens per minute  |
| OTPM   | Output tokens per minute |

- Limites aplicam-se **por organização**, não por usuário/API key individual.
- O primeiro limite atingido (RPM, TPM, etc.) é o que bloqueia — não importa se os outros ainda têm margem.
- **Cached tokens** (prompt caching) **não contam** para os limites.

---

## 2. Limites por Modelo (Developer Plan — base)

> Limites exatos variam; confirmar sempre em <https://console.groq.com/settings/limits>.

### Modelos usados no projeto

| Modelo                  | RPM | RPD   | TPM  | TPD   | ASH   | ASD    | Uso no projeto          |
| ----------------------- | --- | ----- | ---- | ----- | ----- | ------ | ----------------------- |
| `whisper-large-v3`      | 20  | 2K    | —    | —     | 7.2K  | 28.8K  | STT (transcrição áudio) |
| `whisper-large-v3-turbo`| 20  | 2K    | —    | —     | 7.2K  | 28.8K  | STT (alternativo)       |

> **Nota:** O modelo `llama-3.3-70b-versatile` (usado em `client.go`) **não aparece mais** na tabela pública de rate limits — pode estar deprecated ou com limites custom. Verificar na página de limites da org.

### Outros modelos (referência)

| Modelo                                  | RPM | RPD    | TPM  | TPD   |
| --------------------------------------- | --- | ------ | ---- | ----- |
| `groq/compound`                         | 30  | 250    | 70K  | —     |
| `groq/compound-mini`                    | 30  | 250    | 70K  | —     |
| `meta-llama/llama-prompt-guard-2-22m`   | 30  | 14.4K  | 15K  | 500K  |
| `meta-llama/llama-prompt-guard-2-86m`   | 30  | 14.4K  | 15K  | 500K  |
| `openai/gpt-oss-120b`                   | 30  | 1K     | 8K   | 200K  |
| `openai/gpt-oss-20b`                    | 30  | 1K     | 8K   | 200K  |
| `qwen/qwen3.6-27b`                      | 30  | 1K     | 8K   | 200K  |
| `canopylabs/orpheus-arabic-saudi`       | 10  | 100    | 1.2K | 3.6K  |
| `canopylabs/orpheus-v1-english`         | 10  | 100    | 1.2K | 3.6K  |

---

## 3. Headers de Rate Limit (HTTP Response)

Toda resposta da API inclui estes headers (valores ilustrativos):

| Header                           | Valor      | Escopo            | Notas                                    |
| -------------------------------- | ---------- | ----------------- | ---------------------------------------- |
| `x-ratelimit-limit-requests`     | `14400`    | **RPD** (por dia) | Limite total de requests no dia          |
| `x-ratelimit-limit-tokens`       | `18000`    | **TPM** (por min) | Limite total de tokens por minuto        |
| `x-ratelimit-remaining-requests` | `14370`    | **RPD**           | Requests restantes no dia                |
| `x-ratelimit-remaining-tokens`   | `17997`    | **TPM**           | Tokens restantes no minuto               |
| `x-ratelimit-reset-requests`     | `2m59.56s` | **RPD**           | Tempo até reset do contador de requests  |
| `x-ratelimit-reset-tokens`       | `7.66s`    | **TPM**           | Tempo até reset do contador de tokens    |
| `retry-after`                    | `2`        | —                 | **Só presente quando status = 429**      |

### Comportamento do `retry-after`

- **Só é setado** quando o rate limit é atingido (HTTP 429).
- Os demais headers (`x-ratelimit-*`) são **sempre incluídos** em toda resposta.

---

## 4. ITPM / OTPM (Limites Separados Input/Output)

Algumas organizações têm limites separados para tokens de input (ITPM) e tokens de output (OTPM), além do TPM combinado.

- Se configurado, aparece na [página de limites](https://console.groq.com/settings/limits) ao passar o mouse sobre o valor de TPM → mostra **"X in / Y out"**.
- Se não aparecer breakdown, a org tem apenas um TPM combinado.

---

## 5. Tratamento de 429 (Too Many Requests)

Quando o limite é excedido, a API retorna:
- **Status:** `429 Too Many Requests`
- **Header:** `retry-after: <segundos>` (tempo recomendado de espera)

### Estratégia recomendada

```
1. Ler o header `retry-after` da resposta 429
2. Aguardar exatamente esse tempo antes de retentar
3. Implementar exponential backoff como fallback
4. Monitorar `x-ratelimit-remaining-*` para throttle proativo
```

---

## 6. Aplicabilidade ao Projeto (pmo-bot-go)

### Status atual

| Componente                        | Arquivo                        | Retry? | Lê headers? |
| --------------------------------- | ------------------------------ | ------ | ------------ |
| Groq LLM Client (NER extraction)  | `internal/groq/client.go`     | ✅ Sim (backoff fixo 500ms) | ❌ Não |
| Groq STT (Whisper)                | `internal/groq/audio.go`      | A verificar | ❌ Não |
| Groq TTS (via OpenAI compat)      | `internal/tts/openai_compat.go`| A verificar | ❌ Não |

### Melhorias sugeridas (débito técnico)

1. **Ler `retry-after`** no handler de 429 em vez de usar backoff fixo
2. **Ler `x-ratelimit-remaining-tokens`** para implementar throttle proativo (ex: desacelerar quando < 20% restante)
3. **Emitir métricas** de rate limit hits para telemetria (`internal/telemetry/metrics.go`)
4. **Whisper:** Com RPM=20 e ASH=7.2K, considerar queueing agressivo nos horários de pico

### Limites críticos para o projeto

| Recurso                | Limite          | Risco                                   |
| ---------------------- | --------------- | --------------------------------------- |
| Whisper RPM            | **20 req/min**  | Alto — áudios de vários agricultores simultâneos podem bater fácil |
| Whisper ASD            | **28.8K seg/dia**| ~8h de áudio/dia — suficiente para operação atual |
| LLM RPD (se llama-3.3) | Verificar       | Modelo pode estar com limites custom    |

---

## 7. Links Úteis

- [Página de Limites (org)](https://console.groq.com/settings/limits)
- [Planos e Billing](https://console.groq.com/settings/billing/plans)
- [Batch Processing](https://console.groq.com/docs/batch) — alternativa para workloads não-real-time
- [Flex Processing](https://console.groq.com/docs/flex) — preços menores com latência variável
- [Prompt Caching](https://console.groq.com/docs/prompt-caching) — tokens cacheados **não contam** para rate limits
