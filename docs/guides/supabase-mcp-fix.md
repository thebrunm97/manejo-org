# Guia de Resolução: Erro "Unauthorized" no Supabase MCP e Reset de Configuração

Este guia documenta o problema de autenticação do Supabase MCP no Antigravity/VS Code e como restabelecer o funcionamento caso ele volte a quebrar após atualizações ou reinicializações do sistema.

---

## 🔍 O Problema e Causa Raiz

1. **Erro `Unauthorized`:**
   O MCP nativo do Supabase (`supabase` padrão) utiliza autenticação HTTP + OAuth 2.1 via nuvem (`https://mcp.supabase.com/mcp`). Sessões expiradas ou problemas no handshake OAuth impedem a inicialização das ferramentas.
   
2. **Reset de Configuração após reiniciar o PC:**
   Se configurarmos o servidor local usando a chave padrão `"supabase"`, o mecanismo de sincronização em nuvem e a lista de registros nativos do editor sobrescrevem o arquivo `mcp_config.json`, apagando a nossa configuração local (`command` e `env`) e reiniciando para a URL padrão.

---

## 🛠️ Como Resolver (Passo a Passo)

Para contornar esses problemas permanentemente, usamos a chave **`supabase-local`** em vez de `supabase`. Isso impede a sincronização em nuvem de sobrescrever as configurações locais e usa transporte direto `stdio` via token de acesso.

### Passo 1: Atualizar a Configuração Global do Editor
Como a pasta `.gemini/config` é protegida e não aceita edição direta por ferramentas comuns de escrita, você deve executar o seguinte comando no PowerShell para forçar a gravação:

```powershell
$json = @'
{
  "mcpServers": {
    "supabase-local": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase",
        "--project-ref",
        "hejewayflbuemnffrhae",
        "--features",
        "development,docs,account,database"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_7931894c6914cd810a92536eefd28a995c0b4522"
      }
    }
  }
}
'@
Set-Content -Path "C:\Users\brunn\.gemini\config\mcp_config.json" -Value $json -Force
```

### Passo 2: Atualizar a Configuração Local do VS Code (Opcional)
Se o VS Code também perder a referência, verifique se o arquivo `.vscode/mcp.json` na raiz do projeto está estruturado da seguinte forma:

```json
{
  "servers": {
    "supabase-local": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase",
        "--project-ref",
        "hejewayflbuemnffrhae",
        "--features",
        "development,docs,account,database"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_7931894c6914cd810a92536eefd28a995c0b4522"
      }
    }
  }
}
```

### Passo 3: Reiniciar e Habilitar
1. **Reinicie o editor** (feche e abra completamente).
2. Abra a aba de **MCP Servers**.
3. Você verá o servidor embutido `Supabase` (inativo/com erro) e o novo **`supabase-local`**.
4. **Desabilite** o servidor embutido `Supabase` para ocultar o erro de autorização.
5. Verifique se o **`supabase-local`** está **Habilitado (Enabled)** e clique em **Refresh**.

---

> [!WARNING]
> **Sobre o Token de Acesso:** O token utilizado (`sbp_7931894c...`) foi gerado a partir do seu dashboard. Se ele for revogado na console do Supabase, você precisará gerar um novo token e atualizar a variável `SUPABASE_ACCESS_TOKEN` no comando do **Passo 1**.
