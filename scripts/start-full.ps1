Write-Host "Verificando se o Docker está a correr..." -ForegroundColor Cyan
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "O Docker não parece estar a correr. Por favor, inicie o Docker Desktop e tente novamente." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Comando docker não encontrado. Instale o Docker." -ForegroundColor Red
    exit 1
}

Write-Host "A iniciar infraestrutura (Redis, Evolution-Go)..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml up -d redis evolution-go

Write-Host "A parar instâncias anteriores do backend Go se existirem..." -ForegroundColor Cyan
taskkill /f /im server.exe 2>$null | Out-Null

Write-Host "A compilar o backend Go..." -ForegroundColor Cyan
cd pmo-bot-go
go build -o server.exe ./cmd/server
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha na compilação do Go." -ForegroundColor Red
    exit 1
}
cd ..

Write-Host "A iniciar o backend em background..." -ForegroundColor Cyan
$backendDir = Resolve-Path ".\pmo-bot-go"
$exePath = Join-Path $backendDir "server.exe"
$logPath = Join-Path $backendDir "server.log"
$errLogPath = Join-Path $backendDir "server-err.log"

Start-Process -FilePath $exePath -WorkingDirectory $backendDir -RedirectStandardOutput $logPath -RedirectStandardError $errLogPath -WindowStyle Hidden

Write-Host "Ambiente iniciado! A arrancar o frontend..." -ForegroundColor Green
npm run dev --prefix pmo-frontend
