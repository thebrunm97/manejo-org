# 🌿 AgroVivo 2.0 — Product Requirements Document (PRD)

> Digitalização e Automação de Planos de Manejo Orgânico via Voice-to-JSON

**Versão:** 2.0.0  
**Data:** 19 de Janeiro de 2026  
**Status:** Consolidação Pós-Validação Técnica  
**Autor:** Equipe AgroVivo

---

## 📋 Índice

1. [Visão Geral e Estratégia](#1-visão-geral-e-estratégia)
2. [Personas de Usuário](#2-personas-de-usuário)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Contrato de Dados (Backend ↔ Frontend)](#4-contrato-de-dados-backend--frontend)
5. [Requisitos Funcionais](#5-requisitos-funcionais)
6. [Requisitos Não-Funcionais](#6-requisitos-não-funcionais)
7. [Regras de Sincronização e Conflitos](#7-regras-de-sincronização-e-conflitos)
8. [Estratégia de Crescimento](#8-estratégia-de-crescimento)
9. [Roadmap de Expansão](#9-roadmap-de-expansão)
10. [Métricas de Sucesso](#10-métricas-de-sucesso)

---

## 1. Visão Geral e Estratégia

### 1.1 O Problema

A certificação orgânica no Brasil exige documentação complexa (**18 seções** do PMO oficial), gerando:
- **Barreira de entrada** para pequenos produtores sem experiência administrativa
- **Perda de tempo** preenchendo formulários em papel/Excel
- **Risco de não-conformidade** por falta de rastreabilidade
- **Custo elevado** de consultoria técnica para cumprir a Lei 10.831/2003

### 1.2 A Solução AgroVivo

Um ecossistema **Voice-First** que permite ao produtor:
1. **Falar** suas atividades diárias no WhatsApp ("Plantei 50 mudas de alface no canteiro 3")
2. **IA transcreve e estrutura** os dados automaticamente (Whisper + Llama 3.3)
3. **Validação automática** contra regras de compliance da Lei 10.831
4. **PMO preenchido progressivamente** e pronto para auditoria

### 1.3 Proposta de Valor

| Para | Valor Entregue |
|------|----------------|
| **Produtor Orgânico** | Preenche o PMO "falando", sem precisar digitar ou entender formulários |
| **Consultor Técnico** | Dashboard com rastreabilidade total e alertas de compliance |
| **Certificadora** | Dados estruturados e imutáveis, facilitando auditoria |

### 1.4 "Aha Moment"

> *"Mandei um áudio dizendo que plantei tomate e quando abri o site já estava na tabela!"*

O **momento de ativação** ocorre quando o usuário envia a primeira mensagem no WhatsApp e vê o dado refletido instantaneamente no Caderno de Campo web.

---

## 2. Personas de Usuário

### 2.1 Persona Primária: Dona Maria (Produtora)

| Atributo | Descrição |
|----------|-----------|
| **Idade** | 52 anos |
| **Escolaridade** | Ensino fundamental |
| **Tecnologia** | WhatsApp no celular básico (Android Go) |
| **Dores** | Formulários complicados, medo de perder certificação |
| **Objetivo** | Manter registros sem "pegar no papel" |
| **Frequência de uso** | 3-5 registros por semana |

**Comportamentos:**
- Prefere áudio a texto
- Confia mais em tecnologia "que fala" com ela
- Usa celular só com dados móveis (offline frequente)

### 2.2 Persona Secundária: João (Consultor Técnico/Auditor)

| Atributo | Descrição |
|----------|-----------|
| **Idade** | 35 anos |
| **Formação** | Agronomia |
| **Tecnologia** | Notebook + smartphone |
| **Dores** | Consolidar dados de vários produtores, gerar relatórios |
| **Objetivo** | Garantir conformidade dos seus clientes |
| **Frequência de uso** | Diária (verificação de registros) |

**Comportamentos:**
- Precisa de filtros avançados e exportação de dados
- Valoriza alertas proativos de não-conformidade
- Acompanha múltiplos PMOs simultaneamente

---

## 3. Arquitetura do Sistema

### 3.1 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CANAIS DE ENTRADA                          │
├─────────────────────┬───────────────────────────────────────────────────┤
│    📱 WhatsApp      │                🌐 Web (PWA)                       │
│   (Texto/Áudio)     │              (React 19 + Vite)                    │
└─────────┬───────────┴───────────────────────┬───────────────────────────┘
          │                                   │
          ▼                                   ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│   WPPConnect Server         │    │   Service Workers (PWA)      │
│   (Self-hosted Node.js)     │    │   + IndexedDB (idb)          │
└─────────┬───────────────────┘    └─────────┬───────────────────┘
          │                                   │
          ▼                                   │
┌─────────────────────────────┐               │
│      🐍 Flask Webhook       │               │
│    (webhook.py:5000)        │               │
├─────────────────────────────┤               │
│ • ai_processor.py           │               │
│ • database_handlers.py      │               │
│ • business_rules.py         │               │
│ • prompts.py                │               │
└─────────┬───────────────────┘               │
          │                                   │
          ▼                                   │
┌─────────────────────────────┐               │
│      🤖 Groq API            │               │
│  • Llama 3.3 70B (LLM)      │               │
│  • Whisper V3 (STT)         │               │
└─────────┬───────────────────┘               │
          │                                   │
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         🗄️ Supabase (PostgreSQL)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  • profiles (autenticação + vinculação WhatsApp)                         │
│  • pmos (form_data JSONB - 18 seções PMO)                                │
│  • caderno_campo (log imutável de atividades)                            │
│  • talhoes (áreas georreferenciadas)                                     │
│  • pmo_equipamentos (inventário)                                         │
│  • pmo_manejo (planejamento de insumos)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Stack Tecnológica Atual

| Camada | Tecnologia | Versão | Justificativa |
|--------|------------|--------|---------------|
| **Frontend** | React | 19.1.0 | Componentes, PWA, TypeScript parcial |
| **Build** | Vite | 6.3.5 | DX rápido, tree-shaking |
| **UI** | Material UI | 5.14.1 | Design system consistente |
| **Offline** | idb (IndexedDB) | - | Persistência local |
| **Backend** | Python/Flask | 3.10+ | Simplicidade, ecossistema IA |
| **WhatsApp** | WPPConnect | Self-hosted | Controle total, webhook |
| **LLM** | Groq Llama 3.3 | 70B | Extração JSON robusta, baixo custo |
| **STT** | Whisper V3 | Large | Transcrição pt-BR |
| **Database** | Supabase | PostgreSQL | RLS, Auth, JSONB, Real-time |

---

## 4. Contrato de Dados (Backend ↔ Frontend)

> ⚠️ **SEÇÃO CRÍTICA**: Qualquer alteração aqui requer validação conjunta Backend + Frontend para evitar regressões.

### 4.1 Tabela `pmos` — Estrutura `form_data` (JSONB)

```json
{
  "secao_1_descricao_propriedade": { /* ... */ },
  "secao_2_atividades_produtivas_organicas": {
    "producao_primaria_vegetal": {
      "produtos_primaria_vegetal": [ /* Array de produtos */ ]
    }
  },
  "secao_3_atividades_produtivas_nao_organicas": { /* ... */ },
  "secao_4_animais_servico_subsistencia_companhia": { /* ... */ },
  "secao_5_producao_terceirizada": { /* ... */ },
  "secao_6_aspectos_ambientais": { /* ... */ },
  "secao_7_aspectos_sociais": { /* ... */ },
  "secao_8_insumos_equipamentos": { /* ... */ },
  "insumos_melhorar_fertilidade": [ /* ⚠️ NÍVEL RAIZ */ ],
  "secao_9_propagacao_vegetal": { /* ... */ },
  "secao_10_fitossanidade": { /* ... */ },
  "secao_11_colheita": { /* ... */ },
  "secao_12_pos_colheita": { /* ... */ },
  "secao_13_producao_animal": { /* ... */ },
  "secao_14_comercializacao": { /* ... */ },
  "secao_15_rastreabilidade": { /* ... */ },
  "secao_16_sac": { /* ... */ },
  "secao_17_opiniao": { /* ... */ },
  "secao_18_anexos": { /* ... */ }
}
```

### 4.2 Seção 2: Produção Vegetal (Plantio)

**Caminho JSON:**
```
form_data.secao_2_atividades_produtivas_organicas.producao_primaria_vegetal.produtos_primaria_vegetal[]
```

| Campo Backend (IA) | Chave JSONB | Tipo | Obrigatório | Validação |
|-------------------|-------------|------|-------------|-----------|
| `produto` | `produto` | string | ✅ | UPPERCASE |
| `talhao` | `talhoes_canteiros` | string | ✅ | - |
| `area` | `area_plantada` | float | ✅ | > 0 |
| `unidade_area` | `area_plantada_unidade` | string | ✅ | "ha", "m²", "alqueire" |
| `producao_anual` | `producao_esperada_ano` | float | ❌ | ≥ 0 |
| `unidade_producao` | `producao_unidade` | string | ❌ | "ton", "kg", "sc" |
| — | `id` | string | ✅ | `new_{timestamp}` |

### 4.3 Seção 8: Insumos/Fertilidade

> ⚠️ **ATENÇÃO**: Por razões históricas, o array DEVE ser salvo na RAIZ do `form_data`.

**Caminho JSON (CORRETO):**
```
form_data.insumos_melhorar_fertilidade[]
```

| Campo Backend (IA) | Chave JSONB | Tipo | Obrigatório | Exemplo |
|-------------------|-------------|------|-------------|---------|
| `produto` | `produto_ou_manejo` | string | ✅ | "CALDA BORDALESA" |
| `talhao_canteiro` | `onde` | string | ✅ | "Canteiro 2" |
| `data_registro` | `quando` | date | ❌ | "2026-01-19" |
| `procedencia` | `procedencia` | string | ❌ | "Externa" |
| `quantidade_valor + unidade` | `dosagem` | string | ❌ | "5.0 L" |
| — | `id` | uuid | ✅ | uuid.uuid4() |

### 4.4 Tabela `caderno_campo` (Log de Auditoria)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK (auto) |
| `pmo_id` | bigint | FK para `pmos` |
| `talhao_id` | int | FK para `talhoes` (opcional) |
| `tipo_atividade` | text | Plantio, Manejo, Colheita, APLICACAO_INSUMO, HIGIENIZACAO |
| `produto` | text | Nome UPPERCASE |
| `talhao_canteiro` | text | Localização textual |
| `data_registro` | timestamptz | Data da atividade (ISO 8601) |
| `quantidade_valor` | float | Valor numérico (fallback: 0.0) |
| `quantidade_unidade` | text | kg, L, unid, cx, maço, ton |
| `observacao_original` | text | Texto original + alertas de compliance |
| `detalhes_tecnicos` | jsonb | `{subtipo, insumo, dosagem, item_higienizado}` |
| `secao_origem` | text | `wppconnect` ou `frontend` |
| `status` | text | Rascunho, Finalizado, Auditado |

### 4.5 Regras de Normalização

| Aspecto | Regra | Exemplo |
|---------|-------|---------|
| **Produtos** | UPPERCASE, singular | "tomates" → "TOMATE" |
| **Datas** | ISO 8601, fallback `datetime.now()` | "2026-01-19" |
| **Quantidades** | Float, fallback `0.0` | "cinco litros" → 5.0 |
| **Unidades** | Padronizadas | "quilos" → "kg", "litros" → "L" |
| **IDs Backend** | UUID v4 | `uuid.uuid4()` |
| **IDs Frontend** | Timestamp | `new_1750536254819` |

---

## 5. Requisitos Funcionais

### 5.1 Módulo WhatsApp (Voice-to-JSON)

#### US-WA-01: Vinculação por Código

**Como** produtor,  
**Quero** vincular meu WhatsApp ao sistema digitando um código,  
**Para** não precisar criar login/senha.

**Critérios de Aceite:**
- [ ] Gerar código de 6 caracteres alfanuméricos no frontend
- [ ] Código válido por 15 minutos
- [ ] Ao enviar código no WhatsApp, vincular `profiles.telefone` ao `profiles.id`
- [ ] Limpar `profiles.codigo_vinculo` após sucesso
- [ ] Responder com mensagem de boas-vindas personalizada

**Fluxo Técnico:**
```
User → WhatsApp: "G45LID"
Bot → Supabase: SELECT id FROM profiles WHERE codigo_vinculo = 'G45LID'
Bot → Supabase: UPDATE profiles SET telefone = '5531999...@c.us', codigo_vinculo = NULL
Bot → WhatsApp: "✅ Vinculado! Olá [nome], agora você pode registrar suas atividades."
```

---

#### US-WA-02: Registro de Atividade por Texto

**Como** produtor,  
**Quero** enviar uma mensagem descrevendo minha atividade,  
**Para** que seja registrada automaticamente no meu PMO.

**Critérios de Aceite:**
- [ ] Processar mensagens de texto via Llama 3.3 70B (JSON Mode)
- [ ] Extrair: `tipo_atividade`, `produto`, `quantidade_valor`, `quantidade_unidade`, `talhao_canteiro`, `data_registro`
- [ ] Normalizar dados conforme Seção 4.5
- [ ] Inserir no `caderno_campo`
- [ ] Rotear para seção apropriada (Plantio→S2, Manejo/Insumo→S8)
- [ ] Responder com confirmação estruturada

**Exemplo de Entrada/Saída:**
```
Entrada: "Plantei 50 mudas de alface no canteiro 3 ontem"

Saída IA (JSON):
{
  "tipo_atividade": "Plantio",
  "produto": "ALFACE",
  "quantidade_valor": 50,
  "quantidade_unidade": "unid",
  "talhao_canteiro": "canteiro 3",
  "data_registro": "2026-01-18"
}

Resposta WhatsApp:
"✅ Registro Salvo!
🌱 Atividade: Plantio
📝 ALFACE - 50 unid
📍 canteiro 3
📅 18/01/2026"
```

---

#### US-WA-03: Registro de Atividade por Áudio

**Como** produtor,  
**Quero** enviar um áudio descrevendo minha atividade,  
**Para** registrar sem precisar digitar.

**Critérios de Aceite:**
- [ ] Detectar mensagens do tipo `ptt` ou `audio`
- [ ] Baixar mídia via WPPConnect API
- [ ] Transcrever com Whisper V3 Large (pt-BR)
- [ ] Continuar fluxo de processamento por texto

---

#### US-WA-04: Validação de Compliance (Lei 10.831)

**Como** sistema,  
**Quero** bloquear registros com produtos proibidos,  
**Para** proteger a certificação do produtor.

**Produtos Bloqueados:**
```
GLIFOSATO, ROUNDUP, PARAQUAT, 2,4-D, FIPRONIL, METOMIL,
CARBOFURAN, ATRAZINA, GRAMOXONE, DDT, SULFATO DE AMÔNIO,
URÉIA, N-P-K, CLORETO DE POTÁSSIO, MALATHION
```

**Critérios de Aceite:**
- [ ] Verificar produto ANTES de chamar LLM (Circuit Breaker)
- [ ] Retornar `status: "blocked"` sem salvar
- [ ] Enviar mensagem educativa:
  > "⛔ REGISTRO RECUSADO: O produto '[nome]' contém substâncias proibidas pela Lei 10.831. O uso de sintéticos pode cancelar sua certificação."

---

#### US-WA-05: Alertas de Compliance (Não-Bloqueantes)

**Como** sistema,  
**Quero** alertar sobre uso de insumos sensíveis,  
**Para** educar o produtor sem impedir o registro.

**Cenários:**
| Condição | Alerta Gerado |
|----------|---------------|
| Calda Bordalesa / produtos com Cobre | "⚠️ Limite de Cobre: Máximo 6 kg/ha/ano" |
| Esterco / Cama de Aviário | "⚠️ Esterco: Compostar ou aplicar 60 dias antes da colheita" |
| Quantidade > 1000 (kg/L) | "⚠️ Verificação: Quantidade muito alta" |
| Insumo não no PMO | "⚠️ Insumo '[nome]' não consta no planejamento" |
| Talhão não certificado | "⚠️ Local '[nome]' consta como '[status]'" |

**Critérios de Aceite:**
- [ ] Anexar alertas ao campo `observacao_original`
- [ ] Registrar normalmente no `caderno_campo`
- [ ] Incluir alertas na resposta ao usuário

---

### 5.2 Módulo Web (PWA Offline-First)

#### US-WEB-01: Dashboard do Produtor

**Como** produtor,  
**Quero** ver um resumo das minhas atividades recentes,  
**Para** acompanhar minha produção.

**Componentes:**
- Card de colheita acumulada (semana/mês)
- Últimas 5 atividades registradas
- Status do PMO (% preenchido)
- Alerta de sincronização pendente (offline)

---

#### US-WEB-02: Formulário PMO (18 Seções)

**Como** produtor,  
**Quero** preencher o PMO completo pela interface web,  
**Para** complementar dados não registrados por voz.

**Critérios de Aceite:**
- [ ] Navegação entre seções via stepper/tabs
- [ ] Salvamento automático (debounce 2s)
- [ ] Validação inline com Zod
- [ ] Indicador visual de seções preenchidas

---

#### US-WEB-03: Caderno de Campo Digital

**Como** consultor,  
**Quero** filtrar e exportar registros do caderno,  
**Para** gerar relatórios de auditoria.

**Critérios de Aceite:**
- [ ] Tabela com colunas: Data, Tipo, Produto, Local, Quantidade, Status
- [ ] Filtros por período, tipo de atividade, produto
- [ ] Ordenação por qualquer coluna
- [ ] Exportação CSV/PDF
- [ ] Indicador de origem (WhatsApp vs Web)
- [ ] Visualização de alertas de compliance

---

#### US-WEB-04: Registro Manual de Atividade

**Como** produtor,  
**Quero** adicionar atividades manualmente pelo site,  
**Para** registrar quando não tenho acesso ao WhatsApp.

**Critérios de Aceite:**
- [ ] Modal/Dialog com campos: Tipo, Produto, Local, Data, Quantidade, Observação
- [ ] Validação de campos obrigatórios
- [ ] Para edição: exigir justificativa (modal secundário)
- [ ] Marcar `secao_origem = 'frontend'`

---

#### US-WEB-05: Funcionamento Offline

**Como** produtor em área rural,  
**Quero** continuar usando o app sem internet,  
**Para** não perder registros.

**Critérios de Aceite:**
- [ ] Service Worker cacheando assets estáticos
- [ ] Persistência local via IndexedDB (idb)
- [ ] Fila de operações pendentes
- [ ] Sincronização automática ao reconectar
- [ ] Indicador visual de modo offline

---

### 5.3 Módulo de Auditoria

#### US-AUD-01: Log Imutável

**Como** auditor,  
**Quero** que registros sincronizados não possam ser deletados,  
**Para** garantir rastreabilidade legal.

**Critérios de Aceite:**
- [ ] RLS PostgreSQL bloqueando DELETE em `caderno_campo`
- [ ] Status "Auditado" impede UPDATE
- [ ] Histórico de modificações preservado

---

#### US-AUD-02: Exportação do PMO em PDF

**Como** produtor,  
**Quero** exportar meu PMO completo em PDF,  
**Para** enviar à certificadora.

**Critérios de Aceite:**
- [ ] Layout fiel ao modelo oficial do MAPA
- [ ] Inclusão de selo "Powered by AgroVivo" (viral)
- [ ] QR Code linkando para versão digital

---

## 6. Requisitos Não-Funcionais

### 6.1 Performance

| Métrica | Target | Tolerável |
|---------|--------|-----------|
| Tempo de resposta WhatsApp | < 5s | < 10s |
| Primeira carga PWA (cold) | < 3s | < 5s |
| Sync offline → online | < 2s | < 5s |

### 6.2 Segurança

| Requisito | Implementação |
|-----------|---------------|
| **Autenticação** | Supabase Auth (Email/Magic Link) |
| **Autorização** | RLS por `user_id` em todas as tabelas |
| **Webhook** | Token bearer no header (`WEBHOOK_SECRET`) |
| **Sanitização** | Escape HTML no `ai_processor.py` |
| **Proteção de Estado** | Estados "Auditado"/"Finalizado" bloqueiam edição |

### 6.3 Disponibilidade

| Componente | SLA Target |
|------------|------------|
| Frontend (Vercel/Netlify) | 99.9% |
| Supabase Database | 99.5% |
| Bot WhatsApp | 95% (dependente de WPPConnect) |

### 6.4 Escalabilidade

- **Fase 1 (1-50 usuários):** Single instance Flask + Supabase Free
- **Fase 2 (50-200 usuários):** Supabase Pro + Cache Redis
- **Fase 3 (200+ usuários):** Migração para n8n + Edge Functions

---

## 7. Regras de Sincronização e Conflitos

### 7.1 Fontes de Dados

```
┌─────────────────┐     ┌─────────────────┐
│    WhatsApp     │     │      Web        │
│  (via IA Bot)   │     │  (via Frontend) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│            caderno_campo                │
│      (secao_origem identifica)          │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         pmos.form_data (JSONB)          │
│    (Seções 2, 8, etc. sincronizadas)    │
└─────────────────────────────────────────┘
```

### 7.2 Estratégia de Resolução

| Cenário | Resolução |
|---------|-----------|
| Mesmo produto, mesmo dia, fontes diferentes | Criar registros separados (auditável) |
| Edição manual de registro via IA | Exigir justificativa no frontend |
| Conflito de sincronização offline | Last-Write-Wins com timestamp `updated_at` |
| Registro em estado "Auditado" | Bloqueio de modificação (erro 403) |

### 7.3 Campo `secao_origem` (Traceability)

| Valor | Significado |
|-------|-------------|
| `wppconnect` | Criado via WhatsApp Bot |
| `frontend` | Criado/editado via interface web |
| `migracao` | Dados legados importados |

---

## 8. Estratégia de Crescimento

### 8.1 Coeficiente Viral (K > 1)

#### Tática 1: Selo "Powered by AgroVivo"

Todo PDF exportado inclui:
```
┌─────────────────────────────────────────┐
│  Este PMO foi gerado com AgroVivo       │
│  www.agrovivo.com.br | Fale com a IA!   │
└─────────────────────────────────────────┘
```

**Impacto esperado:** Cada PMO enviado à certificadora expõe 3-5 novos prospects (consultores, outros produtores da cooperativa).

#### Tática 2: Resumo Semanal Compartilhável

Toda sexta-feira, o bot envia automaticamente:
```
📊 Seu Resumo Semanal:
• 🌱 3 plantios registrados
• 🌾 45 kg colhidos
• ✅ PMO 68% completo

[Compartilhar no grupo da cooperativa]
```

**Impacto esperado:** Produtores compartilham nos grupos de WhatsApp, gerando buzz orgânico.

### 8.2 Funil de Conversão

```
Visitante → Lead → Ativação → Retenção → Referência
           │        │          │          │
           │        │          │          └ Selo PDF + Resumo
           │        │          └ Uso semanal do Caderno
           │        └ Primeiro registro via WhatsApp
           └ Cadastro + Vinculação
```

### 8.3 Métricas de Retenção (North Star)

| Métrica | Meta Semanal |
|---------|--------------|
| Registros via WhatsApp por usuário | ≥ 2 |
| Acessos ao Caderno de Campo (web) | ≥ 1 |
| Taxa de churn mensal | < 5% |

### 8.4 Marcos de Escala

| Marco | Foco | Ações |
|-------|------|-------|
| **0-10 usuários** | Validação | Onboarding 1:1, coleta de feedback intensiva |
| **10-50 usuários** | Produto | Features baseadas em feedback, automação de onboarding |
| **50-100 usuários** | Distribuição | Parcerias com cooperativas, conteúdo educativo |
| **100-500 usuários** | Receita | Planos pagos, consultoria premium |

---

## 9. Roadmap de Expansão

### 9.1 Fase Atual (v2.0) — ✅ Concluído

| Feature | Status |
|---------|--------|
| Vinculação WhatsApp por código | ✅ |
| Processamento de texto/áudio | ✅ |
| Sincronização Seção 2 (Plantio) | ✅ |
| Sincronização Seção 8 (Insumos) | ✅ |
| Caderno de Campo com filtros | ✅ |
| Validação de compliance (bloqueio) | ✅ |
| Alertas de compliance (não-bloqueantes) | ✅ |
| PWA básico (Service Worker) | ✅ |

### 9.2 Fase 2.1 — Q1 2026

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| **Seção 11 (Colheita)** | Visualização de dados de colheita no dashboard | 🔴 Alta |
| **Validação Semântica** | Regras de negócio adicionais (dosagem máxima, período de carência) | 🔴 Alta |
| **Offline Completo** | Fila de sincronização para registros manuais | 🟡 Média |
| **Notificações Push** | Alertas de pendências e lembretes | 🟡 Média |

### 9.3 Fase 2.2 — Q2 2026

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| **Orquestração n8n** | Migrar lógica de roteamento para fluxos visuais | 🔴 Alta |
| **Múltiplos PMOs** | Suporte a produtor com várias propriedades | 🟡 Média |
| **Exportação PDF** | Geração do PMO oficial com selo AgroVivo | 🟡 Média |
| **Dashboard Consultor** | Visão multi-cliente para técnicos | 🟢 Baixa |

### 9.4 Fase 3.0 — Q3/Q4 2026

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| **RAG (Retrieval-Augmented Generation)** | Bot responde perguntas sobre Lei 10.831, IN 46, etc. | 🔴 Alta |
| **Integração com Sensores IoT** | Leitura automática de temperatura/umidade | 🟢 Baixa |
| **API Pública** | Integrações com sistemas de certificadoras | 🟢 Baixa |
| **App Nativo (React Native)** | Performance e UX otimizados para mobile | 🟡 Média |

### 9.5 Arquitetura Futura (n8n + RAG)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            n8n Workflow Engine                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   [Webhook WPP]──┬──[Transcrição]──[Classificador]                      │
│                  │                       │                               │
│                  │         ┌─────────────┼─────────────┐                 │
│                  │         ▼             ▼             ▼                 │
│                  │   [Registro]    [Pergunta]    [Saudação]              │
│                  │       │              │             │                  │
│                  │       ▼              ▼             ▼                  │
│                  │   [Validar]     [RAG Query]   [Resposta]              │
│                  │       │              │                                │
│                  │       ▼              ▼                                │
│                  │   [Supabase]    [Pinecone]                            │
│                  │                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Métricas de Sucesso

### 10.1 Métricas de Produto (Weekly)

| Métrica | Meta | Atual |
|---------|------|-------|
| **Registros via WhatsApp** | ↑ 20% WoW | - |
| **Taxa de sucesso do processamento IA** | > 95% | - |
| **Tempo médio de resposta** | < 5s | - |
| **Usuários ativos semanais (WAU)** | 80% dos cadastrados | - |

### 10.2 Métricas de Negócio (Monthly)

| Métrica | Meta | Atual |
|---------|------|-------|
| **Novos cadastros** | +15% MoM | - |
| **Churn** | < 5% | - |
| **NPS** | > 50 | - |
| **PMOs para auditoria gerados** | 1 por usuário ativo | - |

### 10.3 Métricas de Saúde Técnica

| Métrica | Target |
|---------|--------|
| **Uptime Bot** | > 95% |
| **Erros de parsing IA** | < 5% |
| **Conflitos de sincronização** | < 1% |
| **Tempo de build frontend** | < 60s |

---

## Apêndice A: Glossário

| Termo | Definição |
|-------|-----------|
| **PMO** | Plano de Manejo Orgânico — documento exigido pela IN 46/2011 |
| **Caderno de Campo** | Registro cronológico de todas as atividades agrícolas |
| **RLS** | Row-Level Security — política de acesso no PostgreSQL |
| **PTT** | Push-To-Talk — mensagem de áudio no WhatsApp |
| **STT** | Speech-To-Text — transcrição de áudio para texto |
| **LLM** | Large Language Model — modelo de linguagem (Llama 3.3) |
| **RAG** | Retrieval-Augmented Generation — LLM com base de conhecimento |

---

## Apêndice B: Referências

- [Lei 10.831/2003](http://www.planalto.gov.br/ccivil_03/leis/2003/l10.831.htm) — Lei dos Orgânicos
- [Portaria MAPA 52/2021](https://www.gov.br/agricultura/pt-br) — Regulamentação PMO
- [WPPConnect Documentation](https://wppconnect.io/)
- [Supabase Documentation](https://supabase.com/docs)
- [Groq API Reference](https://console.groq.com/docs)

---

**Documento aprovado por:** ____________  
**Data de aprovação:** ___/___/______

---

*Este documento é um artefato vivo e deve ser atualizado a cada sprint ou alteração significativa de escopo.*
