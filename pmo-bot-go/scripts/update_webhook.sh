#!/bin/bash

# Configuration
EVOLUTION_BASE_URL="http://localhost:8082"
INSTANCE_NAME="manejo-org"
API_KEY="ManejoOrgToken"
WEBHOOK_URL="http://pmo-bot-go:8080/webhook/evolution?token=ManejoOrgToken"

echo "🔄 Updating webhook for instance: $INSTANCE_NAME..."

curl --location --request POST "$EVOLUTION_BASE_URL/webhook/set/$INSTANCE_NAME" \
--header "Content-Type: application/json" \
--header "apikey: $API_KEY" \
--data-raw "{
    \"url\": \"$WEBHOOK_URL\",
    \"enabled\": true,
    \"events\": [
        \"MESSAGE\",
        \"SEND_MESSAGE\",
        \"CONNECTION\"
    ]
}"

echo -e "\n✅ Webhook updated successfully!"
