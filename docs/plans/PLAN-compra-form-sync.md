# Sincronização do Formulário de Registro de Compras (Criação vs. Edição)

Esse plano detalha a correção das inconsistências no formulário de registro de compras (ComprasForm) para garantir paridade total entre os fluxos de criação e edição. O plano engloba a exibição do seletor de locais (rateio por talhões/canteiros), a flexibilização do campo de quantidade para torná-lo opcional e a correção do redirecionamento de abas ao editar compras.

## User Review Required

> [!IMPORTANT]
> **Identificação do tipo "Compra" no Banco de Dados:**
> Registros criados pelo assistente via bot salvam a atividade como `'Compra'`, enquanto os manuais salvam como `'Insumo'` com um atributo extra `details.tipo_registro === 'compra'`. Para o fluxo de edição funcionar perfeitamente em ambos, o hook de estado do formulário (`useRecordFormState.ts`) agora identificará a aba correspondente utilizando ambos os critérios, evitando que compras sejam exibidas incorretamente na aba de Manejo.

## Proposed Changes

### Frontend - Estado e Validação dos Formulários

#### [MODIFY] [useRecordFormState.ts](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/hooks/manual-record/useRecordFormState.ts)
* Atualizar a definição das variáveis booleanas de roteamento no `useEffect` de edição para que a aba de Compras seja selecionada ao editar registros que tenham `tipo_atividade === 'Compra'` ou `tipo_atividade === 'Insumo'` com `detalhes_tecnicos.tipo_registro === 'compra'`.
* Corrigir a lógica de `isManejo` para não interceptar registros identificados como compras.
* Hidratar o campo `valor_total` no formulário de compras na edição.

#### [MODIFY] [useRecordValidation.ts](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/hooks/manual-record/useRecordValidation.ts)
* Flexibilizar a validação em `validateCompras` para que a quantidade seja opcional. A quantidade só será validada como maior que zero se o usuário a informar no input.

#### [MODIFY] [useManualRecordSave.ts](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/hooks/manual-record/useManualRecordSave.ts)
* Ajustar o payload do bloco `'compras'` para persistir a quantidade e unidade como `null` caso fiquem vazias, em vez de assumir zero.

---

### Frontend - Componentes de UI do Formulário

#### [MODIFY] [ManualRecordDialog.tsx](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/components/Dashboard/ManualRecordDialog.tsx)
* Passar as propriedades `onOpenLocation` e `clearError` para o componente `ComprasForm`.
* Definir a chave `talhao_canteiro` no `payloadBase` juntando o array de locais selecionados com o delimitador `'; '`. Isso garante que a string de rateio por talhão seja salva na tabela `caderno_campo`.

#### [MODIFY] [ComprasForm.tsx](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/components/Dashboard/ManualRecord/Forms/ComprasForm.tsx)
* Adicionar os parâmetros `onOpenLocation` e `clearError` à interface de props do componente.
* Integrar visualmente o componente de seleção de locais (`LocationSelector` markup com botão `MapPin`) logo abaixo do campo de "Produto Adquirido".

---

## Verification Plan

### Automated Tests
* Executar os testes unitários do formulário:
  `npm run test` ou rodar especificamente os arquivos de teste do manual-record:
  `npx vitest run pmo-frontend/src/hooks/manual-record/__tests__/useRecordFormState.test.ts`

### Manual Verification
1. Abrir a aplicação em ambiente de desenvolvimento local (`npm run dev`).
2. Acessar o Diário de Campo e abrir o modal de Novo Registro -> selecionar a atividade **Compras**.
3. Verificar a presença do novo campo de seleção de talhões/canteiros (rateio).
4. Registrar uma compra com quantidade em branco, valor preenchido e selecionando dois talhões (ex: "Talhão 1" e "Talhão 2").
5. Verificar no banco de dados e na listagem se a compra foi gravada corretamente com o texto de locais `Talhão 1; Talhão 2` na coluna `talhao_canteiro`.
6. Clicar para **Editar** essa compra. Validar que ela abre corretamente na aba de **Compras** (e não Manejo), e todos os campos (fornecedor, locais, observações, valor) vêm corretamente preenchidos.
