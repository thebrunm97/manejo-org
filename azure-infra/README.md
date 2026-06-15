# 🌿 Azure Infrastructure & Migration Guide - ManejoORG

Este diretório contém os ficheiros de **Infrastructure as Code (IaC)** para migração do ecossistema do bot do WhatsApp e gateway de comunicação para o **Azure App Service on Linux (Web App for Containers)**.

A arquitetura foi desenhada para rodar em modo **Multi-container (Docker Compose)**, garantindo resiliência operacional, operação 24/7 sem interrupções de sleep, e persistência das sessões do WhatsApp.

---

## 📂 Ficheiros de Infraestrutura

1. **`main.bicep`**: Definição declarativa dos recursos no Azure:
   - **App Service Plan** em Linux (Tier Premium v3).
   - **Web App for Containers** (com Always On e HTTPS Only).
   - **Storage Account** (configurado como Premium LRS para performance de arquivo).
   - **Azure File Share** de 100GB mapeado para o diretório `/mounts/evolution_data` no container.
   - **User Role Assignment**: Associação automática de identidade gerenciada (`AcrPull`) no Azure Container Registry.
2. **`docker-compose.azure.yml`**: Definição da stack de containers (`pmo-bot-go`, `evolution-go`, `redis`) otimizada para o Azure Web App.
3. **`azuredeploy.parameters.json`**: Template de variáveis de infraestrutura e aplicação.

---

## ⚙️ Como Configurar e Customizar

### 1. Configuração da Imagem do Container
No arquivo `azuredeploy.parameters.json`, configure:
- `"acrName"`: Nome do seu Azure Container Registry (ex: `meuregistro`).
- `"acrResourceGroup"`: Grupo de recursos onde o seu ACR está localizado.
- `"imageTag"`: A tag da versão da imagem a implantar (ex: `v1.0.0` ou `latest`).

> [!TIP]
> A autenticação com o ACR é realizada nativamente usando a **Managed Identity** criada para o Web App. Não é necessário injetar credenciais ou chaves fixas nas App Settings da aplicação. O Bicep faz o bind da role `AcrPull` automaticamente caso a variável `acrName` seja preenchida.

### 2. Ajuste do Sizing de Recursos (SKU)
Para gerenciar o custo e a capacidade, ajuste os parâmetros no arquivo de variáveis:
- `"appServicePlanSku"`: Por padrão está definido como `P1v3` (1 vCPU, 4GB RAM).
- Se houver necessidade de aumento de recursos devido ao consumo de CPU do motor Go da Evolution API, você pode escalar verticalmente modificando para `P2v3` (2 vCPU, 8GB RAM) ou `P3v3` (4 vCPU, 16GB RAM).

### 3. Montagem do Azure Files
A persistência do diretório da Evolution API (`/data`) é garantida por meio da montagem do Azure Files configurada no `main.bicep`:
```bicep
azureStorageAccounts: {
  'evolution-storage': {
    type: 'AzureFiles'
    accountName: storageAccount.name
    shareName: fileShareName
    mountPath: '/mounts/evolution_data'
    accessKey: storageAccount.listKeys().keys[0].value
  }
}
```
No arquivo `docker-compose.azure.yml`, o volume é referenciado e mapeado para o container da Evolution API:
```yaml
volumes:
  - evolution-storage:/data
```

### 4. Injeção de Secrets e Variáveis Sensíveis
As chaves de API, credenciais do Supabase e tokens do webhook **nunca** devem ser inseridos em código ou parametrizados de forma estática no arquivo de parâmetros do repositório.

Você deve injetá-los por um destes métodos:
* **Via Parâmetros de Deployment no CLI / Pipeline (Recomendado)**:
  Substitua os valores seguros do `azuredeploy.parameters.json` em tempo de execução na pipeline de CI/CD ou passe via Azure CLI.
* **Via Azure Key Vault (Integração Direta)**:
  No arquivo de parâmetros, substitua o valor em texto do segredo por uma referência para o seu Key Vault:
  ```json
  "geminiApiKey": {
    "reference": {
      "keyVault": {
        "id": "/subscriptions/<subscription-id>/resourceGroups/<rg-name>/providers/Microsoft.KeyVault/vaults/<keyvault-name>"
      },
      "secretName": "gemini-api-key"
    }
  }
  ```

---

## ⚠️ Limitações Conhecidas & Trade-offs Técnicos

Antes de subir a aplicação para produção, esteja ciente das seguintes restrições da arquitetura escolhida:

### 1. Concorrência e Travamento de SQLite no Azure Files (SMB)
A Evolution API (Go) utiliza SQLite como base de dados local para autenticação, sessões e usuários.
* **O Problema**: O Azure Files é montado sobre protocolo de rede (SMB/NFS). Bancos SQLite sobre compartilhamentos de rede com alta concorrência podem sofrer de **Database Lock** (`database is locked`) ou falhas durante transações de escrita do WAL (Write-Ahead Logging).
* **Impacto**: Se o bot receber um fluxo massivo de mensagens simultâneas, transações pendentes de gravação das sessões do WhatsApp podem falhar ou travar temporariamente.
* **Recomendação**: Para operação estável de grande porte, migre os bancos da Evolution API de SQLite para uma instância dedicada do **Azure Database for PostgreSQL** (o motor Go da Evolution API já possui suporte para PostgreSQL nas variáveis de ambiente de banco de dados).

### 2. Escalonamento Horizontal (Scale-Out)
* **O Problema**: Devido ao uso de bancos SQLite locais gravados no File Share compartilhado, você **não pode escalar horizontalmente** a aplicação para múltiplos nós (ex: aumentar `capacity` do App Service Plan > 1).
* **Impacto**: Múltiplas instâncias do container escrevendo simultaneamente nos mesmos arquivos de banco de dados SQLite (`sqlite.db`, `auth.db`) no File Share causarão corrupção de banco de dados imediata.
* **Recomendação**: Mantenha o plano escalado verticalmente (apenas 1 instância ativa no SKU correspondente) ou adote banco de dados centralizado (PostgreSQL) e Redis distribuído.

### 3. Cache Volátil (Redis)
O container de Redis definido no compose utiliza um volume local temporário para gravação rápida. Em caso de restart ou reciclagem da instância física do App Service, o cache do Redis será limpo.
* Se a persistência total do Redis for um requisito do negócio, a stack deve apontar para o serviço gerenciado **Azure Cache for Redis**.

---

## 🚀 Como Executar o Deploy

Garanta que você tem o **Azure CLI** instalado e está autenticado na subscrição correta (`az login`).

### 1. Criar o Grupo de Recursos (caso não exista)
```bash
az group create --name rg-manejoorg-prod --location eastus
```

### 2. Validar o Template Bicep
```bash
az deployment group validate \
  --resource-group rg-manejoorg-prod \
  --template-file main.bicep \
  --parameters @azuredeploy.parameters.json
```

### 3. Executar o Deployment
```bash
az deployment group create \
  --name deploy-manejoorg-stack \
  --resource-group rg-manejoorg-prod \
  --template-file main.bicep \
  --parameters @azuredeploy.parameters.json
```
