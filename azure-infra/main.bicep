// ==============================================================================
// ManejoORG Azure App Service Infrastructure Setup (Bicep)
// ==============================================================================
// Target: Azure App Service on Linux (Linux Web App for Containers)
// Persistent Storage: Azure Premium Files (Premium_LRS) for SQLite
// Compute: App Service Plan Premium v3 (Scale min 1, alwaysOn = true)
// Security: Managed Identity for ACR integration + Secure AppSettings
// ==============================================================================

@description('Azure Region where resources will be deployed')
param location string = resourceGroup().location

@description('Name of the App Service Plan')
param appServicePlanName string = 'asp-pmo-prod'

@description('Pricing tier SKU for the App Service Plan (Premium v3)')
param appServicePlanSku string = 'P1v3'

@description('Name of the Linux Web App')
param webAppName string = 'app-pmo-prod'

@description('Name of the premium storage account (must be globally unique, lowercase alphanumeric only)')
param storageAccountName string = 'stpmoevolutionprod'

@description('Name of the Azure File Share for persisting evolution_data')
param fileShareName string = 'evolution-data'

@description('Name of the existing Azure Container Registry (optional for AcrPull Managed Identity assignment)')
param acrName string = ''

@description('Resource group of the existing Azure Container Registry (defaults to current resource group)')
param acrResourceGroup string = resourceGroup().name

@description('Tag of the docker images to deploy')
param imageTag string = 'latest'

// ----------------------------------------------------------------------------
// Application Configuration - Non-sensitive Parameters
// ----------------------------------------------------------------------------
param wppSession string = 'agro_vivo'
param geminiModel string = 'gemini-3.1-flash-lite-preview'
param geminiApiVersion string = 'v1beta'
param geminiStoreId string = 'fileSearchStores/manejoorg-knowledge-base-87eu5nps93a8'
param flagsmithBaseUrl string = 'https://edge.api.flagsmith.com/api/v1/'
param openrouterModel string = 'google/gemini-2.0-flash-001'
param harnessEnabled string = 'true'
param evolutionInstanceName string = 'manejo-org'
param databaseSaveMessages string = 'false'
param databaseAutoMigrate string = 'true'
param clientName string = 'evolution'
param connectOnStartup string = 'true'
param waVersion string = 'web.whatsapp.comBaileys v5.8.0'

// ----------------------------------------------------------------------------
// Application Configuration - Secure Parameters (Secrets)
// ----------------------------------------------------------------------------
@secure()
param wppconnectToken string

param wppconnectUrl string

@secure()
param groqApiKey string

@secure()
param geminiApiKey string

param supabaseUrl string

@secure()
param supabaseKey string

@secure()
param webhookToken string

@secure()
param weatherApiKey string

@secure()
param flagsmithEnvKey string

@secure()
param openrouterApiKey string

@secure()
param evolutionApiKey string

// ==============================================================================
// 1. Storage Account Setup (Premium FileStorage)
// ==============================================================================
// Configure specifically as Premium_LRS to support SQLite performance on SMB/NFS.
// The kind MUST be 'FileStorage' for Premium Files, and the sku MUST be 'Premium_LRS'.
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Premium_LRS'
  }
  kind: 'FileStorage'
  properties: {
    accessTier: 'Premium'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

// 2. Premium File Share
// Premium File Shares require setting the quota (min 100 GB in Azure portal/API).
resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  name: '${storageAccount.name}/default/${fileShareName}'
  properties: {
    shareQuota: 100 // Required 100GB minimum for Premium_LRS fileshares
  }
}

// ==============================================================================
// 3. App Service Plan Setup (Linux Premium v3)
// ==============================================================================
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServicePlanSku
    tier: 'PremiumV3'
    capacity: 1 // minReplicas: 1 equivalent. Assures at least 1 active instance running 24/7.
  }
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux container instances
  }
}

// ==============================================================================
// 4. Linux Web App for Containers Setup
// ==============================================================================
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned' // Generates system identity for authentication to ACR
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true // Restrict to HTTPS only
    siteConfig: {
      alwaysOn: true // Operation continuous (prevents app sleeping)
      http2Enabled: true
      
      // Load and base64 encode our docker-compose configuration
      linuxFxVersion: 'COMPOSE|${base64(loadTextContent('docker-compose.azure.yml'))}'
      
      // Enable Managed Identity credential pulling for Container Registry
      acrUseManagedIdentityCreds: true
      
      // Mount Azure File Share to the App Service instance
      // The mount path MUST be a dedicated path, NOT "/" or "/home" to avoid runtime issues
      azureStorageAccounts: {
        'evolution-storage': {
          type: 'AzureFiles'
          accountName: storageAccount.name
          shareName: fileShareName
          mountPath: '/mounts/evolution_data'
          accessKey: storageAccount.listKeys().keys[0].value
        }
      }
      
      // Inject environment variables as App Settings (injected into Docker Compose runtime)
      appSettings: [
        {
          name: 'ACR_NAME'
          value: acrName
        }
        {
          name: 'IMAGE_TAG'
          value: imageTag
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'true'
        }
        {
          name: 'WPPCONNECT_TOKEN'
          value: wppconnectToken
        }
        {
          name: 'WPPCONNECT_URL'
          value: wppconnectUrl
        }
        {
          name: 'WPP_SESSION'
          value: wppSession
        }
        {
          name: 'GROQ_API_KEY'
          value: groqApiKey
        }
        {
          name: 'GEMINI_API_KEY'
          value: geminiApiKey
        }
        {
          name: 'GEMINI_MODEL'
          value: geminiModel
        }
        {
          name: 'GEMINI_API_VERSION'
          value: geminiApiVersion
        }
        {
          name: 'SUPABASE_URL'
          value: supabaseUrl
        }
        {
          name: 'SUPABASE_KEY'
          value: supabaseKey
        }
        {
          name: 'WEBHOOK_TOKEN'
          value: webhookToken
        }
        {
          name: 'GEMINI_STORE_ID'
          value: geminiStoreId
        }
        {
          name: 'WEATHER_API_KEY'
          value: weatherApiKey
        }
        {
          name: 'FLAGSMITH_ENV_KEY'
          value: flagsmithEnvKey
        }
        {
          name: 'FLAGSMITH_BASE_URL'
          value: flagsmithBaseUrl
        }
        {
          name: 'OPENROUTER_API_KEY'
          value: openrouterApiKey
        }
        {
          name: 'OPENROUTER_MODEL'
          value: openrouterModel
        }
        {
          name: 'HARNESS_ENABLED'
          value: harnessEnabled
        }
        {
          name: 'EVOLUTION_INSTANCE_NAME'
          value: evolutionInstanceName
        }
        {
          name: 'EVOLUTION_API_KEY'
          value: evolutionApiKey
        }
        {
          name: 'DATABASE_SAVE_MESSAGES'
          value: databaseSaveMessages
        }
        {
          name: 'DATABASE_AUTO_MIGRATE'
          value: databaseAutoMigrate
        }
        {
          name: 'CLIENT_NAME'
          value: clientName
        }
        {
          name: 'CONNECT_ON_STARTUP'
          value: connectOnStartup
        }
        {
          name: 'WA_VERSION'
          value: waVersion
        }
      ]
    }
  }
}

// ==============================================================================
// 5. ACR Integration via Managed Identity (Optional Role Assignment)
// ==============================================================================
// If acrName is provided, we assign the 'AcrPull' role (7f951dda-4ed3-4680-a7ca-43fe172d538d)
// to the Web App's System-Assigned Identity principal so it can pull images securely.
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = if (!empty(acrName)) {
  name: acrName
  scope: resourceGroup(acrResourceGroup)
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(acrName)) {
  name: guid(webApp.id, acr.id, 'AcrPull')
  scope: acr
  properties: {
    principalId: webApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull Role ID
    principalType: 'ServicePrincipal'
  }
}

// ==============================================================================
// Outputs
// ==============================================================================
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output webAppIdentityPrincipalId string = webApp.identity.principalId
output storageAccountNameUsed string = storageAccount.name
