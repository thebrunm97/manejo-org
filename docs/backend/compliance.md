# 🛡️ Motor de Compliance — Validação Orgânica

O ManejoORG atua como um guardião da certificação, implementando regras automáticas para prevenir o uso de substâncias proibidas e garantir a qualidade dos registros do Caderno de Campo.

---

## 1. Blacklist de Substâncias Proibidas (Dinâmica)
O sistema monitora todas as mensagens de registro em busca de termos que violem as normas orgânicas (Lei 10.831 e IN 46). 

Diferente de versões anteriores, a **blacklist agora é dinâmica**, armazenada na tabela `public.insumos_proibidos`. Isso permite que agrônomos atualizem as regras de compliance em tempo real sem necessidade de novo deploy do backend.

### Categorias de Bloqueio
- **Herbicidas e Fertilizantes Químicos**: Glifosato, Ureia, NPK, Paraquat, etc.
- **Termos Genéricos**: "Veneno", "Agrotóxico".

### Fluxo de Sincronização
O backend Go mantém um **BlacklistCache** em memória, atualizado automaticamente a cada 24 horas via Goroutine/Ticker, garantindo performance ultra-rápida na triagem de mensagens do WhatsApp.

---

## 2. Regras de Validação

### 2.1 Bloqueio Crítico
- **Trigger:** Presença de qualquer item da blacklist na descrição do insumo ou atividade.
- **Ação:** O bot interrompe o fluxo de gravação no banco de dados.
- **Resposta:** *"🚨 ALERTA DE NÃO-CONFORMIDADE! O uso de [Produto] parece desrespeitar as normas orgânicas. O registro foi BLOQUEADO."*

### 2.2 Regra de Especificidade
- **Trigger:** O usuário tenta registrar um "insumo" sem especificar qual (ex: "passei veneno", "usei adubo", "coloquei insumo").
- **Ação:** O bot solicita o nome específico do produto.
- **Justificativa:** A certificação exige o nome comercial ou a composição exata para rastreabilidade.
- **Exemplo:** *"Recebido! Mas poderia especificar que tipo de insumo você utilizou? (Ex: Esterco, Bokashi?)"*

### 2.3 Avisos de Precaução (Alerta Suave)
- **Trigger:** Uso de produtos que estão no "limbo" ou exigem autorização (ex: Calcário, Termofosfato, Defensivos Naturais comerciais).
- **Ação:** O registro é **permitido**, mas uma nota de rodapé é adicionada à confirmação.
- **Aviso:** *"⚠️ Nota de Precaução: Confirme se este lote específico é aprovado pela sua certificadora."*

---

## 3. Fluxo de Decisão

```mermaid
flowchart TD
    A[Mensagem do Produtor] --> B{Contém Blacklist?}
    B -- Sim --> C[🚨 BLOQUEIO CRÍTICO]
    B -- Não --> D{Insumo é Genérico?}
    
    D -- Sim --> E[⚠️ Pedir Especificação]
    D -- Não --> F{Exige Cuidado?}
    
    F -- Sim --> G[✅ REGISTRAR + AVISO]
    F -- Não --> H[✅ REGISTRAR LIMPO]
    
    C --> I[Log: Bloqueio Auditoria]
    G --> J[Audit Log & Caderno de Campo]
    H --> J
```

---

## 4. Implementação Técnica (Thread-Safety & Normalização)
Para garantir a resiliência no backend Go:

- **Thread-Safety**: O cache utiliza `sync.RWMutex` para permitir múltiplas leituras simultâneas e exclusividade absoluta durante a escrita (refresh).
- **Normalização de Strings**: Todas as entradas do usuário passam por um processo de normalização (via `internal/utils/string_utils.go`) que remove acentos (diacríticos), excesso de espaços (`TrimSpace`) e converte para minúsculas antes do matching. Isso evita que variações como " Uréia " ou "GLIFOSATO" burlem o filtro.
- **Fallback de Banco**: Embora o Go intercepte 99% das tentativas incorretas, a autoridade final reside no banco de dados através da função RPC `is_chemical_input`.

---

## 5. Rastreabilidade e Auditoria
Todas as decisões tomadas pelo motor de compliance são registradas na tabela `logs_processamento` do Supabase:

- **`intencao`:** Marcada como `alerta_conformidade` ou `pedido_especificidade`.
- **`metadata`:** Contém o JSON da tentativa de registro frustrada para fins de auditoria interna.
- **Auditável:** Em caso de auditoria da certificadora, o produtor pode demonstrar que o sistema auxilia na prevenção de erros de manejo.
