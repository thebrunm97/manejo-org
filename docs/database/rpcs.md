# ⚙️ RPCs — Funções de Banco de Dados

O ManejoORG utiliza Funções Postgres (RPCs) para garantir que operações complexas sejam atômicas (tudo ou nada) e que a lógica de negócio seja consistente entre o Bot do WhatsApp e o Frontend PWA.

---

## 1. RPCs de Registro (Caderno de Campo)

### `registrar_atividade_pmo`
É a função principal utilizada pelo Bot para registros genéricos.
- **Uso:** Plantio, Colheita, Manejo, etc.
- **Principais Argumentos:** `pmo_id_arg`, `atividade_arg`, `produto_arg`, `quantidade_valor_arg`, `talhao_nome_arg`.
- **Lógica Interna:** Verifica se o talhão existe, cria o registro no caderno e vincula ao PMO ativo.

### `rpc_registrar_compra_insumo`
Especializada para o Formulário 06 (Aquisição).
- **Uso:** Registro de compra de sementes, adubos ou ferramentas.
- **Argumentos:** `pmo_id_arg`, `produto_arg`, `quantidade_arg`, `fornecedor_arg`.
- **Lógica Interna:** Se o insumo for novo, ele é adicionado ao catálogo do PMO automaticamente.

### `rpc_registrar_operacao_campo`
Função polimórfica que lida com operações técnicas específicas.
- **Tipos de Operação:** `Limpeza`, `Propagacao`, `Manejo`, `Compostagem`.
- **Diferencial:** Aceita uma estrutura JSON flexível para `detalhes_arg`, permitindo campos específicos para cada tipo de tarefa (ex: temperatura da pilha de compostagem).
- **Hardening (Zero-Trust):** Inclui validação server-side via `is_chemical_input`. Esta função consulta a tabela `insumos_proibidos` dinamicamente. Se o talhão for `ORGANICO` ou `TRANSICAO`, a função bloqueia sumariamente qualquer insumo que conste na blacklist química, retornando um erro `P0001` (Raise Exception).

---

## 2. RPCs de Infraestrutura

### `criar_infraestrutura_pmo`
Utilizada para configurar a fazenda rapidamente.
- **Ação:** Cria um **Talhão** e múltiplos **Canteiros** associados em uma única transação.
- **Benefício:** Evita estados inconsistentes (canteiro sem talhão pai).

---

## 3. RPCs de Inteligência (IA)

### `match_farm_documents`
Base para o Agente Agronomist.
- **Funcionamento:** Recebe um `embedding` (vetor 1536) e realiza uma busca de similaridade de cosseno na tabela `farm_documents`.
- **Retorno:** Os top N fragmentos de texto mais próximos à dúvida do usuário.

---

## 4. Vantagens desta Abordagem
1. **Atomicidade:** Se o registro do caderno falhar, a atualização do estoque ou do PMO também é revertida.
2. **Performance:** Reduz o número de viagens (round-trips) entre o backend e o banco de dados.
3. **Segurança:** A lógica de validação de dados reside no banco, impedindo que dados malformados sejam inseridos por qualquer cliente.
4. **DRY (Don't Repeat Yourself):** O Bot (Go) e o App (React) chamam exatamente a mesma função, garantindo que o comportamento seja idêntico em ambas as interfaces.
