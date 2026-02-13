# 🚜 Contexto de Refatoração: Backend Context-Aware (WhatsApp <-> Web)

## 📂 Referências Críticas
> **⚠️ PARA A IDE:** Antes de escrever qualquer código SQL ou JSON Path, LEIA o arquivo:
> **`docs/PMO_DATA_STRUCTURE.md`**
> Ele contém a estrutura canônica exata do `form_data` (JSONB) que você deve respeitar.

---

## 📅 O Problema (Dezembro 2025)
O Frontend (React) agora permite criar itens "Just-in-Time" e salva tudo numa tabela única `pmos` (coluna `form_data`).
O Backend (Python) atual não sabe disso. Ele tenta adivinhar nomes de produtos e não vincula os registros ao ID do Plano de Manejo (`pmo_id`), criando dados órfãos.

## 🎯 Objetivo da Refatoração
Atualizar o Backend para ler o contexto do usuário (quem é e o que produz) antes de processar mensagens da IA.

---

## 🛠️ Tarefas Técnicas

### 1. Database Handlers (`modules/database_handlers.py`)

Baseando-se na estrutura definida em `docs/PMO_DATA_STRUCTURE.md`:

#### A. Implementar `get_pmo_context(phone_number)`
* **Lógica:** Buscar na tabela `pmos` qual registro possui o telefone correspondente no caminho JSON:
    * `secao_1_descricao_propriedade.dados_cadastrais.telefone` (Confirme este caminho no doc).
* **Retorno:** O `id` (PK) do PMO.

#### B. Implementar `get_pmo_catalog(pmo_id)`
* **Lógica:** Ler o `form_data` do ID encontrado e extrair listas planas de nomes.
* **Fontes (Verificar caminhos exatos no doc):**
    * *Culturas:* `secao_9...sementes_mudas_organicas` + `...nao_organicas`.
    * *Insumos:* `secao_10...controle_pragas_doencas` (e raiz se houver migração).
* **Retorno:** Lista de strings `['Alface', 'Tomate', 'Óleo de Neem']`.

---

### 2. Processador de IA (`modules/ai_processor.py`)

#### A. Injeção de Contexto (RAG)
* Receber a lista do catálogo (`catalog_list`) gerada acima.
* Injetar no System Prompt:
    > "O produtor tem estes itens cadastrados: {catalog_list}. Se ele mencionar algo similar, normalize para o nome da lista."

#### B. Separação de Unidades
* O Frontend agora envia `quantidade_unidade` (kg, maço, cx).
* A IA deve tentar extrair isso separadamente do valor numérico.

---

### 3. Webhook (`webhook.py`)
* Orquestrar a chamada:
    1.  Recebe Msg.
    2.  Chama `get_pmo_context` -> Pega ID.
    3.  Chama `get_pmo_catalog` -> Pega Lista.
    4.  Chama `process_message(msg, catalog_list)`.
    5.  Salva no Supabase com `pmo_id` preenchido.