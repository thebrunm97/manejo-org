# Spec de Validação - ManualRecordDialog & WhatsApp Bot

---
**Status:** ✅ Implementado  
**Data de Conclusão:** Janeiro 2026  
**Componentes Afetados:** `ManualRecordDialog.tsx`, `pmo_bot/ai_processor.py`  
**Análise de Implementação:** Validação realizada em 16/01/2026

---

Este documento define os campos obrigatórios e opcionais para cada tipo de atividade, alinhando a validação da interface web (ManualRecordDialog) com a coleta simplificada via Bot de WhatsApp.

## 1. Plantio

| Campo | Origem | Obrigatório? | Observações |
|---|---|---|---|
| Data | Ambos | Sim | |
| Cultura/Produto | Ambos | Sim | |
| Método de propagação | Ambos | Sim | Ex: Semente, Muda, Estaca |
| Local (Talhão/Canteiro) | Ambos | Sim | No bot, pode ser um local genérico ou aproximado |
| Quantidade + Unidade | Ambos | Não | Definido como complementar na spec |
| Espaçamento | UI | Não | Preenchimento posterior na web |
| Profundidade | UI | Não | Preenchimento posterior na web |
| Lote de semente | UI | Não | Preenchimento posterior na web |

## 2. Manejo – Manejo Cultural

| Campo | Origem | Obrigatório? | Observações |
|---|---|---|---|
| Data | Ambos | Sim | |
| Cultura/Área alvo | Ambos | Sim | |
| Atividade | Ambos | Sim | Ex: Capina, Poda, Tutoramento |
| Nº de trabalhadores | UI | Não | |
| Horas trabalhadas | UI | Não | |
| Ferramentas utilizadas | UI | Não | |
| Observações | Ambos | Não | |

## 3. Manejo – Aplicação de Insumo

| Campo | Origem | Obrigatório? | Observações |
|---|---|---|---|
| Data | Ambos | Sim | |
| Cultura/Área alvo | Ambos | Sim | |
| Nome do Insumo | Ambos | Sim | Bot deve tentar identificar na lista de permitidos |
| Dose (Noção) | Ambos | Sim | Campo texto livre no bot se não estruturado |
| Unidade estruturada | UI | Não | Em L/ha, ml/L, etc. Refinar na web |
| Equipamento | UI | Não | |
| Responsável | UI | Não | |
| Carência (Dias) | UI | Não | Sistema pode sugerir automático |

## 4. Manejo – Higienização

| Campo | Origem | Obrigatório? | Observações |
|---|---|---|---|
| Data | Ambos | Sim | |
| Item/Área higienizada | Ambos | Sim | Ex: Bandejas, Ferramentas, Galpão |
| Produto utilizado | Ambos | Sim | |
| Método | UI | Não | |
| Tempo de contato | UI | Não | |
| Responsável | UI | Não | |

## 5. Colheita

| Campo | Origem | Obrigatório? | Observações |
|---|---|---|---|
| Data | Ambos | Sim | |
| Cultura colhida | Ambos | Sim | |
| Quantidade + Unidade | Ambos | Sim | Essencial para estoque/produção |
| Lote | UI | Não | Rastreabilidade fina |
| Destino | UI | Não | Mercado, Processamento, etc. |
| Classificação | UI | Não | Tipo A, B, Descarte |
| Embalagem | UI | Não | |

## 6. Outro (Atividades Gerais)

| Campo | Origem | Obrigatório? | Observações |
|---|---|---|---|
| Data | Ambos | Sim | |
| Descrição/Atividade | Ambos | Sim | |
| Cultura/Produto | Ambos | Parcial | Pelo menos um entre Cultura, Local ou Observação deve constar |
| Local | Ambos | Parcial | Pelo menos um entre Cultura, Local ou Observação deve constar |
| Observação | Ambos | Parcial | Pelo menos um entre Cultura, Local ou Observação deve constar |

---

## Regras Gerais de Bloqueio

1.  **Validação na UI (ManualRecordDialog):**
    *   O botão "Salvar" deve permanecer desabilitado ou retornar erro se qualquer campo marcado como **Obrigatório? = Sim** para o tipo de atividade selecionado estiver vazio.
    *   Campos complementares (Obrigatório? = Não) não impedem o salvamento.

2.  **Comportamento do Bot WhatsApp:**
    *   O bot deve priorizar a coleta dos campos com **Origem: Bot** e **Obrigatório: Sim**.
    *   Caso o usuário não informe um campo obrigatório (ex: não disse a cultura no plantio), o bot deve perguntar especificamente por esse dado ou, em último caso, registrar como "Pendência" / "Incompleto" para que seja corrigido na web.
    *   **Jamais** inventar valores (alucinação) como "NÃO INFORMADO" ou "0" para campos obrigatórios numéricos/textuais críticos; é preferível deixar null no banco ou marcar flag de revisão.
