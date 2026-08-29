# FINANCIAL_READINESS_AUDIT.md

## 1. Raio-X do Banco de Dados (Supabase)

### 1.1 Colunas Financeiras no `caderno_campo`
A tabela central de operações já possui embriões financeiros que serão o alvo da nossa migração:
- `valor_total` (numeric): Usado hoje principalmente em vendas e algumas compras.
- `nota_fiscal` (text): Campo para registro de documentos.
- `fornecedor` (text): Nome da origem do insumo.
- `cliente` (text): Nome do destino da venda.

### 1.2 Outras Tabelas
Não foram encontradas tabelas dedicadas de `compras` ou `vendas`. Todo o fluxo financeiro hoje está "achatado" dentro do `caderno_campo` como metadados de uma atividade operacional.

---

## 2. Auditoria de Extração (IA - Groq/Llama)

### 2.1 Capacidade Atual de Extração
O `system_prompt.md` já é "treinado" para capturar:
- `"atividade": "Venda"` e `"atividade": "Compra/Aquisição"`.
- `"valor_total"`: Mapeado com sucesso para mensagens de venda.
- `"fornecedor"`: Extraído de mensagens de compra.
- `"nota_fiscal"`: Capturado quando mencionado numericamente.

### 2.2 Limitações Detectadas
- **Falta de Rateio:** A IA hoje assume que 1 mensagem = 1 registro. Se o usuário disser "Gastei 1000 reais em adubo para os talhões 1 e 2", a IA extrairá os dois talhões, mas não saberá como dividir o valor (Rateio).
- **Ambiguidade de Intenção:** O bot ainda não diferencia claramente uma "Compra para Estoque" de uma "Compra com Aplicação Imediata". No novo modelo Ledger, essa distinção será vital para evitar duplicidade de custos.

---

## 3. Análise de FSM (`fsm.go`)

### 3.1 Estados Financeiros Ativos
- `StateAguardandoQuantidade`: Choke point que impede registros sem volume.
- `StateAguardandoCompra`: Intercepta compras incompletas (sem fornecedor).

### 3.2 Comportamento de Fluxo
Hoje, se o usuário diz "Comprei algo por 500 reais", o `fsm.go` redireciona para a `RegistrarCompraInsumoRPC`. Esta RPC salva os dados, mas como não temos a tabela Ledger (até a Phase 01), ela guarda tudo no `caderno_campo`.
- **Dívida Técnica:** O FSM descarta informações de "Split-Billing" (rateio) porque o struct de extração não possui um array de alocações.

---

## 4. Conclusão e Plano de Reaproveitamento

### O que manter:
- **Whisper/STT Pipeline:** A transcrição de áudio está sólida e resiliente.
- **Interseptor de Quota:** A proteção de tokens por plano deve ser mantida.
- **States de Fallback:** O `handleDuvidaFallback` é excelente para manter a conversa fluindo.

### O que refatorar (Fase 02):
- **O Switch de Intenção:** Precisamos da `IntentRegistroFinanceiro` para transações que não são necessariamente manejos de campo (ex: pagamento de diarista).
- **A Struct `ExtractedData`:** Deve aceitar um array de `Alocacoes` para permitir o rateio via voz.
- **A Autoridade de Gravação:** Migrar as chamadas de `RegistrarOperacaoCampoRPC` para a nova `rpc_registrar_transacao_com_rateio` (criada no plano mestre).

---
**Status da Auditoria:** Concluída. O sistema tem "terra fértil", mas precisa de novos "canais de irrigação" (tabelas Ledger) para não inundar o caderno de campo com dados financeiros redundantes.
