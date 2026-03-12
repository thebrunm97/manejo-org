#!/bin/bash

# Configuration
RESOURCE_GROUP="rg-pmo-bot"
LOCATION="eastus"
ACR_NAME="acrpmobot"
STORAGE_ACCOUNT="stpmo"
FILE_SHARE="pmo-volumes"

echo "1. Creating Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "2. Creating Azure Container Registry..."
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic

echo "3. Creating Storage Account and File Share..."
az storage account create --resource-group $RESOURCE_GROUP --name $STORAGE_ACCOUNT --location $LOCATION --sku Standard_LRS
az storage share create --name $FILE_SHARE --account-name $STORAGE_ACCOUNT

echo "4. Building and Pushing Images..."
# Note: Ensure you are in the project root
az acr login --name $ACR_NAME

# Build pmo-bot-go
docker build -t $ACR_NAME.azurecr.io/pmo-bot-go:latest ./pmo-bot-go
docker push $ACR_NAME.azurecr.io/pmo-bot-go:latest

# Build wppconnect-server
docker build -t $ACR_NAME.azurecr.io/wppconnect-server:latest ./wppconnect-server
docker push $ACR_NAME.azurecr.io/wppconnect-server:latest

echo "5. Deploying Container Group..."
# Before running this, update deploy-aci.yml with:
# - ACR Login Server
# - Storage Account Details
# - Secret Environment Variables
az container create --resource-group $RESOURCE_GROUP --file deploy-aci.yml

echo "Deployment playbook finished. Check Azure Portal for status."
