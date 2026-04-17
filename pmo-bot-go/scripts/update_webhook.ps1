$EVOLUTION_BASE_URL = "http://localhost:8082"
$INSTANCE_NAME = "ManejoOrgInstance"
$API_KEY = "ManejoOrgToken"
$WEBHOOK_URL = "http://pmo-bot-go:8080/webhook/evolution?token=ManejoOrgToken"

Write-Host "🔄 Updating webhook for instance: $INSTANCE_NAME..."

$headers = @{
    "Content-Type" = "application/json"
    "apikey" = $API_KEY
}

$body = @{
    "url" = $WEBHOOK_URL
    "enabled" = $true
    "events" = @("MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE")
} | ConvertTo-Json

Invoke-RestMethod -Uri "$EVOLUTION_BASE_URL/webhook/set/$INSTANCE_NAME" -Method Post -Headers $headers -Body $body

Write-Host "✅ Webhook updated successfully!"
