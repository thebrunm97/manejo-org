Write-Host "Testando endpoint de healthcheck..." -ForegroundColor Cyan

Start-Sleep -Seconds 3

try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get
    if ($health.status -eq "ok") {
        Write-Host "Healthcheck OK!" -ForegroundColor Green
    } else {
        Write-Host "Healthcheck respondeu com status inesperado: $($health.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Falha ao conectar no healthcheck. O backend está a correr?" -ForegroundColor Red
    exit 1
}

Write-Host "A enviar ping simulado para o webhook..." -ForegroundColor Cyan
$body = @{
    event = "Message"
    data = @{
        info = @{
            ID = "smoke-test-msg-" + (Get-Date -Format "yyyyMMddHHmmss")
            Chat = "5511999999999@s.whatsapp.net"
            Sender = "5511999999999@s.whatsapp.net"
            IsFromMe = $false
            Timestamp = (Get-Date -Format "o")
            Type = "conversation"
        }
        message = @{
            conversation = "ping"
        }
    }
} | ConvertTo-Json -Depth 5

# Tenta carregar o token dinamicamente do ficheiro .env
$token = "123456"
if (Test-Path ".\pmo-bot-go\.env") {
    Get-Content ".\pmo-bot-go\.env" | ForEach-Object {
        if ($_ -match "^\s*WEBHOOK_TOKEN\s*=\s*(.*)") {
            $token = $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
}

try {
    $webhookRes = Invoke-RestMethod -Uri "http://localhost:8080/webhook?token=$token" -Method Post -Body $body -ContentType "application/json"
    Write-Host "Webhook respondeu!" -ForegroundColor Green
} catch {
    Write-Host "Aviso: Webhook falhou. O backend recebeu a tentativa?" -ForegroundColor Yellow
}

Write-Host "Aguardando 3 segundos para o processamento assíncrono..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host "Procurando logs de latência nos ficheiros de logs..." -ForegroundColor Cyan
$logPaths = @(".\pmo-bot-go\server.log", ".\pmo-bot-go\server-err.log")
$existingLogs = $logPaths | Where-Object { Test-Path $_ }

if ($existingLogs) {
    $traces = Select-String -Path $existingLogs -Pattern "\[TRACING\]"
    if ($traces) {
        Write-Host "Ambiente OK, Latência capturada:" -ForegroundColor Green
        foreach ($trace in $traces) {
            Write-Host "  $($trace.Line.Trim())" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Nenhum log de tracing encontrado." -ForegroundColor Red
    }
} else {
    Write-Host "Nenhum ficheiro de log (server.log ou server-err.log) foi encontrado!" -ForegroundColor Red
}
