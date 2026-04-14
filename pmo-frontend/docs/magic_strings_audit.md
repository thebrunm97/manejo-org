# Auditoria de "Magic Strings" e Integridade de Dados

**Data Ref:** 10/01/2026
**Escopo:** Identificação de valores literais e tipagem fraca para padronização.

---

## 1. Atividades (Activity Types)
**Localização:** `src/types/CadernoTypes.ts`, `src/components/Dashboard/ManualRecordDialog.tsx`
**Risco:** Ocorre uso de strings soltas que controlam fluxo de UI e chaves de banco de dados.
**Candidatos para Enum `ActivityType`:**
- `Plantio`
- `Manejo`
- `Colheita`
- `Insumo`
- `Outro`
- `CANCELADO` (Observado em CadernoTypes)

> **Recomendação:** Criar `enum ActivityType { PLANTIO = 'Plantio', COLHEITA = 'Colheita', ... }` para blindar a lógica de abas e filtros.

---

## 2. Unidades de Medida (Measurement Units)
**Localização:** `src/components/Dashboard/ManualRecordDialog.tsx` (Constantes: `UNIDADES_PLANTIO`, `UNIDADES_MANEJO`, `UNIDADES_COLHEITA`)
**Risco:** Arrays duplicados e literais espalhados. "maço" é um exemplo crônico de falha de validação (Legacy support).
**Candidatos para Enum/Union `UnitType`:**

**Grupo: Massa/Volume**
- `kg`
- `g`
- `ton`
- `L` (Inferido de L/ha)
- `ml` (Inferido de ml/L)

**Grupo: Contagem/Embalagem**
- `unid`
- `maço`
- `cx` (Caixa)

**Grupo: Agrícola/Taxa**
- `m2` (Área)
- `L/ha`
- `kg/ha`
- `g/planta`
- `ml/planta`
- `ml/L`

> **Recomendação:** Normalizar unidades no banco. Se a UI mostra 'm2', o banco deve receber 'm2' ou ter um de/para claro. Consolidar Listas em `src/constants/units.ts`.

---

## 3. Classificações e Domínio (Domain Literals)
Variáveis categóricas que aparecem hardcoded em componentes de UI (`Select` items).

**Propagação (Plantio):**
- `Muda`
- `Semente`
- `Estaca` / `Bulbo` (Atenção: UI usa "Estaca/Bulbo", banco deve ser atômico ou consistente)

**Tipo Manejo:**
- `Adubação`
- `Fitossanitário`
- `Irrigação`

**Comercial (Colheita):**
- `Mercado Interno`
- `Exportação`
- `Processamento`

**Classificação (Qualidade):**
- `Extra`
- `Primeira`
- `Segunda`

**Situação da Propriedade (Situacao_MUI.jsx):**
Strings longas e propensas a erro de digitação.
- "Toda a propriedade já é orgânica"
- "Toda a propriedade está em conversão"
- ... (Lista longa de frases)

> **Recomendação:** Para frases longas, usar um Objeto de Mapeamento (Map) onde a chave é um código curto (ex: `ORGANICO_TOTAL`) e o valor é a string exibida. O banco deve preferencialmente salvar o código ou a string exata validada por Zod.

---

## 4. O Problema do `any` (Technical Debt)
**Localização:** `src/types/CadernoTypes.ts`, `src/types/HarvestTypes.ts`

**Ponto Crítico:**
```typescript
export type DetalhesTecnicos =
    | DetalhesManejo
    ...
    | Record<string, any>; // <--- O "Coringa" Perigoso
```
Isso permite que qualquer objeto JSON seja salvo como detalhes técnicos, sem garantia que `DetalhesManejo` tenha o campo `dosagem` numérico ou string.

**Ação Necessária:**
Substituir o `Record<string, any>` por uma *Discriminated Union* estrita baseada no `tipo_atividade`.
Exemplo:
```typescript
interface RegistroManejo extends BaseRecord {
  tipo_atividade: 'Manejo';
  detalhes_tecnicos: DetalhesManejo; // Estrito
}
```
Isso eliminará a necessidade de casts como `(d as any).tipo_manejo` vistos em `ManualRecordDialog.tsx`.
