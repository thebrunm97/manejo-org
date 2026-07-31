# Lição Aprendida: Troubleshoot de GPU e OCR (Docling/ONNXRuntime) no Windows

## Contexto
Durante a implementação do script de benchmark de extração de PDFs (`benchmark_pdf.py`), que utiliza a biblioteca Docling para parseamento de documentos e OCR avançado (via RapidOCR/ONNXRuntime), deparamo-nos com o desafio de rodar o processamento pesado de imagens utilizando aceleração de hardware localmente (GPU NVIDIA).

## 1. O Problema da Detecção da Placa de Vídeo (CUDA) no Windows
A princípio, a biblioteca ONNXRuntime estava operando no modo de CPU (fallback) resultando num consumo de memória RAM assustador (100% de uso de CPU e 24GB de RAM ocupados), enquanto a placa de vídeo continuava a 0%.

### A Causa
O módulo `onnxruntime-gpu` para Python (instalado via PIP) depende de DLLs subjacentes da biblioteca CUDA (como cuBLAS e cuDNN) da NVIDIA. Caso o computador não tenha o pacote completo do "CUDA Toolkit" instalado globalmente e listado na variável PATH do Windows, o ONNXRuntime falha ao encontrar essas bibliotecas DLL dinâmicas, aborta a inicialização na GPU silenciosamente, e devolve a carga de volta para a CPU.

### A Solução ("O Hack do Path")
Ao invés de obrigar a instalação de todo o ecossistema CUDA (que pesa gigabytes e muda o estado do sistema operacional), utilizamos o pacote PyTorch que já foi baixado. O PyTorch (`torch` + `cu124`) contém em si todas as DLLs do CUDA necessárias.

**Ajuste efetuado:** No início do script Python, injetamos dinamicamente a pasta interna de bibliotecas DLL do PyTorch na variável de ambiente local `PATH` _antes_ de importar as outras libs. 

```python
try:
    import torch
    torch_lib_path = os.path.join(os.path.dirname(torch.__file__), "lib")
    os.environ["PATH"] = torch_lib_path + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass
```

Com isso, ao ser inicializado, o `onnxruntime` procura pelas DLLs no PATH recém injetado, encontra as libs do PyTorch e liga com sucesso os drivers de aceleração da GPU NVIDIA, tirando todo o fardo da CPU e RAM do sistema.

## 2. O Problema do `std::bad_alloc` (Estouro de VRAM)
Uma vez que o CUDA foi acordado, começamos a enfrentar quebras aleatórias nas execuções de arquivos mais extensos: `std::bad_alloc` durante as etapas do OCR.

### A Causa
Um `bad_alloc` significa que o computador negou a alocação de memória (não há espaço contíguo suficiente para abrigar a estrutura do objeto instanciado no script).
Por padrão, pipelines modernos (como o Docling) são otimizados para servidores grandes em nuvem (ou grandes data centers), e tentam otimizar o tempo de OCR enviando múltiplos "lotes" de páginas, isto é, de 4 a 8 imagens simultaneamente para a GPU.

Nossa máquina local possuía uma GTX 1660 SUPER, que possui formidáveis capacidades matemáticas e de OCR, contudo seu limite estrito de memória VRAM dedicada é de **6 GB**. 
Quando o script tentava mandar 8 imagens escaneadas (em altíssima resolução) juntas, o tensor excedia largamente os 6 GB e o sistema abortava o processo instantaneamente (antes mesmo da memória compartilhada de swap entrar em ação). 

### A Solução (Limitando os lotes e paralelismo)
Para hardware local com VRAM restrita (como 6 GB), devemos abrir mão de um leve paralelismo para garantir a finalização estável.
No `PdfPipelineOptions`, forçamos as propriedades de lote (batch size) para `1`. Dessa forma, impomos uma fila rígida, forçando que a biblioteca manipule, aloje os tensores e apague o OCR de **1 única página por vez**.

```python
pipeline_options = PdfPipelineOptions()
pipeline_options.ocr_batch_size = 1 # Otimização mandatória para OCR em VRAM <= 6GB
pipeline_options.layout_batch_size = 1
pipeline_options.table_batch_size = 1
```
### A Solução Definitiva (Desativando OCR)
Mesmo limitando o tamanho dos lotes, PDFs com diagramas e gráficos de resoluções hiperbólicas (e.g. publicações do Governo) podem resultar em um pico de memória acima de 6 GB por apenas *uma única página*. E, em caso de eventuais vazamentos (Memory Leaks) pontuais na biblioteca OCR, o estouro fatalmente ocorrerá a longo prazo ao longo das páginas. 
A solução final, visando absoluta estabilidade para ambientes com restrição de 6 GB de VRAM, é **abrir mão da leitura de texto impresso em imagens (OCR)** mantendo o Docling apenas no parser de layout/tabelas e texto embutido (que são extremamente leves e tiram proveito absoluto da GPU). 

```python
pipeline_options.do_ocr = False
```
Isso mantém o nível de velocidade proporcionado pela placa de vídeo (10x ou mais em relação à CPU), enquanto trafega tranquilamente sob as fronteiras físicas de seus de 6 GB de VRAM dedicados sem interrupções de `std::bad_alloc`.
