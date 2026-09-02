# PLAN-rag-ingestion-unification

> **Status:** 🟢 **CONCLUÍDO (2026-09-02)** — Fases 1-5 implementadas e verificadas: script
> adaptado, validado em Postgres local, ingestão real dos 17 PDFs rodada contra produção,
> retrieval real confirmado via `match_documents_with_context`, pipeline antigo removido como
> código morto. `L10831.pdf` (PDF puramente escaneado) inicialmente ficou de fora por falta de
> camada de texto; um fallback automático de OCR (`ocrmypdf`/Tesseract via Docker) foi
> adicionado ao script no mesmo dia, cobrindo esse caso e qualquer PDF escaneado futuro —
> **total final: 17 de 17 documentos, 847 chunks em produção.** Fase 6 (fate de
> `knowledge_chunks`/`match_farm_documents`) deliberadamente não executada — ver nota ao final
> do documento. A pergunta original do **DT-07** ("aposentar
> `rag_ingest.py` (Docling) em favor do `cmd/ingestor`, ou manter os dois?") partia de uma
> premissa errada — os dois nunca foram alternativas, eram estágios de um único pipeline
> morto. A investigação revelou um problema bem maior, registrado aqui. · **Data:** 2026-09-02 ·
> **Rastreio:** DT-07 · **Componentes:** `scripts/rag_ingest.py`, ~~`pmo-bot-go/scripts/rag_ingest.py`~~,
> ~~`pmo-bot-go/cmd/ingestor/`~~ (removidos), tabela `farm_documents`, tabela `knowledge_chunks`,
> `internal/supabase/client.go` (`GetEmbedding`, `UpsertFarmDocumentChunks`)

## 🎯 Objetivo

Ter **um** pipeline de ingestão de RAG, escrevendo na **única** tabela que a ferramenta
`consultar_base_conhecimento` de fato consulta, com o extrator de PDF que não corrompe
acentuação em Português — e fechar a lacuna de conteúdo que isso expõe: hoje **nenhum dos 17
PDFs da base de conhecimento é pesquisável pelo bot**.

## 🛑 Problema

O repositório tem **duas linhas de ingestão de RAG paralelas, desconectadas, e usando
modelos de embedding diferentes** — nenhuma documentação amarrava as duas antes desta
investigação, e cada uma foi construída/mantida sem saber da outra.

### Linha A — a que funciona hoje, com o extrator ruim

```
pmo-bot-go/scripts/rag_ingest.py (Docling)
        │  gera <nome>_chunks.json localmente
        ▼
pmo-bot-go/cmd/ingestor/main.go (Go)
        │  lê os *_chunks.json de pmo-bot-go/docs/knowledge_base/
        │  embedding via OpenRouter, modelo baai/bge-m3 (1024d)
        │  internal/supabase/client.go: GetEmbedding() → UpsertFarmDocumentChunks()
        ▼
tabela farm_documents (embedding_1024)
        ▲
        │  consultada por
match_documents_with_context (RPC) ← chamada por handleConsultarBaseConhecimento
```

Esta é a linha **ativa de verdade**: `match_documents_with_context` (a RPC que a tool
`consultar_base_conhecimento` chama) faz `SELECT ... FROM farm_documents WHERE 1 -
(fd.embedding_1024 <=> query_embedding) > match_threshold` — só olha para
`farm_documents.embedding_1024`. **Correção (verificado em 2026-09-02, ao começar a
implementação):** as 33 linhas/2 documentos que a auditoria inicial contou como "indexados"
são **dados de teste** (`integration_test_doc.pdf`, `obs_test.pdf`) — nenhum PDF real da base
de conhecimento está lá. A lacuna real é **0 de 17 documentos**, não 15 de 17.

O extrator (Docling) tem o bug documentado no
[ADR-007](../../docs/architecture/adr/007-pdf-extraction-pymupdf.md): PDFs com fontes CID
(comum em publicações Embrapa/MAPA pré-2018, geradas com InDesign/LaTeX) saem com acentos
corrompidos (`evapotranspirao`, `irriga??o`). E **`cmd/ingestor` está órfão na prática**:
não existe nenhum arquivo `*_chunks.json` em `pmo-bot-go/docs/knowledge_base/` hoje —
ninguém rodou o Docling recentemente para gerá-los.

### Linha B — a "nova" do ADR-007, com o extrator bom, mas escrevendo no vazio

```
scripts/rag_ingest.py (raiz, PyMuPDF — sem o bug de acentuação)
        │  extrai texto, chunka (LangChain), extrai metadados via Gemini
        │  embedding via Gemini, modelo gemini-embedding-001 (3072d)
        ▼
tabela knowledge_chunks
        ▲
        │  consultada por
match_chunks (RPC) ← REMOVIDA no DT-46 (2026-09-02) por zero chamadores no Go
```

`knowledge_chunks` está com **zero linhas em produção hoje**, mesmo o ADR-007 relatando 139
chunks validados em 2026-07-24 (arquivo de evidência arquivado em
`_archive/logs/chunk_verify.txt`, checkpoint em `_archive/dumps/ingest_checkpoint.json`) — a
prova de conceito rodou uma vez, gerou dado em algum banco (local ou um projeto que não é o
`hejewayflbuemnffrhae` de hoje), e nunca foi ligada ao caminho de consulta real do bot. Achado
no mesmo dia desta investigação (DT-46): `match_chunks`, a única RPC que lia
`knowledge_chunks`, não tinha nenhum chamador no código Go e foi removida como código morto —
sem que se soubesse, no momento da remoção, que ela era a outra metade deste pipeline órfão.

### A lacuna que isso expõe

`pmo-bot-go/docs/knowledge_base/` tem **17 PDFs reais** — normas do MAPA (IN, INI, INC,
Decreto, Portaria), guias técnicos de manejo de pragas/doenças. `farm_documents` (a tabela
que o bot consulta) só tem `integration_test_doc.pdf`/`obs_test.pdf` — **dados de teste**,
não conteúdo real. Nenhum dos 17 foi processado pela linha A (não há `_chunks.json` para
eles) nem pela linha B (que aponta para outra tabela). Um produtor perguntando sobre
qualquer norma da base de conhecimento recebe uma resposta que não usa o conteúdo real — o
bot não tem como saber que a informação existe.

## 🧭 Decisão de arquitetura

**Unificar em `farm_documents`, usando o extrator do ADR-007 (PyMuPDF) com o espaço vetorial
que já está em uso (OpenRouter/bge-m3, 1024d).**

Alternativas descartadas:

- **Reverter para o pipeline Docling + Go.** Reintroduziria o bug de acentuação que o
  ADR-007 já investigou, comprovou e corrigiu — descartado sem ressalva.
- **Manter as duas linhas**, arrumando `match_documents_with_context` (ou uma nova RPC) para
  também consultar `knowledge_chunks` via `UNION ALL`. Tecnicamente possível, mas dobra a
  manutenção (dois extratores, dois modelos de embedding, duas tabelas) sem nenhum ganho —
  nenhuma das duas linhas faz nada que a outra não possa fazer depois da unificação. Só faria
  sentido se alguma razão exigisse Gemini especificamente para embeddings (não há: o
  `EMBEDDING_PINNED_PROVIDER`/bge-m3 já é o padrão vivo do projeto, usado também pelos
  embeddings de PMO/insumos via `GetEmbedding`).
- **Migrar tudo para Go** (a opção "(a)" da formulação original do DT-07). Reescreveria em Go
  a extração de PDF (PyMuPDF não tem binding Go direto — a alternativa mais próxima,
  `github.com/gen2brain/go-fitz`, precisa de cgo e da libmupdf instalada no sistema),
  chunking semântico e extração de metadados via LLM — trabalho real sem benefício
  correspondente, já que o script Python já faz isso corretamente e roda como job pontual
  (não como parte do runtime do bot, onde a fronteira Go-only faria mais sentido).

Por que **não** manter `embedding` (a coluna legada 3072d) em vez de `embedding_1024`:
`match_documents_with_context` só olha `embedding_1024` — gravar na coluna legada não
resolveria a lacuna de consulta, só voltaria a alimentar uma coluna que nada lê (o mesmo
defeito que motivou remover `InsertFarmDocument` no DT-02).

## ⚙️ Mecanismo

Adaptar `scripts/rag_ingest.py` (raiz — o script correto do ADR-007) em dois pontos, mantendo
intacto tudo o que já funciona bem nele (extração PyMuPDF, limpeza de texto, chunking
LangChain, checkpoint por hash de arquivo, metadados via Gemini com fallback OpenRouter):

1. **Trocar a chamada de embedding** de `gemini.models.embed_content` (3072d) para uma
   chamada HTTP a `POST https://openrouter.ai/api/v1/embeddings`, replicando exatamente o
   contrato de `internal/supabase/client.go:GetEmbedding` (`model: "baai/bge-m3"`, `provider:
   {order: [EMBEDDING_PINNED_PROVIDER ou "DeepInfra"], allow_fallbacks: false}`, header
   `Authorization: Bearer $OPENROUTER_API_KEY`). Isso garante que os embeddings novos caiam
   no **mesmo espaço vetorial** que o bot já usa para consultar `farm_documents` — misturar dois modelos de
   embedding na mesma coluna quebraria a similaridade de cosseno de forma silenciosa (chunks
   de modelos diferentes não são comparáveis, mesmo com a mesma dimensão).

2. **Trocar o destino de gravação** de `sb.table("knowledge_chunks").insert(...)` /
   `sb.table("knowledge_documents").upsert(...)` para um único
   `POST /rest/v1/farm_documents?on_conflict=chunk_hash` com header
   `Prefer: resolution=merge-duplicates` (o mesmo upsert que `UpsertFarmDocumentChunks` já
   faz em Go — replicável direto em `requests`, sem precisar do SDK `supabase-py` para este
   passo). Payload por chunk, batendo com as colunas reais de `farm_documents` (confirmado ao
   vivo): `pmo_id` (sempre `null` — documento institucional global), `document_name`,
   `content`, `embedding_1024`, `chunk_hash`, `chunk_index`, `source_document_id`. A tabela
   **não tem** coluna `heading_path` — o campo equivalente do Go (`HeadingPath`) já é hoje um
   no-op silencioso (PostgREST ignora chave sem coluna correspondente); PyMuPDF não produz
   essa informação estrutural mesmo, então não há perda nova aqui.

O `chunk_hash` já é `sha256(document_name + chunk_index + content)` no lado Go
(`generateHash` em `cmd/ingestor/main.go`) — replicar a mesma fórmula em Python garante que
uma reingestão futura (`--force` ou incremental) faça upsert em cima do que já existe, em vez
de duplicar linhas.

`knowledge_documents` (a tabela auxiliar de metadados que a linha B mantinha) não tem
equivalente em `farm_documents` — os metadados extraídos via Gemini (`titulo`, `autor`,
`ano`, `instituicao`) deixam de ser persistidos numa tabela própria. Se isso for necessário
depois (rastreabilidade de fonte, por exemplo), é uma decisão separada — não bloqueia a
unificação em si, e nenhum código hoje lê `knowledge_documents`.

## 📋 Plano de implementação

**Fase 1 — Adaptar o script.** Editar `scripts/rag_ingest.py`: nova função
`get_embeddings_bge_m3(texts)` substituindo a chamada Gemini em `get_embeddings`; nova função
`upsert_farm_documents(records)` substituindo `upsert_document_record` +
`sb.table("knowledge_chunks").insert`; `chunk_hash` calculado com a mesma fórmula do Go.
Requer `OPENROUTER_API_KEY` no `.env`/`.env.prod` (já existe, usado pelo bot). Sem mudança no
extrator, na limpeza de texto, no chunking ou no checkpoint — só a ponta final do pipeline
(embedding + gravação) muda de alvo.

**Fase 2 — Validar contra Postgres local.** Rodar `python scripts/rag_ingest.py` (sem
`--force`) contra o Supabase local (`supabase start`) com 1-2 PDFs de teste, confirmar que
`farm_documents` recebe linhas com `embedding_1024` de 1024 posições e que uma consulta via
`match_documents_with_context` (mesma RPC que o bot usa) de fato encontra os chunks novos.
Zero risco para produção nesta fase.

**Fase 3 — Ingerir os 17 PDFs reais.** Com o script validado, apontar
`INPUT_DIR`/`knowledge_repo` para `pmo-bot-go/docs/knowledge_base/` (ou copiar os 17 PDFs
para lá) e rodar contra produção. Decisão do responsável antes de disparar — grava dado real
em produção. Confirmar ao final: `SELECT count(DISTINCT document_name) FROM farm_documents
WHERE document_name NOT LIKE '%test%'` deve ir de 0 para (até) 17, dependendo de quantos já
não têm conteúdo extraível (páginas sem camada de texto — improvável nesses documentos, mas
o script já loga e pula).

**Fase 4 — Teste de retrieval real.** Perguntar ao bot, via WhatsApp ou o *playground* de RAG
do painel admin, sobre um tema coberto por um dos 17 documentos recém-indexados (ex: uma
instrução normativa específica) e confirmar que a resposta cita conteúdo real do documento —
não só que a ingestão rodou sem erro. Mesma lição do DT-31 e do DT-59: build/insert limpo não
prova que a experiência funciona.

**Fase 5 — Remover o pipeline antigo como código morto.** Só depois da Fase 4 confirmada:
apagar `pmo-bot-go/scripts/rag_ingest.py` (Docling) e `pmo-bot-go/cmd/ingestor/` (Go, sem mais
nenhum produtor de `*_chunks.json`). Atualizar `docs/architecture/adr/007-pdf-extraction-pymupdf.md`
com uma nota de que o script passou a escrever em `farm_documents`/bge-m3 em vez de
`knowledge_chunks`/Gemini. Fechar o DT-07 no board apontando para este arquivo.

**Fase 6 (opcional, separada) — Decidir o destino de `knowledge_chunks`.** Com zero linhas e
zero consumidor depois da unificação, a tabela em si vira candidata a remoção (mesmo padrão
do DT-47) — mas isso é uma migration de schema à parte, não bloqueia nem depende das fases
1-5.

## ⚠️ Riscos e mitigações

- **As 33 linhas de teste existentes (`integration_test_doc.pdf`, `obs_test.pdf`) não
  colidem com a reingestão real.** `document_name` diferente de qualquer um dos 17 PDFs
  reais, então o upsert por `on_conflict=chunk_hash` nunca as toca. Ficam soltas na tabela —
  limpeza opcional, não bloqueia nada aqui.
- **Custo de embedding.** 17 documentos, ordem de centenas de chunks — múltiplas chamadas a
  OpenRouter/bge-m3. Custo baixo por chamada, mas medir antes de rodar contra produção (a
  Fase 2 já usa PDFs de teste pequenos justamente para isso).
- **Rate limit da OpenRouter** durante uma reingestão de 17 documentos de uma vez — o script
  já tem retry com backoff para embeddings (`get_embeddings`); a extração de metadados via
  Gemini foi removida do pipeline nesta implementação (nada persiste esse dado depois da
  unificação — ver Mecanismo), então esse risco de rate-limit específico não se aplica mais.

## 🔗 Relacionados

- **DT-07** — item de rastreio deste plano; a pergunta original fica resolvida por este
  documento.
- **DT-02** — já removeu `InsertFarmDocument` (o método órfão que escrevia na coluna
  `embedding` legada) nesta mesma sessão; este plano é a continuação natural — não voltar a
  escrever nessa coluna morta.
- **DT-46** — achou e removeu `match_chunks` como código morto, sem saber (até esta
  investigação) que ela era a outra metade do pipeline `knowledge_chunks`.
- **DT-47** — mesmo padrão de "remover código morto de produção"; a Fase 6 deste plano
  (destino de `knowledge_chunks`) é uma instância futura do mesmo tipo de item.
- **ADR-006** (Docling, supersedido) e **ADR-007** (PyMuPDF, aceito) — a decisão de extrator
  já está tomada e validada; este plano só termina de conectar essa decisão à tabela que o
  bot realmente consulta.

## ✅ Resultado da execução (2026-09-02)

Fases 1-5 executadas nesta mesma sessão. Primeira passada de ingestão real contra produção:
**16 de 17 documentos, 840 chunks** gravados em `farm_documents`. `L10831.pdf` gerou 0 chunks
— é um PDF puramente escaneado (sem camada de texto), e o pipeline PyMuPDF puro não tem OCR
de fallback, gap já previsto na ADR-007 original ("Quando reconsiderar").

**Fechado no mesmo dia:** adicionado `ocr_pdf_to_text()` ao script — quando
`extract_pdf_text()` volta vazio, roda `ocrmypdf`/Tesseract (idioma Português) via Docker
(`jbarlow83/ocrmypdf`) numa cópia temporária do arquivo antes de desistir, extraindo o texto
resultante com o mesmo `extract_pdf_text()`. Sem Docker disponível, o arquivo é pulado com
aviso claro em vez de falhar silenciosamente. Rodado contra `L10831.pdf`: OCR extraiu 7.353
caracteres, 7 chunks gravados. **Total final: 17 de 17 documentos, 847 chunks em produção.**
Retrieval real confirmado via `match_documents_with_context` tanto em Postgres local (2 PDFs
de teste, extração direta) quanto em produção (extração direta e via OCR, ambos com
similaridade 1.0 no próprio chunk). `pmo-bot-go/scripts/rag_ingest.py` (Docling) e
`pmo-bot-go/cmd/ingestor/` removidos; `go build ./...` limpo.

**Fase 6 (fate de `knowledge_chunks`/`match_farm_documents`) deliberadamente não executada** —
escopo separado, de menor urgência (tabela/RPC órfãs mas inofensivas, sem exposição de
segurança conhecida), fica para uma sessão futura se o responsável decidir que vale a pena.
