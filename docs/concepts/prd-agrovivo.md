# 🌿 ManejoOrg 2.1 — Product Requirements Document (PRD)

> Digitalização, Automação FSM e Mapeamento GIS de Planos de Manejo Orgânico

**Versão:** 2.1.0 (Atualização Arquitetural Pós-Pivot)  
**Data:** 9 de Julho de 2026  
**Status:** Ativo / Em Produção  
**Autor:** Equipe ManejoOrg

---

## 📋 Índice

1. [Visão Geral e Estratégia](#1-visão-geral-e-estratégia)
2. [Personas de Usuário](#2-personas-de-usuário)
3. [Arquitetura do Sistema (Pivot Arquitetural)](#3-arquitetura-do-sistema-pivot-arquitetural)
4. [Contrato de Dados e Injeção Geoespacial](#4-contrato-de-dados-e-injeção-geoespacial)
5. [Requisitos Funcionais Evoluídos](#5-requisitos-funcionais-evoluídos)
6. [Requisitos Não-Funcionais e Performance](#6-requisitos-não-funcionais-e-performance)
7. [Regras de Sincronização e Conflitos](#7-regras-de-sincronização-e-conflitos)
8. [Estratégia de Crescimento](#8-estratégia-de-crescimento)
9. [Roadmap de Expansão (Atualizado)](#9-roadmap-de-expansão-atualizado)
10. [Métricas de Sucesso](#10-métricas-de-sucesso)

---

## 1. Visão Geral e Estratégia

### 1.1 O Problema

A certificação orgânica exige documentação complexa (**18 seções** do Plano de Manejo Orgânico oficial), gerando:
- **Barreira de entrada** para pequenos produtores sem experiência administrativa
- **Perda de tempo** preenchendo formulários em papel/Excel
- **Risco de não-conformidade** por falta de rastreabilidade
- **Custo elevado** de consultoria técnica para cumprir a Lei 10.831/2003

### 1.2 A Solução ManejoOrg 2.1

A solução evoluiu de um simples bot "Voice-to-JSON" para um **ecossistema cognitivo e geoespacial de alta performance** baseado nos seguintes pilares:

1. **Voz ou Texto:** O produtor registra as atividades diárias no WhatsApp por voz ou por texto ("Plantei 50 mudas de alface no canteiro 3").
2. **FSM Cognitiva em Golang:** Uma Máquina de Estados em Golang gerencia o fluxo de processamento e classifica a intenção do usuário utilizando a **Google Gemini API**.
3. **Módulo RAG em Tempo Real:** Responde instantaneamente a dúvidas sobre a legislação de orgânicos (Lei 10.831/2003).
4. **Mapeamento GIS (WebGL):** O frontend renderiza a fazenda utilizando **React + MapLibre GL JS**, associando os registros do caderno de campo aos polígonos reais dos talhões.
5. **Validação Ativa (Output Judge):** Garante conformidade e validação contra regras de compliance antes de efetivar qualquer registro ou resposta.

### 1.3 Proposta de Valor

| Para | Valor Entregue |
|------|----------------|
| **Produtor Orgânico** | Registra atividades falando no WhatsApp e visualiza sua fazenda mapeada com polígonos reais |
| **Consultor Técnico** | Dashboard com monitoramento georreferenciado, rastreabilidade total e alertas de compliance |
| **Certificadora** | Caderno de campo auditável integrado a polígonos espaciais e histórico imutável |

### 1.4 "Aha Moment"

> *"Mandei um áudio dizendo onde apliquei o insumo e o talhão correspondente acendeu no mapa da minha fazenda!"*

O **momento de ativação** ocorre quando o produtor envia a primeira mensagem por voz no WhatsApp, o sistema interpreta a atividade e o local, atualizando em tempo real a geometria do talhão no painel WebGL do frontend.

---

## 2. Personas de Usuário

### 2.1 Persona Primária: Dona Maria (Produtora)

| Atributo | Descrição |
|----------|-----------|
| **Idade** | 52 anos |
| **Escolaridade** | Ensino fundamental |
| **Tecnologia** | WhatsApp no celular básico (Android Go) |
| **Dores** | Formulários complicados, medo de perder certificação |
| **Objetivo** | Manter registros sem "pegar no papel" e ver sua fazenda digitalizada |
| **Frequência de uso** | 3-5 registros por semana |

### 2.2 Persona Secundária: João (Consultor Técnico/Auditor)

| Atributo | Descrição |
|----------|-----------|
| **Idade** | 35 anos |
| **Formação** | Agronomia |
| **Tecnologia** | Notebook + smartphone |
| **Dores** | Consolidar dados de múltiplos produtores, desenhar croquis de talhões |
| **Objetivo** | Garantir conformidade dos seus clientes com precisão geográfica |
| **Frequência de uso** | Diária (verificação e mapeamento) |

---

## 3. Arquitetura do Sistema (Pivot Arquitetural)

A arquitetura do sistema realizou uma transição crítica de Python/Flask para **Golang (Clean Architecture / Ports & Adapters)**, com o objetivo de assegurar latência ultrabaixa e processamento assíncrono avançado através de goroutines.

### 3.1 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CANAIS DE ENTRADA                          │
├─────────────────────┬───────────────────────────────────────────────────┤
│    📱 WhatsApp      │                🌐 Web (PWA)                       │
│ (Evolution API /    │             (React 19 + Vite)                     │
│    WPPConnect)      │                                                   │
└─────────┬───────────┴───────────────────────┬───────────────────────────┘
          │                                   │
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          ORQUESTRAÇÃO (BACKEND)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                          pmo-bot-go (Golang)                            │
│  • Workers assíncronos (errgroup)                                       │
│  • FSM Cognitiva (Máquina de Estados)                                   │
│  • RAG Parser (ledongthuc/pdf para leitura de manuais)                   │
└─────────┬───────────────────────────────────┬───────────────────────────┘
          │                                   │
          ▼                                   ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│       🤖 IA & NLP           │    │       🌐 Frontend (GIS)      │
│  • Google Gemini API        │    │  • React 19 + MapLibre GL   │
│    (Classificador, Output   │    │  • WebGL GPU-First          │
│     Judge, Orchestrator)    │    │  • setFeatureState          │
│  • Fallback: OpenRouter     │    │                             │
└─────────┬───────────────────┘    └─────────┬───────────────────┘
          │                                   │
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        🗄️ PERSISTÊNCIA E FILAS                           │
├─────────────────────────────────────────────────────────────────────────┤
│  • PostgreSQL (Supabase)                                                │
│  • Redis (Docker Compose para gerenciamento de filas de concorrência)   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Stack Tecnológica Atualizada

| Camada | Tecnologia | Justificativa do Pivot |
|--------|------------|------------------------|
| **Frontend / GIS** | React 19 + MapLibre GL JS | Performance GPU/WebGL para renderização de polígonos complexos de talhões sem travar a DOM do navegador. |
| **Backend** | Golang (`pmo-bot-go`) | Substituiu o Python/Flask para permitir uso nativo de *goroutines*, paralelização segura com `errgroup` e latência ultrabaixa (resposta em menos de 4 segundos). |
| **Integração WhatsApp** | Evolution API / WPPConnect | Abstração em Go através do padrão "Ports and Adapters" para garantir redundância, resiliência e failover no envio de mensagens. |
| **IA / Cognição** | Google Gemini API | Maior velocidade no *Time-to-First-Token* (TTFT) substituindo o Llama 3.3/Groq para a orquestração da FSM e classificação de intenções. |
| **Base de Dados** | Supabase (PostgreSQL) | Mantido. Uso extensivo de tabelas JSONB para seções flexíveis do PMO e suporte nativo ao PostGIS para georreferenciamento de talhões. |

---

## 4. Contrato de Dados e Injeção Geoespacial

### 4.1 Estrutura de Talhões (Módulo GIS)
Além da estrutura textual clássica, o sistema agora integra dados geoespaciais e de telemetria. Os talhões incorporam coordenadas no padrão `LngLat` e Bounding Boxes para navegação interativa no mapa.

```json
{
  "talhao_id": "uuid",
  "nome": "Canteiro 3 - Hortaliças",
  "geometria": {
    "type": "Polygon",
    "coordinates": [
      [
        [-45.8823, -22.1245],
        [-45.8818, -22.1248],
        [-45.8820, -22.1255],
        [-45.8825, -22.1252],
        [-45.8823, -22.1245]
      ]
    ]
  },
  "area_hectares": 1.2
}
```

### 4.2 Telemetria de Latência
O backend Go monitora o tempo de execução de cada estágio da FSM e registra a latência no `server.log`. Adicionalmente, grava logs de telemetria assíncronos no Supabase sem bloquear o processamento do usuário.

*Exemplo de log:* `[TRACING] Google Gemini API: 1.5s`

### 4.3 Tabela `pmos` — Estrutura `form_data` (JSONB)
Permanece o contrato de compatibilidade com as 18 seções oficiais do PMO.

```json
{
  "secao_1_descricao_propriedade": { },
  "secao_2_atividades_produtivas_organicas": {
    "producao_primaria_vegetal": {
      "produtos_primaria_vegetal": []
    }
  },
  "secao_3_atividades_produtivas_nao_organicas": { },
  "secao_8_insumos_equipamentos": { },
  "insumos_melhorar_fertilidade": [], 
  "secao_11_colheita": { }
}
```

---

## 5. Requisitos Funcionais Evoluídos

### 5.1 Módulo FSM e Guardrails (Backend Go)

#### US-FSM-01: Bypass Seletivo de Guardrails
O sistema deve contornar a validação do `Output Judge` para intenções classificadas puramente como `CHAT` (saudações, conversas gerais ou mensagens fora de contexto de registro).
- **Critério de Aceite:** Economia média de ~830ms de latência ao evitar chamadas redundantes da LLM para mensagens que não alteram dados.

#### US-FSM-02: RAG em Tempo Real
O sistema deve processar manuais técnicos em PDF (via `ledongthuc/pdf`) e a legislação oficial da Lei 10.831 para responder às dúvidas do produtor diretamente através de uma intenção específica (`RAG`) mapeada na FSM.
- **Critério de Aceite:** O usuário pode perguntar "posso usar calda bordalesa no tomate?" e receber uma resposta fundamentada nos PDFs da base de conhecimento.

#### US-FSM-03: Processamento Concorrente
Validacões de cota, consultas ao Supabase e extrações de intenções devem ser executadas concorrentemente no backend Go através do pacote `errgroup`.
- **Critério de Aceite:** Redução do gargalo sequencial no backend, garantindo que o processamento do pipeline não ultrapasse o SLA.

---

### 5.2 Módulo GIS e Caderno de Campo (Frontend)

#### US-GIS-01: Renderização Segura de Mapas
O `MapController` deve utilizar tratamentos de erro rigorosos (`try/catch`) e validações contra coordenadas inválidas (`anti-NaN` e `safeFitBounds`) ao desenhar os talhões.
- **Critério de Aceite:** Evitar travamentos do tipo "White Screen of Death" (tela branca) quando o mapa for carregado com talhões sem coordenadas válidas configuradas.

#### US-GIS-02: Estado GPU-First
A pintura e alteração de estado visual dos talhões selecionados no mapa devem utilizar o método `map.setFeatureState` do MapLibre GL JS diretamente na GPU.
- **Critério de Aceite:** Evitar re-renderizações desnecessárias do React (`useState`) para permitir a manipulação fluida do mapa mesmo em propriedades com +40.000 pontos e polígonos complexos.

---

## 6. Requisitos Não-Funcionais e Performance

### 6.1 SLA de Performance Pós-Pivot

| Métrica | Target V2.1 (Go) | Observações / Como foi obtido |
|---------|------------------|-------------------------------|
| **Latência Total da FSM** | < 4s | Obtido através do bypass seletivo do Output Judge e processamento paralelo com `errgroup`. |
| **Latência Setup (Go Internals)** | < 1s | Tempo interno de CPU do Go para orquestrar as rotinas, excluindo chamadas externas de API de IA. |
| **Renderização do Mapa** | 60 FPS | Garantido pelo uso de WebGL na GPU via MapLibre GL JS e isolamento de estados do React. |

---

## 7. Regras de Sincronização e Conflitos

### 7.1 Fontes de Sincronização
As atividades enviadas via WhatsApp alimentam a tabela `caderno_campo` com `secao_origem = 'wppconnect'` ou `secao_origem = 'evolution'`. A sincronização com a coluna JSONB `form_data` em `pmos` ocorre de forma reativa no banco de dados.

### 7.2 Resolução de Conflitos GIS
- **Geometria Duplicada:** Em caso de sobreposição espacial de polígonos desenhados de forma offline e sincronizados tardiamente, o sistema adota a estratégia de *Last-Write-Wins* baseada na coluna `updated_at`.
- **Validação de Área:** A área cadastrada textualmente pelo áudio deve ser validada contra a área geométrica calculada do polígono (tolerância de discrepância de até 15%).

---

## 8. Estratégia de Crescimento

### 8.1 Coeficiente Viral (K > 1)

#### Tática 1: Selo "Gerado por ManejoOrg"
Todo PDF do PMO oficial exportado para as certificadoras conterá no rodapé:
```
📄 Este Plano de Manejo Orgânico foi gerado automaticamente por ManejoOrg.
Acesse www.manejoorg.com.br e automatize a gestão da sua fazenda.
```

#### Tática 2: Relatório Espacial Compartilhável
Permite ao consultor técnico gerar um link público do mapa da propriedade com o histórico das últimas atividades realizadas nos talhões, facilitando a apresentação para cooperativas e potenciais compradores.

---

## 9. Roadmap de Expansão (Atualizado)

### 9.1 Fase Atual (v2.1 — Concluído)
- [x] Migração completa do backend para Golang (Clean Architecture).
- [x] Implementação da FSM Cognitiva integrada com a Google Gemini API.
- [x] Módulo RAG ativo para consulta de Legislação Orgânica (Lei 10.831).
- [x] Renderização e mapeamento GIS via MapLibre GL JS no Frontend.
- [x] Rastreamento de latência e telemetria integrados ao Supabase.

### 9.2 Fase 2.2 (Próximos Passos)

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| **Otimização de TTFT** | Explorar modelos mais eficientes e de menor latência (como Gemini 1.5 Flash-Lite) para o roteador e classificador de FSM. | 🔴 Alta |
| **Sincronização Offline do GIS** | Implementar cache de *tiles* do MapLibre e polígonos no IndexedDB para uso completo do mapa em áreas sem cobertura de rede móvel. | 🟡 Média |
| **Exportação de Mapas no PDF** | Incluir captura estática da propriedade e divisão de talhões diretamente no relatório PDF do PMO gerado. | 🟢 Baixa |

---

## 10. Métricas de Sucesso

### 10.1 Métricas de Saúde Técnica (v2.1)
- **Tempo de Resposta do Bot (End-to-End):** Abaixo de 4.5 segundos em conexões 3G.
- **Precisão de Mapeamento Geográfico:** 100% de consistência de polígonos geo-indexados no Supabase.
- **Sucesso da FSM (Sem Fallback):** Superior a 97% na classificação de intenções complexas de agricultura.

---
*Este documento é um artefato vivo e define as metas do ecossistema ManejoOrg 2.1.*
