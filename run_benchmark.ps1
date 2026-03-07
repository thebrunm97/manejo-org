Write-Host "Derrubando containers de benchmark antigos..." -ForegroundColor Yellow
docker-compose -f docker-compose.benchmark.yml down

Write-Host "Subindo ambiente de benchmark (Python vs Go)..." -ForegroundColor Cyan
docker-compose -f docker-compose.benchmark.yml up -d --build

Write-Host "Preparando a arena. Aguardando a criacao dos containers (10 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Clear-Host
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "     INICIANDO TRANSMISSAO DO BENCHMARK" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host ""

docker-compose -f docker-compose.benchmark.yml logs -f benchmark-runner
