# Implementação de OpenRouter Prompt Caching

## Objetivo
Reduzir em até 90% o custo de tokens de input e a latência de chamadas à API implementando *Prompt Caching* e calculando seus custos corretamente no motor de pricing.

## Decisões Arquiteturais (Aprovadas no Socratic Gate)
1. **Pricing Engine:** Extensão estática do catálogo local (opção A), adicionando multiplicadores de cache (leitura/escrita) por modelo.
2. **Sticky Routing:** Suporte a `session_id` injetado pelo contexto do bot (opção A) para forçar o roteamento das requisições multi-turno para a mesma edge.
3. **Cache Breakpoints:** Implementação Top-Level Implícita (opção B) para manter o payload limpo, deixando a OpenRouter abstrair o *chunking* do cache.
4. **Controle de Raciocínio (Reasoning) por Tier:** Mapeamento dinâmico no `openai_adapter.go`. Clientes básicos recebem `effort: "none"` ou `"minimal"`, enquanto clientes Premium/Enterprise ativam capacidades avançadas (`"medium"` ou `"high"`), usando `exclude: true` para ocultar o raciocínio final do usuário e cortando custos nos planos gratuitos.

## Plano de Tarefas (Checklist)
- [x] **Task 1 (2026-08-23, parcial):** Multiplicadores de cache adicionados como tabela estática `cacheMultipliers` em `internal/pricing/pricing.go` (por prefixo de fornecedor OpenRouter), não como campos `CacheReadMultiplier`/`CacheWriteMultiplier` no catálogo gerado — decisão: o catálogo é auto-gerado por `cmd/pricing-refresh` a partir da API pública, que não devolve multiplicador de cache por modelo; a tabela estática já era a opção A aprovada.
- [x] **Task 2 (2026-08-23, parcial):** `pricing.CostWithCache(model, inputTokens, cachedReadTokens, cacheWriteTokens, outputTokens)` implementada e testada. **Não fez:** custo de tokens de reasoning não foi tratado à parte — eles já vêm incluídos em `completion_tokens`/`outputTokens` pela convenção da API, então já são cobrados no custo de saída existente; não há multiplicador de reasoning modelado no catálogo hoje. **Não fez:** alinhamento com `supabase/knowledge.go` — o `CostWithCache` ainda não é chamado por nenhum caminho de produção (ver nota abaixo).
- [x] **Task 3 (2026-08-23, parcial):** `cache_control: {type: ephemeral}` injetado em `openRouterTransport.RoundTrip` (`internal/gemini/client.go`), que é o transport real usado em produção — **não** em `internal/llm/openai_adapter.go`, que é um adapter alternativo não usado pelo pipeline principal (`main.go:184` confirma o provedor primário como Gemini direto + este client). `session_id`/sticky routing **não implementado**: exigiria propagar identidade de conversa (telefone) via `context.Context` até o transport, escopo maior que o resto desta frente — registrado como pendência no DT-37.
- [ ] **Task 4:** Não iniciada. Mapeamento de Tier de Usuário → Reasoning Effort pressupõe uma coluna de tier de usuário que **não existe** no schema hoje (confirmado: nenhuma tabela do projeto tem esse conceito, análogo ao que o DT-29 confirmou sobre `preferencia_resposta` antes de existir). É trabalho de produto (definir tiers) antes de ser trabalho de código.
- [x] **Task 5 (2026-08-23):** 3 testes novos em `pricing_test.go` cobrindo `CostWithCache`: cache read mais barato que fresco, sem duplicar contagem de tokens cacheados, e fornecedor sem multiplicador documentado não ganha desconto fantasma. Reasoning não testado à parte pelo motivo da Task 2.

**Nota de alcance (2026-08-23):** nenhum caminho de produção chama `CostWithCache` ainda — ela existe e está testada, mas `CalculateAICost`/`recordLog` (`internal/state/utils.go` e ~10 call sites) continuam usando `Cost` sem dados de cache, porque `RespostaAgnostica`/`UsoMetadados` não capturam `cached_tokens` da resposta da OpenRouter. Fechar esse fio é o próximo passo de valor real desta frente — vale tratar como sub-tarefa própria, não repetir aqui.

---

## Documentação de Referência (OpenRouter Prompt Caching)
*Documentação oficial capturada para guiar a implementação dos multiplicadores e cabeçalhos.*

### Multiplicadores Base
- **Anthropic**: Leitura `0.1x` | Escrita `1.25x` (5min TTL) ou `2.0x` (1h TTL).
- **Google Gemini 2.5**: Leitura `0.25x` | Escrita sem custo adcional além do preço normal de input + armazenamento.
- **OpenAI (>= GPT-5.6)**: Leitura `0.25x` ou `0.50x` | Escrita `1.25x`.
- **Grok**: Leitura `0.25x` | Escrita sem custo.
- **DeepSeek**: Leitura `0.1x` | Escrita sem custo.
- **Alibaba**: Leitura `0.1x` | Escrita `1.25x`.
- **Groq/Moonshot**: `0.5x` / `0.25x`.

### Configuração de Sticky Routing (Sessão)
O `session_id` pode ser enviado no Header (`x-session-id`) ou no Payload JSON raiz.
Limites: Máximo de 256 caracteres.
Expiração: 10 minutos de inatividade no provedor (cada requisição zera o timer).

```json
{
  "model": "anthropic/claude-sonnet-4",
  "session_id": "my-agent-session-abc123",
  "messages": [ ... ]
}
```

### Configuração de Cache Implícito (Top-level)
Funciona para provedores suportados (Anthropic, Google Vertex AI, Amazon Bedrock). A OpenRouter abstrai o uso no lado do Anthropic injetando implicitamente no breakpoint final.
```json
{
  "model": "anthropic/claude-sonnet-4",
  "cache_control": { "type": "ephemeral" },
  "messages": [ ... ]
}
```
*Para Gemini, a inserção top-level não se aplica exatamente, mas a OpenRouter cuida dos tokens cacheados de forma implícita no Gemini 2.5*.

### Detalhamento de Response Usage
A leitura da telemetria retornada na OpenRouter aparecerá dentro de `prompt_tokens_details`:
```json
{
  "usage": {
    "prompt_tokens": 10339,
    "completion_tokens": 60,
    "total_tokens": 10399,
    "prompt_tokens_details": {
      "cached_tokens": 10318,
      "cache_write_tokens": 0
    }
  }
}
```

---

## Documentação de Referência — Latência e Performance
*Documentação oficial capturada para guiar estratégias de performance no projeto.*

### Overhead Mínimo
A OpenRouter usa **Cloudflare Workers** (edge computing) para minimizar latência ao ficar o mais próximo possível da aplicação.
- Dados de usuário e API keys são cacheados na edge.
- Roteamento otimizado com processamento mínimo.

### Fatores que aumentam latência

| Fator | Causa | Mitigação no projeto |
|---|---|---|
| **Cache warming** | Primeiros 1-2 minutos em nova região. | Monitorar P95 de latência nas métricas de telemetria (`metrics.go`). |
| **Checagem de saldo** | Saldo baixo (< $10) força checagens adicionais no DB. | Manter auto-topup com threshold de $10-20. |
| **Fallback de modelo** | Se o provider primário falha, tenta o próximo. | Rastrear `provider_used` na telemetria para detectar padrões de fallback. |

### Best Practices da OpenRouter para Performance
1. **Manter saldo saudável**: Threshold recomendado de $10-20 para evitar credit checks no caminho quente.
2. **Usar Provider Preferences**: Configurar `provider.order` ou `provider.allow_fallbacks` para controlar latência vs. disponibilidade.

### Impacto no Projeto
O campo `provider_used` já rastreado na telemetria (`supabase/knowledge.go`) é a chave para detectar:
- Quando estamos pagando custo de fallback (provider ≠ preferido).
- Se o sticky routing está funcionando (mesmo provider em requests consecutivos de uma sessão).
- Correlação entre saldo da conta e P95 de latência.

---

## Documentação de Referência — Uptime e Disponibilidade
*Documentação oficial capturada. Código React do gráfico omitido — apenas a parte conceitual relevante.*

### Como funciona o monitoramento da OpenRouter
A OpenRouter monitora **em tempo real** todos os providers de IA rastreando:
- Tempos de resposta (latência)
- Taxa de erros
- Disponibilidade geral

Esses dados alimentam o roteamento inteligente: se um provider está com problemas, a OpenRouter desvia automaticamente para outro saudável — sem que o bot perceba.

### Disponibilidade com e sem roteamento
A OpenRouter exibe duas métricas distintas:

| Métrica | O que mede |
|---|---|
| **OpenRouter Availability** | Disponibilidade com o roteamento automático ativo (fallback incluído) |
| **Without Routing** | Disponibilidade bruta do provider, sem fallback |

A diferença entre as duas mostra **o quanto o roteamento inteligente está resgatando** requisições que teriam falhado.

### API de Uptime por Provider
É possível consultar a disponibilidade histórica de cada provider programaticamente via:
```
GET https://openrouter.ai/api/v1/endpoints
```
Documentado em: https://openrouter.ai/docs/api/api-reference/endpoints/list-endpoints

### Impacto no Projeto
O monitoramento de uptime da OpenRouter complementa o que já existe no bot:
- O campo `provider_used` na telemetria pode ser cruzado com dados de disponibilidade da API de endpoints.
- Em caso de spikes de erro, o bot pode consultar a API de endpoints para saber se o provider estava com problemas no período — ajudando a separar "bug no código" de "problema no provider".
- Candidato a uma nova métrica no dashboard: **taxa de fallback ativado** (quando `provider_used` ≠ provider configurado como preferido).

---

## Documentação de Referência — Tokens de Raciocínio (Reasoning)
*Documentação oficial capturada. Guia de implementação da API unificada de reasoning da OpenRouter.*

### Interface Unificada (`reasoning`)
A OpenRouter unifica a forma de pedir *reasoning* (pensamento/raciocínio) para todos os modelos suportados (OpenAI o1/o3, Anthropic, Gemini, DeepSeek, Qwen), independentemente de como a API nativa funciona.

```json
{
  "model": "your-model",
  "messages": [],
  "reasoning": {
    "effort": "high",       // Estilo OpenAI ("max", "xhigh", "high", "medium", "low", "minimal", "none")
    "max_tokens": 2000,     // Estilo Anthropic / Qwen
    "exclude": false,       // Padrão false. Se true, omite o raciocínio da resposta final.
    "enabled": true         // Liga com configurações padrão (medium/inferidas).
  }
}
```

### Como diferentes modelos reagem
- **Anthropic:** A API OpenRouter converte internamente para a nova API de *extended thinking* deles. O `max_tokens` dita o budget. Se enviar `effort`, a OpenRouter faz a conta matemática para derivar o `max_tokens` (onde "max"=95%, "high"=80%, etc). O limite máximo permitido pela Anthropic é 128k e mínimo 1024.
- **Gemini 3:** Mapeia diretamente o `effort` para o `thinkingLevel` da Google (minimal, low, medium, high).
- **DeepSeek/Grok:** Suportam a exclusão de tokens de reasoning (`exclude: true`).

### Preservando Contexto de Reasoning em Múltiplos Turnos e Tool Use
Se o modelo gerar *reasoning* e em seguida pedir o uso de uma tool (função), é crucial devolver o `reasoning_details` **intacto** para que ele não perca a linha de pensamento.

**Estrutura de Response (`reasoning_details`):**
A resposta virá com um array em `choices[0].message.reasoning_details`. Para manter o fluxo num contexto de ferramentas:

```json
[
  {"role": "user", "content": "Qual o clima em SP?"},
  {
    "role": "assistant",
    "content": null,
    "tool_calls": [...],
    "reasoning_details": [...] // PASSE ISTO DE VOLTA EXATAMENTE COMO VEIO
  },
  {"role": "tool", "tool_call_id": "...", "content": "{...}"}
]
```

### Impacto no Projeto
- O `openai_adapter.go` precisa ser atualizado para suportar o nó `"reasoning": {}` ao montar o request JSON, caso o usuário queira invocar capacidades *pro* de raciocínio.
- No parsing da resposta (OpenAI streaming ou sincrônico), o projeto deve estar pronto para ler o campo `reasoning_details` (ou `reasoning` no modo texto) e preservá-lo na memória da conversa se o bot fizer uso de *Tool Calls*.
- O cálculo de custo de pricing deve ser alertado: **tokens de reasoning são cobrados como output tokens** na imensa maioria dos modelos, mesmo que venham ocultos via `exclude: true`.

---

## Documentação de Referência — Structured Outputs
*Documentação oficial capturada para guiar a implementação de retornos estruturados (JSON Schema) via OpenRouter.*

### Visão Geral e Uso
A OpenRouter suporta *Structured Outputs* para modelos compatíveis, forçando as respostas a seguirem um formato de JSON Schema específico. Isso é útil para obter saídas consistentes e tipadas de forma confiável.

Para ativar, inclua o parâmetro `response_format` no request:

```json
{
  "messages": [
    { "role": "user", "content": "What's the weather like in London?" }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "weather",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "location": { "type": "string", "description": "City or location name" },
          "temperature": { "type": "number", "description": "Temperature in Celsius" }
        },
        "required": ["location", "temperature"],
        "additionalProperties": false
      }
    }
  }
}
```

### Funcionalidades e Boas Práticas
- **Suporte de Provider:** O suporte é por endpoint, não apenas por modelo. Pode mudar ao longo do tempo.
- **Strict Mode (`strict: true`):** Recomendado para que o provider force o schema nativamente (o suporte exato varia conforme o provider, podendo haver restrições nos recursos de JSON Schema permitidos).
- **Roteamento Seguro:** Para garantir suporte, pode-se exigir parâmetros (ex: configurar `require_parameters: true` nas preferências de provider, ou a OpenRouter usará o próprio campo `response_format` para filtrar apenas providers compatíveis).
- **Streaming Suportado:** Quando ativado com `stream: true`, o modelo retorna fragmentos de JSON parcial válidos, que compõem o JSON completo validado pelo schema ao final do stream.
- **Response Healing:** Para fluxos não-streaming, a OpenRouter oferece um plugin de *Response Healing* para corrigir eventuais falhas de formatação retornadas pelo modelo.

### Impacto no Projeto
- O struct de request da API no `openai_adapter.go` deverá suportar o campo `response_format` mapeando para a estrutura `type: "json_schema"`.
- A integração deve sempre buscar utilizar `strict: true` para garantir formatação previsível nas ferramentas do projeto (ex: extração de entidades ou parsing estruturado).
- Os fluxos que utilizarem *Structured Outputs* terão a lista de fallbacks reduzida àqueles provedores que suportam o formato. É preciso monitorar eventuais impactos de latência se os modelos primários estiverem indisponíveis.

---

## Documentação de Referência — Server Tools (Beta)
*Documentação oficial capturada para guiar a integração com as Server Tools da OpenRouter.*

### Visão Geral e Uso
*Server Tools* são ferramentas especializadas operadas pela própria OpenRouter que os modelos podem invocar durante uma requisição. Diferente das *User-Defined Tools* (onde o bot executa a ação localmente) e de *Plugins* (que rodam independentemente da IA em todas as requisições), as Server Tools são executadas no servidor da OpenRouter e a resposta volta diretamente para a IA, sem passar código pela nossa aplicação.

Elas são identificadas no array de `tools` com o prefixo `openrouter:*` e podem ser misturadas com ferramentas normais (`function`):
```json
{
  "model": "openai/gpt-4o",
  "messages": [...],
  "tools": [
    { "type": "openrouter:web_search" },
    { "type": "openrouter:datetime" },
    { "type": "function", "function": { "name": "user_tool", ... } }
  ]
}
```

### Principais Ferramentas Disponíveis
- **Utilitárias:** `openrouter:datetime` (Data e hora), `openrouter:image_generation` (Criar imagens a partir de texto).
- **Acesso Externo:** `openrouter:web_search` (Busca na web), `openrouter:web_fetch` (Ler conteúdo de sites).
- **Execução:** `openrouter:shell` (Comandos em sandbox, terminal) e `openrouter:apply_patch` (V4A diffs de arquivos).
- **Multi-Agente (Orquestração de IAs na Nuvem):** 
  - `openrouter:subagent`: Delega subtarefas a um modelo menor/rápido.
  - `openrouter:advisor`: Consulta um modelo "mais inteligente" no meio da tarefa.
  - `openrouter:fusion`: Usa um painel de múltiplos modelos e um analista final.

### Orçamento (Budgets) e Limites
O uso dessas ferramentas inicia um "loop de agente" interno na infraestrutura da OpenRouter.
- Para controlar gastos, você deve usar `max_tool_calls` (padrão 30) ou o avançado `stop_server_tools_when` no mesmo nível de `messages`.
- Ferramentas de multi-agente (como Subagent/Fusion) têm seus próprios orçamentos em `parameters.max_tool_calls`.
- O consumo dessas ferramentas é reportado na resposta final no nó `usage.server_tool_use`.

### Impacto no Projeto
- O struct de request de ferramentas do bot (`openai_adapter.go`) precisará permitir registrar ferramentas sem `function`, usando a flexibilidade do `type` (ex: `"type": "openrouter:web_search"`).
- **Super Poderes com Latência Zero:** Ao dar `openrouter:web_search` para o bot, ganharemos capacidade de pesquisa na web onde o tráfego ocorre quase instantaneamente nos servidores deles, sem onerar a rede ou memória da nossa aplicação.
- **Rastreio de Custos:** Será imprescindível estender o leitor de respostas e as structs em `internal/telemetry/metrics.go` (e `pricing.go`) para interceptar o objeto `usage.server_tool_use`, de forma a não "perdermos dinheiro" cobrando apenas os tokens do modelo principal, caso a OpenRouter tarife a execução das ferramentas ou dos sub-agentes ativados pelas ferramentas.

---

## Documentação de Referência — Tool Search (Beta)
*Documentação oficial capturada para guiar a integração do `openrouter:tool_search`.*

### Visão Geral e Uso
A funcionalidade *Tool Search* permite fornecer um catálogo massivo de ferramentas para o modelo sem pagar o custo de tokens de input por todas elas em cada requisição. O modelo as pesquisa e descobre "sob demanda".

Isso resolve dois problemas: o custo altíssimo de enviar dezenas de definições JSON em cada turno da conversa, e a queda de precisão do modelo (modelos erram mais ao ter que escolher a ferramenta certa em uma lista de 100 opções do que em uma lista de 5).

Para utilizar:
1. Inclua a ferramenta especial `{ "type": "openrouter:tool_search" }` no array de `tools`.
2. Nas suas ferramentas normais, adicione a flag `"defer_loading": true` naquelas que devem ficar "escondidas" até o modelo pesquisar por elas.

```json
{
  "model": "openai/gpt-4o",
  "messages": [...],
  "tools": [
    { "type": "openrouter:tool_search" },
    {
      "type": "function",
      "name": "get_weather",
      "defer_loading": true,
      "function": { ... }
    }
  ]
}
```

### Funcionalidades e Regras Claves
- **Busca via Expressão Regular (Regex):** O modelo fornece um regex que a OpenRouter testa contra os nomes, descrições, e parâmetros das ferramentas escondidas. Ex: pesquisar "weather" pode achar a ferramenta `get_weather`.
- **Conflito com `tool_choice`:** Você **não pode** forçar o uso de uma ferramenta específica (via `tool_choice`) ao mesmo tempo em que usa o Tool Search. Fazer isso gera erro HTTP 400. Só é permitido o uso de `{"type": "allowed_tools"}` ou omitir o campo.
- **Prompt Caching Preservado:** Descobrir novas ferramentas não destrói o contexto anterior, mantendo a eficiência do cache intacta a cada turno.

### Impacto no Projeto
- **Bloqueio Crítico de API:** O *Tool Search* **NÃO** é suportado pela API padrão de *Chat Completions* (`/api/v1/chat/completions`). Ele gera erro 400. Se quisermos utilizá-lo no futuro, nosso `openai_adapter.go` terá que ser refatorado para utilizar a *Responses API* ou a *Messages API* da OpenRouter.
- O mapeamento da struct de ferramenta (o `Tool` em Go) precisará de um novo campo booleano: ``DeferLoading bool `json:"defer_loading,omitempty"`` `.
- **Nomenclatura Padrão:** As ferramentas do nosso bot terão que passar por uma revisão de texto para garantir que os nomes têm prefixos bons (ex: `github_listar_issues`) e as descrições contêm as exatas palavras-chave que o modelo costuma pesquisar, para que a busca por regex funcione perfeitamente.

---

## Documentação de Referência — Fusion (Beta)
*Documentação oficial capturada para guiar a integração do `openrouter:fusion`.*

### Visão Geral e Uso
A funcionalidade *Fusion* é uma ferramenta de servidor que dá ao modelo primário a capacidade de criar um **conselho deliberativo de múltiplas IAs**. Quando o modelo julga que a pergunta é complexa, ele chama o `openrouter:fusion`. A OpenRouter dispara a mesma pergunta em paralelo para 3 (ou mais) modelos diferentes, um "modelo analista" lê as 3 respostas, compara tudo e devolve um relatório estruturado para o modelo primário formular a resposta final.

```json
{
  "tools": [
    {
      "type": "openrouter:fusion",
      "parameters": {
        "analysis_models": ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-1.5-pro"]
      }
    }
  ]
}
```

### Funcionalidades e Regras Claves
- **O Retorno (Análise Estruturada):** A ferramenta não devolve um texto jogado. O modelo analista devolve um JSON com: `consensus` (o que todos concordam), `contradictions` (onde divergem), `unique_insights` (sacadas únicas de um só modelo) e `blind_spots` (o que nenhum deles pensou).
- **Acesso à Web Embutido:** Todos os modelos no painel recebem automaticamente acesso a busca na web durante a deliberação.
- **Tolerância a Falhas:** Se 1 dos 3 modelos falhar ou cair por *rate limit*, o processo não quebra. A análise é feita com os que sobreviveram.

### Impacto no Projeto
- **Custo Multiplicado:** O principal impacto é financeiro. Uma única interação do usuário pode disparar 3 a 5 requisições pesadas (painel + analista) nos bastidores. 
- Assim como o *Tool Search*, a OpenRouter alerta que o uso no endpoint `/chat/completions` (que usamos) funciona, mas é mais lento que nas novas APIs deles (*Responses API*). Monitorar latência é crucial.

---

## Documentação de Referência — Advisor (Beta)
*Documentação oficial capturada para guiar a integração da Server Tool `openrouter:advisor`.*

### Visão Geral e Uso
A ferramenta `openrouter:advisor` permite que um modelo (mesmo que seja um modelo rápido e barato) consulte um **modelo conselheiro** de maior inteligência no meio de sua própria geração. Quando o modelo primário chega num ponto de decisão crítico (ex: antes de finalizar uma arquitetura de código ou avaliar risco), ele chama a ferramenta. O conselheiro processa, devolve a sugestão, e o modelo primário retoma a resposta a partir daquela ajuda.

```json
{
  "tools": [
    {
      "type": "openrouter:advisor",
      "parameters": {
        "name": "reviewer",
        "model": "~anthropic/claude-3.5-sonnet",
        "instructions": "Você é um revisor de arquitetura sênior. Ache falhas na modelagem."
      }
    }
  ]
}
```

### Funcionalidades e Regras Claves
- **Múltiplos Conselheiros:** É possível passar vários `openrouter:advisor` no array de `tools` (cada um com um `name` obrigatório e único). O modelo primário escolhe com qual conselheiro deseja falar.
- **Memória de Longo Prazo:** Se o histórico do chat com as chamadas das ferramentas for preservado e re-enviado nos próximos turnos, o conselheiro recupera seu próprio histórico e deliberações anteriores, sem que o modelo primário precise repetir tudo.
- **Encaminhamento de Transcrição (`forward_transcript`):** Pode ser ativado (`true`) para enviar toda a conversa original do usuário direto para o conselheiro, não apenas o prompt pontual que o modelo primário enviou.

### Impacto no Projeto
- A *Struct* que enviamos na request terá que suportar o objeto `parameters` dentro da declaração da tool.
- Na nossa estratégia de **Otimização Agnóstica de IA**, caso o provedor principal continue sendo o Gemini via SDK nativo (que não possui o conceito de Server Tools), devemos expor localmente uma função `consultar_advisor_especialista`. Quando o Gemini a invoca, nosso backend orquestra a chamada de forma assíncrona para um LLM robusto na OpenRouter (usando a cota premium) e injeta a resposta de volta no pipeline do Gemini. Assim, atingimos exatamente o mesmo efeito preservando o Gemini como o motor mais ágil da linha de frente.

---

## Documentação de Referência — Subagent (Beta)
*Documentação oficial capturada para guiar a integração da Server Tool `openrouter:subagent`.*

### Visão Geral e Uso
Enquanto o *Advisor* delega uma dúvida complexa para um modelo "maior", a ferramenta `openrouter:subagent` delega tarefas auto-contidas e mecânicas para um **modelo trabalhador** menor, mais rápido e mais barato no meio da geração. Quando o modelo primário precisa de algo que não exija toda a sua inteligência (resumir um documento longo, extrair dados, formatar texto), ele invoca essa tool com um `task_name` e uma `task_description`. O worker processa, devolve o `outcome`, e o primário continua.

```json
{
  "tools": [
    {
      "type": "openrouter:subagent",
      "parameters": {
        "model": "~anthropic/claude-3-5-haiku-latest",
        "instructions": "Você é um formatador rápido. Apenas obedeça as instruções sem adicionar conversa."
      }
    }
  ]
}
```

### Funcionalidades e Regras Claves
- **Isolamento Total:** Diferente do Advisor, o Subagent **não tem memória** do chat principal. Ele enxerga apenas o que o modelo primário escreve dentro da `task_description`. O primário deve passar todo o contexto necessário.
- **Sub-Tools (Workers com Tools próprias):** É possível passar um array de `tools` dentro dos parâmetros do subagent. Isso cria um mini-agente que pode até usar a ferramenta de busca (`openrouter:web_search`) antes de devolver o resultado ao modelo primário.
- **Herança de Funções (Experimental):** Pode herdar as funções locais declaradas no escopo do primário (`inherit_functions: true`), permitindo que o sub-agente também acesse os bancos de dados/APIs (desde que usemos a *Responses API* da OpenRouter, caso contrário gera erro).

### Impacto no Projeto
- Traz uma inversão de custo valiosa. Se o modelo principal for caro, ele pode delegar o trabalho braçal ("analise esses 3 JSON gigantes e me dê as métricas") para um modelo barato, preservando tokens.
- Na arquitetura de **Otimização Agnóstica de IA**, mapeamos isso no backend criando uma ferramenta local `delegar_subtarefa`. Quando o Gemini aciona, abrimos uma goroutine, batemos num modelo mais leve e barato (ex: Llama 3 8B / Gemini 8B Flash), e passamos o retorno, isolando completamente o roteamento do provedor e economizando recursos.

---

## Documentação de Referência — Sensitive Info Guardrail
*Documentação oficial capturada para guiar a implementação de proteção de dados pessoais (PII/LGPD) via OpenRouter.*

### Visão Geral e Uso
A OpenRouter oferece um guardrail nativo de **Informação Sensível** que escaneia automaticamente o conteúdo de entrada (prompts, argumentos de tool calls) **antes** de a requisição chegar ao provedor de modelo. É uma camada de defesa em profundidade contra vazamento de dados pessoais para LLMs de terceiros.

Quando um dado sensível é detectado, duas ações são possíveis:
- **Redact:** O dado é substituído por um placeholder rotulado (ex: `[EMAIL]`, `[PHONE]`, `[PERSON_NAME]`) e a requisição segue sanitizada.
- **Block:** A requisição inteira é rejeitada com HTTP `403 Forbidden`.

### Métodos de Detecção

| Método | Tipo de Dado | Latência |
|--------|-------------|----------|
| **Regex** | Email, telefone, CPF/SSN, cartão de crédito, IP | Desprezível |
| **NLP (Presidio)** | Nomes de pessoas (beta), endereços geográficos (beta) | Proporcional ao tamanho do input |

### Presets Nativos

| Preset | Slug da API | Label de Redação | Exemplo |
|--------|-------------|------------------|---------|
| Email | `email` | `[EMAIL]` | `usuario@fazenda.com.br` |
| Telefone | `phone` | `[PHONE]` | `(11) 99999-8888` |
| CPF/SSN | `ssn` | `[SSN]` | `123.456.789-00` |
| Cartão de crédito | `credit-card` | `[CREDIT_CARD]` | `4265 5256 0839 8752` |
| Endereço IP | `ip-address` | `[IP_ADDRESS]` | `192.168.0.1` |
| Nome de pessoa (beta) | `person-name` | `[PERSON_NAME]` | `João Silva`, `Maria Garcia` |
| Endereço (beta) | `address` | `[ADDRESS]` | `Rua das Palmeiras 123, Goiânia` |

### Padrões Customizados (Custom Patterns)
Além dos presets, é possível definir regex customizados para dados específicos do domínio:

```json
{
  "content_filters": [
    { "pattern": "\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}", "action": "redact", "label": "CPF" },
    { "pattern": "PROJ-\\d{4,6}", "action": "redact", "label": "Código de Projeto" },
    { "pattern": "AKIA[0-9A-Z]{16}", "action": "block", "label": "AWS Key" }
  ]
}
```

### Hierarquia de Guardrails
- Filtros de múltiplos guardrails são **unidos** (merge): se um guardrail filtra email e outro filtra telefone, ambos se aplicam.
- **Block vence Redact**: se o mesmo tipo de dado aparece em guardrails com ações diferentes, a mais restritiva (block) prevalece.
- Filtros custom e built-in combinam livremente.

### Impacto no Projeto — LGPD e Compliance

Este guardrail é **crítico para conformidade com a LGPD** (Lei Geral de Proteção de Dados, Lei 13.709/2018). No contexto do PMO-bot:

1. **Produtores rurais enviam dados pessoais pelo WhatsApp constantemente** — nomes, CPFs, endereços de propriedades, telefones de contato. Sem sanitização, esses dados são enviados como parte do prompt para provedores de LLM nos EUA/Europa (OpenRouter → Anthropic/OpenAI/Google), o que configura transferência internacional de dados pessoais sem base legal adequada.

2. **Implementação imediata para o tráfego OpenRouter (~16% fallback + avaliador RAG):** Ativar os presets `email`, `phone`, `ssn` (CPF), `person-name` e `address` com ação `redact` (não `block`, para não quebrar o fluxo do produtor). Adicionar um custom pattern para CPF brasileiro (`\d{3}\.\d{3}\.\d{3}-\d{2}`).

3. **Implementação agnóstica para o tráfego Gemini (~84% primário):** O SDK nativo do Google não oferece esse guardrail automaticamente. Precisamos implementar um **middleware de sanitização local** (`internal/middleware/pii_sanitizer.go`) que rode regex + opcionalmente um NER leve (ex: spaCy ou Presidio via sidecar) antes de montar o prompt para o Gemini. Os mesmos patterns do OpenRouter devem ser reutilizados para manter paridade.

4. **Telemetria de compliance:** Registrar em `internal/telemetry/metrics.go` um contador `PIIRedactionTotal` por tipo de dado (`email`, `phone`, `cpf`, `name`, `address`) para auditoria e relatório de conformidade LGPD. Isso permite responder à ANPD (Autoridade Nacional de Proteção de Dados) com dados concretos sobre quantos dados foram sanitizados e em que volume.
