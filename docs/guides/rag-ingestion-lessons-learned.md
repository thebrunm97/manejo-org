# RAG Ingestion Pipeline: Lições Aprendidas e Conhecimento Acumulado

Este documento serve como um **checkpoint de conhecimento** consolidando todos os aprendizados, decisões arquiteturais e armadilhas descobertas durante a construção da esteira de ingestão de PDFs para o sistema de RAG.

## 1. O Desafio do Hardware (O Limite de 6GB de VRAM)
**O Problema:** Durante a execução do Docling (processamento nativo com IA), o servidor constantemente engasgava ou crashava (erro `std::bad_alloc`), paralisando a ingestão.
**A Descoberta:** O Docling utiliza modelos pesados via ONNXRuntime, que por padrão tentam processar tensores de imagens gigantes em paralelo na GPU. Uma placa de vídeo de 6GB (ex: GTX 1660 Ti) não suporta essa alocação concorrente, resultando no bloqueio da VRAM.
**A Solução (Lição 1):** O uso puro do OCR do Docling é insustentável para este hardware local. Para proteger o servidor de travamentos:
- O processamento nativo (com OCR) foi desativado no fluxo principal (`do_ocr=False`).
- A concorrência interna do modelo precisou ser estrangulada (batch size = 1) para evitar picos de memória.

## 2. Docling vs PyMuPDF: A Batalha pela Estrutura
Foi realizado um benchmark qualitativo e quantitativo entre extração pura (PyMuPDF) e processamento semântico (Docling sem OCR) em cartilhas complexas da Embrapa/MAPA.
- **PyMuPDF:** Rápido e leve, mas destrói completamente o significado das tabelas e agrupamentos semânticos (transformando colunas em uma sopa de texto linear contínuo).
- **Docling (do_ocr=False):** Preserva nativamente a estrutura Markdown. Ele "entende" onde estão as tabelas e as constrói em formato `| coluna | coluna |`, o que é **vital** para a LLM entender os dados agronômicos no RAG.

## 3. A Árvore de Decisão Híbrida (Gatekeeper)
Não podemos usar OCR para tudo, mas também não podemos ficar "cegos" para arquivos escaneados.
**A Solução Arquitetural (Lição 2):** Construímos um script Python de roteamento (`rag_ingest.py`) que age como porteiro:
1. Ele usa o PyMuPDF para ler silenciosamente as primeiras 5 páginas do PDF.
2. Calcula a densidade textual (mínimo de 100 caracteres e 20 palavras por página).
3. **Consistência é chave:** Exige que pelo menos 50% das páginas batam a meta (isso evita que uma única página com marca d'água engane o sistema inteiro, classificando um xerox de 300 páginas como "nativo").

## 4. O Abandono Temporário do OCR (Estratégia de Fases)
**A Decisão (Fase 1 vs Fase 2):**
- **Fase 1 (Atual):** Se o *Gatekeeper* detectar que o PDF é uma imagem (escaneado), o sistema simplesmente **rejeita o arquivo** e avisa o usuário: *"Passe este arquivo por um OCR externo antes"*. 
- O motivo? Para não criar uma complexidade operacional gigantesca e evitar travar a máquina com OCR rodando por horas na CPU local.
- **Fase 2 (Futuro):** Implementar OCR automatizado com `OCRmyPDF` (via Tesseract) em filas de background (`Celery`), gerando uma camada de texto antes do arquivo cair no fluxo do Docling.

## 5. Armadilhas Técnicas (Gotchas de Código)
1. **O Falso num_threads:** Tentamos injetar `pipeline_options.num_threads = 1` no Docling. Isso causa um crash instantâneo, pois a versão atual do Docling não possui essa propriedade na raiz.
   - **Fix correto:** Limitar os lotes (batches) do motor interno: `ocr_batch_size = 1`, `layout_batch_size = 1` e `table_batch_size = 1`.
2. **Crash de Codificação do Windows (cp1252):** O terminal nativo do Windows (Powershell/CMD) crasha com `UnicodeEncodeError` ao tentar imprimir emojis (🚀, ❌, ✅) no log de execução, já que não roda nativamente em UTF-8. 
   - **Fix correto:** Remover emojis estéticos de logs de background executados via `subprocess` ou `sys.stdout` no Windows, mantendo logs limpos e seguros.

## Resumo do Sucesso
Com essa arquitetura, conseguimos fazer o **bypass total do gargalo da placa de vídeo**, retendo 100% da inteligência de extração estrutural (Tabelas e Markdown do Docling) processando PDFs digitais na velocidade máxima, bloqueando lixo (PDFs escaneados sem texto) e protegendo a integridade do servidor de hardware modesto. A fundação de processamento de documentos para o RAG está sólida.
