# ADR 006: Escolha do Motor de Extração de PDFs (Docling)

## Status
~~Aceito~~ → **Supersedido por [ADR-007](./007-pdf-extraction-pymupdf.md)** *(2026-07-24)*

## Contexto
O PMO Bot necessita de um sistema de RAG (Retrieval-Augmented Generation) altamente preciso, operando sobre cartilhas técnicas do Ministério da Agricultura (MAPA) e da Embrapa. Esses documentos são complexos, ricos em tabelas, colunas duplas e formatações específicas (ex: bulas de agrotóxicos e planos de manejo).

Testamos a extração tradicional via `PyMuPDF` (baseado em texto) contra a extração estruturada via `Docling` (baseado em visão computacional e layout analysis).

## Decisão
Decidimos adotar o **Docling** como motor oficial de ingestão de documentos em PDF para a base de conhecimento do chatbot. A execução utilizará a GPU (CUDA) com paralelismo restrito (`num_threads=1`) e OCR desativado (`do_ocr=False`) para compatibilidade com o hardware local (6 GB de VRAM).

## Consequências

### Pontos Positivos
- **Reconstrução Semântica:** O Docling entende Markdown nativamente, agrupando parágrafos divididos, títulos (`##`) e blocos de forma inteligente.
- **Tabelas Preservadas:** A leitura em Markdown mantem a relação coluna-linha nas tabelas (ao invés de quebrar as células em linhas únicas, como o PyMuPDF), eliminando alucinações de LLM ao buscar dosagens de produtos químicos.
- **Isolamento de Imagens:** Blocos de imagens são convertidos em tags `<!-- image -->`, o que não polui a base de texto.

### Pontos Negativos e Limitações
- **Custo Computacional:** A extração requer GPU para analisar o layout e leva alguns segundos a mais por página.
- **Restrição de OCR:** Em PDFs que são apenas imagens "escaneadas" e sem camada de texto nativa, a desativação do módulo de OCR para proteger a memória VRAM de 6GB fará com que esses documentos em específico não sejam transcritos.
- **Vazamento de Memória (Mitigado):** Modelos de ONNXRuntime exigem o controle manual de threads (`pipeline_options.num_threads = 1`) para evitar `std::bad_alloc` na placa de vídeo.

> **⚠️ Regressão identificada em 2026-07-24:** Verificou-se que em PDFs com mapeamento CID de fontes específico (publicações Embrapa com encodings não-padrão), o Docling silenciosamente descartava caracteres acentuados do Português durante a pipeline de conversão, produzindo palavras como `evapotranspirao` ao invés de `evapotranspiração`. O PyMuPDF, biblioteca descartada nesta ADR, demonstrou extração UTF-8 correta nesses mesmos arquivos. Ver **[ADR-007](./007-pdf-extraction-pymupdf.md)**.
