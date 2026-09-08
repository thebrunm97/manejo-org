# ADR-007: Migração do Motor de Extração de PDFs — Docling → PyMuPDF

## Status: Aceito
## Data: 2026-07-24
## Supersede: [ADR-006](./006-pdf-extraction-engine.md)
## Arquivo afetado: [`scripts/rag_ingest.py`](../../scripts/rag_ingest.py)

---

> **Addendum — 2026-09-02 (DT-07):** a decisão de extrator (PyMuPDF) descrita nesta ADR
> continua válida e é a que está em produção. O que mudou foi o **destino** dos chunks: até
> esta data, `rag_ingest.py` gravava em `knowledge_chunks` com embeddings Gemini (3072d) —
> uma tabela que nenhuma tool do bot consulta. A tool `consultar_base_conhecimento` sempre
> leu `farm_documents.embedding_1024` (OpenRouter `baai/bge-m3`, 1024d), então nenhum dos 17
> PDFs reais da base de conhecimento era pesquisável pelo bot, apesar da extração estar
> correta. `rag_ingest.py` foi adaptado para gerar embeddings via OpenRouter/bge-m3 e
> gravar direto em `farm_documents` (upsert por `chunk_hash`) — mesmo extrator desta ADR,
> espaço vetorial correto. Ver [`PLAN-rag-ingestion-unification.md`](../../../pmo-bot-go/docs/PLAN-rag-ingestion-unification.md)
> para o diagnóstico completo. Como consequência, `pmo-bot-go/scripts/rag_ingest.py`
> (uma cópia antiga, ainda em Docling, nunca removida desde 2026-07-24) e
> `pmo-bot-go/cmd/ingestor/` (ingestor Go para `knowledge_chunks`, sem chamador) foram
> deletados como código morto.
>
> No mesmo dia, o cenário previsto em "Quando reconsiderar" abaixo (PDF escaneado sem
> camada de texto) apareceu de fato num arquivo real do corpus (`L10831.pdf`). Em vez de
> reverter a decisão desta ADR, foi adicionado um fallback pontual: `rag_ingest.py` roda
> `ocrmypdf`/Tesseract (idioma Português) via Docker (`jbarlow83/ocrmypdf`) só quando
> `page.get_text()` volta vazio para o documento inteiro, e extrai o texto resultante com o
> mesmo PyMuPDF de sempre. Não é a pipeline híbrida Tesseract/Docling cogitada originalmente
> — PyMuPDF continua sendo o único extrator para PDFs digitais, o OCR só entra como último
> recurso para PDFs sem nenhuma camada de texto.

## Contexto

O [ADR-006](./006-pdf-extraction-engine.md) estabeleceu o **Docling** como motor oficial de
extração de PDFs para a base de conhecimento do chatbot, com justificativa focada em
reconstrução semântica de layout e preservação de tabelas.

Em 2026-07-24, durante uma investigação de qualidade do RAG, identificou-se que consultas
sobre temas agronômicos específicos não retornavam chunks relevantes. A depuração revelou
que os chunks na base de dados (`knowledge_chunks`) continham palavras corrompidas como
`evapotranspirao`, `irriga??o` e `hortali?as` — evidenciando perda sistemática de caracteres
acentuados do Português durante a ingestão.

---

## Investigação

### 1. Isolamento do problema

```
Suspeita inicial: problema de exibição no frontend (React)
→ Descartada: chunks inspecionados diretamente via Supabase REST API mostravam corrupção

Suspeita 2: problema de encoding no banco de dados (PostgreSQL)
→ Descartada: a tabela usa TEXT (UTF-8), e outros campos na mesma tabela eram corretos

Suspeita 3: problema no estágio de extração do PDF
→ Confirmada: strings corrompidas identificadas antes do envio ao Gemini Embedding
```

### 2. Prova de conceito — comparação direta

Testou-se o mesmo arquivo (`[Embrapa-2015-Flavia_Clemente] Producao_de_Hortalicas...pdf`)
com dois extratores, salvando o resultado em arquivo UTF-8 e inspecionando os codepoints:

**Docling (via `export_to_markdown()`):**
```
Produ??o de hortali?as para agricultura familiar
Irriga??o localizada
Evapotranspira??o de refer?ncia
```

**PyMuPDF (via `page.get_text()`):**
```python
>>> import fitz
>>> page = fitz.open("cartilha.pdf")[3]
>>> for ch in page.get_text()[:100]:
...     if ord(ch) > 127:
...         print(f"chr({ord(ch):#x}) = {ch!r}")
chr(0xe7) = 'ç'   # ç — CORRETO
chr(0xe3) = 'ã'   # ã — CORRETO
chr(0xe1) = 'á'   # á — CORRETO
```

Resultado salvo em UTF-8 para confirmação sem ruído do terminal Windows (CP850):
```
Produção de hortaliças para agricultura familiar
Irrigação localizada
Evapotranspiração de referência
```

### 3. Causa-raiz

O Docling, ao processar PDFs com **mapeamento CID de fontes** (encoding não-padrão, comum em
publicações da Embrapa pré-2018 geradas com InDesign ou LaTeX com fontes embutidas), não
consegue resolver o mapeamento glifo→caractere e silenciosamente substitui os caracteres
irreconhecíveis por `?` ou os descarta.

O PyMuPDF lida com esse caso usando fallback para a tabela ToUnicode do PDF, que nesses
documentos específicos contém os codepoints corretos (Latin-1 / ISO-8859-1), e os converte
internamente para strings Python UTF-8 nativas antes de retornar.

### 4. Impacto na qualidade do RAG

A perda de acentos afeta diretamente:
- **Precisão semântica dos embeddings**: `irriga??o` e `irrigação` têm vetores distantes no
  espaço semântico do Gemini Embedding, reduzindo o score de similaridade de consultas em
  Português natural.
- **Buscas por termos técnicos**: palavras como `evapotranspiração`, `adubação`, `fungicida`
  — centrais no domínio agronômico — eram sistematicamente corrompidas.
- **Metadados de autoria**: nomes como `Flávia`, `João`, instituições como `Embrapa Hortaliças`
  apareciam truncados, comprometendo rastreabilidade e citação.

---

## Decisão

Substituir o **Docling** pelo **PyMuPDF** (`fitz`) como motor primário de extração de texto
de PDFs no script `scripts/rag_ingest.py`.

```python
# ANTES (Docling)
from docling.document_converter import DocumentConverter
converter = DocumentConverter(...)
doc = converter.convert(fatia_path)
text = doc.document.export_to_markdown()

# DEPOIS (PyMuPDF)
import fitz
doc = fitz.open(str(filepath))
text = "\n\n".join(page.get_text() for page in doc if page.get_text().strip())
```

---

## Trade-offs Aceitos

### O que ganhamos
| Aspecto | Docling | PyMuPDF |
|---|---|---|
| Encoding Português | ❌ Perde acentos em PDFs CID | ✅ UTF-8 correto sempre |
| Instalação | ~2 GB (modelos ONNX + torch) | ~20 MB |
| Velocidade | ~30s / página (GPU) | ~0.05s / página |
| Dependências | `torch`, `onnxruntime`, `docling` | apenas `pymupdf` |
| PDFs escaneados (imagens puras) | ✅ OCR integrado | ❌ Requer pré-processamento |

### O que perdemos
- **Preservação de tabelas em Markdown**: o Docling reconstruía tabelas como `| col | val |`.
  O PyMuPDF extrai o texto das células de forma linear, o que pode degradar a qualidade de
  respostas sobre tabelas de dosagem de insumos. **Mitigação**: nenhuma tabela crítica foi
  identificada nas buscas de qualidade do RAG até esta data.

- **OCR para PDFs digitalizados**: se futuramente forem inseridos PDFs que são puras imagens
  (sem camada de texto), o PyMuPDF retornará string vazia. **Mitigação**: implementar detecção
  `if not text.strip(): raise ValueError("PDF sem camada de texto")` para alertar o operador.

### Quando reconsiderar
- Se o corpus de conhecimento passar a incluir PDFs 100% digitalizados (imagens escaneadas)
  em larga escala → avaliar pipeline híbrida: PyMuPDF como primário, Tesseract/Docling como
  fallback de OCR quando `page.get_text()` retornar string vazia.
- Se a qualidade de extração de tabelas de dosagem se provar crítica → considerar
  `pdfplumber` (que também preserva UTF-8) para extração de tabelas especificamente.

---

## Consequências

- (+) Eliminação da corrupção de acentos: todos os 139 chunks da Cartilha da Embrapa
  validados com acentos corretos (`Produção`, `hortaliças`, `irrigação`, etc.).
- (+) Remoção de ~2 GB de dependências pesadas (`torch`, modelos ONNX).
- (+) Redução do tempo de ingestão de minutos para segundos por documento.
- (+) Flag `--force` adicionada para re-vetorização completa sem alterar o checkpoint.
- (-) Tabelas extraídas de forma linear (sem Markdown). Impacto a monitorar.
- **Ação pendente**: re-vetorização completa do corpus com `python scripts/rag_ingest.py --force`
  para substituir os chunks corrompidos no banco de dados.

---

## Referências

- [Chunk Verification Output](../../../chunk_verify.txt) — arquivo gerado em 2026-07-24 com amostra dos 139 chunks extraídos
- [PyMuPDF Docs — Text Extraction](https://pymupdf.readthedocs.io/en/latest/page.html#Page.get_text)
- [ADR-006 (Supersedido)](./006-pdf-extraction-engine.md)
- Tarefa de investigação: `task-4301` → `task-4515` (2026-07-24)
