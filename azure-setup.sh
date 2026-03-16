#!/bin/bash
# Configuration
RESOURCE_GROUP="rg-pmo-bot-v2"
LOCATION="eastus2"
ACR_NAME="acrpmobotbr26"
STORAGE_ACCOUNT="stpmobotbr26"
FILE_SHARE="pmo-volumes"

echo "1. Creating/Ensuring Resources..."
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "2. ACR Login..."
az acr login --name $ACR_NAME

echo "3. Building and Pushing Images..."

# Build pmo-bot-go (v2)
docker build -t $ACR_NAME.azurecr.io/pmo-bot-go:v2 ./pmo-bot-go
docker push $ACR_NAME.azurecr.io/pmo-bot-go:v2

# Build WPPConnect Custom (Debian Stable)
docker build -t $ACR_NAME.azurecr.io/wppconnect-server:v2-stable -f Dockerfile.wpp .
docker push $ACR_NAME.azurecr.io/wppconnect-server:v2-stable

echo "4. Deploying Container Group..."
# Delete group first to ensure clean resource update
az container delete --resource-group $RESOURCE_GROUP --name pmo-bot-group --yes
az container create --resource-group $RESOURCE_GROUP --file deploy-aci.yml

echo "5. Monitoring Deployment..."
echo "Aguardando o nascimento do bot..."
watch az container show --resource-group $RESOURCE_GROUP --name pmo-bot-group --query "containers[*].{Name:name,State:instanceView.currentState.state}" -o table

echo "Deployment finished. Use: az container attach --name pmo-bot-group --resource-group $RESOURCE_GROUP"
