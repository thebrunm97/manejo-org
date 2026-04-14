# Especificação: Cancelamento e Filtros no Diário de Campo

---
**Status:** ✅ Implementado  
**Data de Conclusão:** Janeiro 2026  
**Componentes Afetados:** `DiarioDeCampo.tsx`, `FieldDiaryTableV2.tsx`, `CadernoTypes.ts`  
**Análise de Implementação:** Validação realizada em 16/01/2026

---

## 1. Visão Geral
Este documento define as regras para implementação de funcionalidades de cancelamento (Soft Delete) e filtragem avançada na interface do Diário de Campo. O objetivo é permitir gestão de erros sem perda de histórico e facilitar a busca de registros.

## 2. Modelo de Cancelamento (Soft Delete)

### 2.1. Estrutura de Dados
- **Método**: Utilizar **Soft Delete** via alteração do `tipo_atividade`.
- **Status**: Alterar `tipo_atividade` para `ActivityType.CANCELADO` ('CANCELADO').
- **Preservação de Histórico**:
  - O registro **NÃO** será excluído do banco de dados (não usar `deleteRegistro`).
  - O motivo e data do cancelamento serão anexados ao campo `observacao_original`.

### 2.2. Fluxo de UI
1.  **Botão de Ação**:
    - Adicionar ícone de "Lixeira" (`DeleteIcon`) na coluna "Ações" da tabela.
    - Cor: `error` (vermelho) ou padrão com hover vermelho.
    - **Condição**: Desabilitado se o registro já estiver cancelado.

2.  **Modal de Confirmação**:
    - Ao clicar na lixeira, abrir um `Dialog`.
    - **Título**: "Cancelar Registro?"
    - **Mensagem**: "Este registro será marcado como cancelado, mas continuará visível no histórico para auditoria. Esta ação não pode ser desfeita."
    - **Campo Obrigatório**: `TextField` multiline para "Motivo do cancelamento" (Validar se preenchido antes de confirmar).
    - **Botões**: "Voltar" (Cancelar ação) e "Confirmar Cancelamento" (Cor: Error).

3.  **Execução (Serviço)**:
    - Chamar `cadernoService.updateRegistro(id, payload)`.
    - **Payload**:
      ```typescript
      {
        tipo_atividade: ActivityType.CANCELADO, // ou 'CANCELADO'
        observacao_original: `[CANCELADO em ${new Date().toLocaleDateString()}] Motivo: ${motivoUsuario} | Obs Original: ${obsOriginal}`
      }
      ```

### 2.3. Visualização de Registros Cancelados
- **Estilo da Linha**:
  - Opacidade reduzida ou fundo cinza claro (`bgcolor: '#f5f5f5'`).
  - Texto tachado (opcional) ou indicativo visual claro.
- **Coluna Atividade**:
  - Exibir `Chip` com label "CANCELADO" e cor `error` ou `default`.
- **Bloqueio de Edição**:
  - Botão de "Editar" (`EditIcon`) deve estar **desabilitado** ou escondido para registros cancelados.
  - Botão de "Visualizar" (`VisibilityIcon`) permanece ativo.

## 3. Filtros Avançados

### 3.1. Barra de Filtros (UI)
Localizada acima da tabela, substituindo ou complementando o cabeçalho atual. Deve conter os seguintes inputs:

1.  **Período (Data)**:
    - Componente: Dois `TextField` type="date" ou equivalente.
    - Labels: "Data Início" e "Data Fim".
    - Default: Vazio (sem filtro) ou mês atual.

2.  **Atividade**:
    - Componente: `Select` / `MenuItem`.
    - Opções: "Todas", "Plantio", "Manejo", "Colheita", "Insumo", "Outro".
    - Valor Default: "Todas".

3.  **Produto**:
    - Componente: `TextField` (Busca textual).
    - Placeholder: "Buscar produto..."

4.  **Local**:
    - Componente: `TextField` (Busca textual).
    - Placeholder: "Talhão/Canteiro..."

5.  **Exibir Cancelados**:
    - Componente: `FormControlLabel` com `Checkbox` ou `Switch`.
    - Label: "Ver Cancelados".
    - Default: `false` (Oculto).

### 3.2. Estrutura do Estado (`filtrosAtivos`)
```typescript
interface FiltrosState {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;   // YYYY-MM-DD
  tipoAtividade: string; // 'Todos' | ActivityType
  produto: string;   // Termo de busca
  local: string;     // Termo de busca
  incluirCancelados: boolean;
}
```

### 3.3. Lógica de Filtragem (Client-Side)
A filtragem será aplicada sobre o array `registros` carregado do banco.

Regras para o `.filter()`:
1.  **Cancelados**:
    - Se `incluirCancelados === false`: Excluir se `tipo_atividade === 'CANCELADO'`.
    - Se `incluirCancelados === true`: Incluir independente do status (respeitando os outros filtros).
2.  **Atividade**:
    - Se `tipoAtividade !== 'Todos'`: `reg.tipo_atividade === filtros.tipoAtividade`.
3.  **Produto**:
    - Se `produto` preenchido: `reg.produto.toLowerCase().includes(filtros.produto.toLowerCase())`.
4.  **Local**:
    - Se `local` preenchido: `reg.talhao_canteiro.toLowerCase().includes(filtros.local.toLowerCase())`.
5.  **Data**:
    - Se `dataInicio`: `new Date(reg.data_registro).setHours(0,0,0,0) >= new Date(filtros.dataInicio).setHours(0,0,0,0)` (Normalizar para evitar problemas de fuso).
    - Se `dataFim`: `new Date(reg.data_registro).setHours(0,0,0,0) <= new Date(filtros.dataFim).setHours(0,0,0,0)`.
