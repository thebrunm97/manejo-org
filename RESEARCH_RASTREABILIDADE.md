# RESEARCH: Motor de Rastreabilidade e Logística (QR Code Orgânico)

Este documento define a arquitetura para o sistema de rastreabilidade do Manejo Orgânico, permitindo que cada colheita gere um selo digital (QR Code) para o consumidor final.

## 1. Modelagem do Lote (Supabase)

### Abordagem: Tabela Dedicada `lotes_rastreabilidade`
Embora a tabela `caderno_campo` registre a colheita, recomendamos uma tabela dedicada `lotes_rastreabilidade` pelos seguintes motivos:
- **Isolamento Público:** Permite expor dados em uma rota pública sem conceder acesso (mesmo que filtrado) à tabela operacional de auditoria (`caderno_campo`).
- **Agregado de Valor:** O lote não é apenas a colheita; ele é a união do **Plantio** + **Manejo (Insumos)** + **Colheita**.
- **Estabilidade de ID:** O UUID desta tabela será a chave única do QR Code, imutável e independente de correções no caderno de campo.

### Schema Sugerido (`lotes_rastreabilidade`)
- `id`: UUID (Primary Key) -> Usado na URL do QR Code.
- `propriedade_id`: FK (propriedades).
- `cultura`: TEXT.
- `variedade`: TEXT (opcional).
- `data_plantio`: DATE.
- `data_colheita`: DATE.
- `insumos_utilizados`: JSONB (Lista de nomes de insumos orgânicos/biopesticidas usados no ciclo).
- `quantidade_total`: NUMERIC.
- `unidade`: TEXT (kg, caixas, maços).
- `status_certificacao`: TEXT (Selo OCS/SPG/Auditoria).
- `created_at`: TIMESTAMPTZ.

## 2. A Rota Pública (Consumer View)

### Rota: `/trace/:loteId`
Esta será uma página de "Landi Page" otimizada para mobile, com design premium, focada em transmitir confiança ao consumidor.

### Governança de Dados (Privacidade vs. Transparência)

| Dado | Status | Motivo |
| :--- | :--- | :--- |
| **Nome da Propriedade** | EXIBIR | Identidade e origem. |
| **Cooperativa/Associação** | EXIBIR | Garantia de suporte institucional. |
| **Localização (Cidade/UF)** | EXIBIR | Valorização do produtor local (Km Zero). |
| **Data de Colheita** | EXIBIR | Frescor do produto. |
| **Insumos Utilizados** | EXIBIR | Prova de manejo biológico/orgânico. |
| **Selo de Certificação** | EXIBIR | Validade jurídica do produto orgânico. |
| **Faturamento/Preço** | **OMITIR** | Dado sensível comercial. |
| **Área Total da Fazenda** | **OMITIR** | Irrelevante para o consumidor final. |
| **CPF/RG do Produtor** | **OMITIR** | Segurança e LGPD. |
| **Custos de Produção** | **OMITIR** | Segredo de negócio. |

## 3. A Experiência do Produtor (QR Code Generator)

### Localização na UI
No **Dashboard do Produtor**, ao clicar em uma atividade de "Colheita" no Histórico (Caderno de Campo), haverá um botão:
> **[ 📄 Gerar Etiqueta de Rastreabilidade ]**

### Implementação Técnica
- **Biblioteca Recomendada:** `react-qr-code`.
  - **Motivo:** Leve, baseada em SVG (não perde qualidade na impressão), altamente customizável.
- **Fluxo:**
  1. O usuário clica em "Gerar".
  2. O sistema verifica se já existe um `lote_rastreabilidade` para aquela colheita.
  3. Se não existir, gera o registro agregando os dados do ciclo.
  4. Abre um modal de impressão com o QR Code e os dados básicos (Cultura, Data, Lote).

## 4. Próximos Passos (Slice 1)
1. Criar a migration da tabela `lotes_rastreabilidade`.
2. Implementar a Logic de Agregação (Trigger ou Service) que busca insumos aplicados naquele talhão entre o plantio e a colheita.
3. Criar a página pública `/trace/:loteId` com Tailwind Premium.
