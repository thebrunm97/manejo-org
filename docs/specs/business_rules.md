# 🌿 Regras de Negócio - PMO Bot

> Verdade agronômica para interpretação de comandos de manejo

---

## 📜 Base Legal

O bot segue a **Lei 10.831/2003** (Lei dos Orgânicos) e a **Portaria MAPA 52/2021** que regulamentam a produção orgânica no Brasil.

---

## 🎯 Classificação de Atividades (ActivityType)

| Tipo | Gatilhos (exemplos de frases) | Ação no Sistema |
|------|-------------------------------|-----------------|
| **Plantio** | "plantei", "semeei", "coloquei muda" | Atualiza Seção 2 (Produção Vegetal) |
| **Manejo** | "capinei", "podei", "apliquei", "limpeza" | Atualiza Seção 8 (Insumos) |
| **Colheita** | "colhi", "tirei", "arranquei" | Registra no caderno_campo |
| **Insumo** | "comprei", "recebi", "chegou" | Atualiza Seção 8 |
| **Outro** | qualquer não identificado | Apenas log |

---

## 🔧 Subtipos de Manejo

Quando `tipo_atividade = "Manejo"`, o bot classifica em:

| Subtipo | Gatilhos | Campo `detalhes_tecnicos.subtipo` |
|---------|----------|-----------------------------------|
| **Manejo Cultural** | capina, roçada, poda, desbaste | `MANEJO_CULTURAL` |
| **Aplicação de Insumos** | adubação, pulverização, calda | `APLICACAO_INSUMO` |
| **Higienização** | limpeza de equipamento/caixa | `HIGIENIZACAO` |

---

## ⛔ Produtos Proibidos (Compliance Dinâmico)

O monitoramento de substâncias proibidas é realizado de forma dinâmica e automatizada. O sistema recusa o registro e notifica o usuário se detectar produtos que violem a **Lei 10.831** e a **Portaria MAPA 52/2021**.

### Mecanismo de Verificação
- **Base de Dados**: A lista oficial de substâncias e produtos proibidos reside na tabela `insumos_proibidos` do Supabase.
- **Performance (Go Cache)**: Para garantir baixa latência no WhatsApp, o backend mantém um cache em memória (`internal/compliance/blacklist.go`) protegido por um `sync.RWMutex`.
- **Auto-Refresh**: O cache é atualizado automaticamente a cada 24 horas via Goroutine em background, permitindo que alterações no compliance sejam aplicadas sem downtime.

**Mensagem de bloqueio padrão**:
> "⛔ REGISTRO RECUSADO: O produto '{nome}' contém substâncias proibidas (Lei 10.831). O uso de sintéticos pode cancelar sua certificação."

---

## ⚠️ Alertas de Compliance

Não bloqueiam, mas inserem alertas na observação:

| Condição | Alerta |
|----------|--------|
| Uso de **Cobre/Bordalesa** | "⚠️ Limite de Cobre: Máximo de 6 kg/ha/ano." |
| Uso de **Esterco/Cama de Aviário** | "⚠️ Esterco: Deve ser compostado ou aplicado 60 dias antes da colheita." |
| **Quantidade > 1000** (kg/L) de insumo | "⚠️ Verificação: Quantidade muito alta." |
| **Insumo não planejado** no PMO | "⚠️ Insumo '{nome}' não consta no planejamento." |
| **Talhão não certificado** | "⚠️ Atenção: Local '{nome}' consta como '{status}'." |
| **Equipamento não cadastrado** | "⚠️ Equipamento '{nome}' não encontrado no inventário." |

---

## 📝 Exemplos de Interpretação

### Exemplo 1: Plantio
**Frase**: "Plantei 50 mudas de alface no canteiro 3"

**Resultado**:
```json
{
  "tipo_atividade": "Plantio",
  "produto": "ALFACE",
  "quantidade_valor": 50,
  "quantidade_unidade": "unid",
  "talhao_canteiro": "canteiro 3"
}
```
**Ação**: Sincroniza Seção 2 (`produtos_primaria_vegetal`)

---

### Exemplo 2: Manejo (Aplicação)
**Frase**: "Apliquei 5 litros de calda bordalesa nos tomates"

**Resultado**:
```json
{
  "tipo_atividade": "Manejo",
  "produto": "CALDA BORDALESA",
  "quantidade_valor": 5,
  "quantidade_unidade": "L",
  "talhao_canteiro": "tomates",
  "detalhes_tecnicos": {
    "subtipo": "APLICACAO_INSUMO",
    "insumo": "CALDA BORDALESA",
    "dosagem": 5
  }
}
```
**Ação**: Sincroniza Seção 8 + Alerta sobre limite de Cobre

---

### Exemplo 3: Bloqueio
**Frase**: "Passei Roundup na cerca pra matar o mato"

**Resultado**:
```json
{
  "_bloqueio": "⛔ REGISTRO RECUSADO: O produto 'ROUNDUP' contém substâncias proibidas..."
}
```
**Ação**: NÃO registra, envia aviso ao usuário

---

### Exemplo 4: Colheita
**Frase**: "Colhi 30 quilos de tomate hoje"

**Resultado**:
```json
{
  "tipo_atividade": "Colheita",
  "produto": "TOMATE",
  "quantidade_valor": 30,
  "quantidade_unidade": "kg",
  "data_registro": "2026-01-12"
}
```
**Ação**: Registra no `caderno_campo` (Seção 11 pendente)

---

### Exemplo 5: Higienização
**Frase**: "Limpei a tesoura de poda com álcool"

**Resultado**:
```json
{
  "tipo_atividade": "Manejo",
  "produto": "TESOURA DE PODA",
  "detalhes_tecnicos": {
    "subtipo": "HIGIENIZACAO",
    "item_higienizado": "TESOURA DE PODA"
  }
}
```
**Ação**: Registra + Verifica se equipamento existe no inventário

---

## 🔄 Normalização de Dados

### Unidades Aceitas
O bot converte automaticamente para o padrão:

| Entrada | Saída |
|---------|-------|
| litros, litro, l | `L` |
| quilos, quilo, kg | `kg` |
| unidade, unidades, und | `unid` |
| caixa, caixas | `cx` |
| maço, maços | `maço` |
| tonelada, toneladas | `ton` |
| m2 | `m²` |
| hectare, ha | `ha` |

### Produtos
- Convertidos para **UPPERCASE**
- Plural simples removido ("TOMATES" → "TOMATE")

### Datas
- Se não informada: **data atual** (fuso `America/Sao_Paulo`)
- Formato: `YYYY-MM-DD`

---

## 🔐 Validações de Infraestrutura (IMA)

Antes de salvar, o bot verifica contra o banco:

1. **`get_latest_pmo_id(user_id)`**: Obtém PMO ativo
2. **`validar_insumo_pmo(pmo_id, nome)`**: Insumo planejado?
3. **`get_talhao_status(pmo_id, nome)`**: Talhão certificado?
4. **`get_equipamentos(user_id)`**: Equipamento cadastrado?

---

**Última atualização**: Janeiro 2026
