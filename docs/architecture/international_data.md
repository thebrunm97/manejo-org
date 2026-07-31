# Arquitetura de Dados Internacionais (i18n & L10n)

## 1. Visão Geral
Este documento define as diretrizes arquiteturais para suportar internacionalização (i18n) e localização (L10n) no ManejoORG, cobrindo preferências de usuário, formatação regional e dados multilíngues para apoiar operações cross-border (América Latina e EUA).

## 2. Decisões Estruturais

### 2.1. Idioma (Language)
- **Padrão a ser utilizado**: Código ISO 639-1 (ex: `pt`, `en`, `es`).
- **Persistência**: Coluna `language_preference` na tabela `users` ou `profiles`.
- **Fallback**: Se não definido, ler do locale do navegador (Frontend) ou assumir `pt` (Backend/RAG).
- **Contexto de Sessão**: O motor RAG (WhatsApp e Frontend) deverá detectar ou ler a configuração do usuário para definir o *System Prompt* de saída.

### 2.2. Localidade (Locale)
- **Padrão a ser utilizado**: Código BCP 47 (ex: `pt-BR`, `en-US`, `es-ES`).
- **Utilização**: Formatação de números (separador decimal/milhar), ordenação alfabética e formatação de datas (DD/MM vs MM/DD).
- **Persistência**: Coluna `locale_preference` no perfil do usuário.

### 2.3. Fuso Horário (Timezone)
- **Padrão a ser utilizado**: IANA Time Zone Database (ex: `America/Sao_Paulo`, `America/New_York`).
- **Utilização**: O backend e banco de dados persistem timestamps em `UTC`. A conversão para a exibição local ocorre no Frontend e na renderização do RAG baseada no fuso do usuário/propriedade.
- **Persistência**: Coluna `timezone` vinculada à `farm/property` (pois uma fazenda opera num fuso fixo independente do gestor).

### 2.4. Moeda (Currency)
- **Padrão a ser utilizado**: ISO 4217 (ex: `BRL`, `USD`, `EUR`).
- **Persistência**: Entradas financeiras (como custos de insumos) recebem o valor bruto e a coluna `currency`.
- **Valores**: Salvar valores com precisão (`NUMERIC` ou em centavos) associados estritamente à moeda da transação.

### 2.5. Sistema de Medidas (Measurement System)
- **Opções**: `metric` (hectares, kg, litros) vs `imperial` (acres, lbs, galões).
- **Persistência Base**: Persistência unificada no banco usando o sistema métrico como fonte da verdade (ex: Área sempre salva em Hectares, Peso sempre em Kg).
- **Apresentação**: Camada de conversão (Frontend e Prompt RAG) calcula e converte on-the-fly para o sistema preferido da fazenda (`measurement_system`).

### 2.6. Estratégia de Traduções em Tabelas de Referência
- **Decisão (Pragmática)**: Utilização de colunas **JSONB** (Supabase/PostgreSQL).
- **Motivo**: Reduz drásticamente a complexidade de `JOINs` para tabelas de leitura massiva e baixa escrita (como categorias de despesas, tipos de solos e nomenclaturas fixas).
- **Estrutura de Exemplo**:
  Em vez de coluna `name`, utilizar:
  ```json
  "name_translations": {
    "pt": "Tomate",
    "en": "Tomato",
    "es": "Tomate"
  }
  ```
- **Indexação**: Quando houver consultas baseadas em texto para essas colunas, o banco será instruído a indexar via GIN index os valores dentro do objeto JSON.
