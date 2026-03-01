# Este script constrói a imagem Docker local e roda a ingestão do Docling montando a pasta atual

Write-Host "Iniciando a construção da imagem Docker pmo-ingest..." -ForegroundColor Cyan
docker build -t pmo-ingest -f Dockerfile.ingest .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao construir a imagem Docker." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`nImagem construída com sucesso. Iniciando a ingestão..." -ForegroundColor Green
Write-Host "Rodando scripts/ingest_docling.py via Docker...`n" -ForegroundColor Cyan

# Executa o container
# --rm: remove o container quando terminar
# -v ${PWD}:/app: monta o diretório atual do windows para a pasta /app do linux (assim ele tem acesso à pasta docs/ e ao .env)
# -w /app: define o diretório de trabalho no container
docker run --rm -v ${PWD}:/app -w /app pmo-ingest python scripts/ingest_docling.py

Write-Host "`nProcesso finalizado!" -ForegroundColor Green
