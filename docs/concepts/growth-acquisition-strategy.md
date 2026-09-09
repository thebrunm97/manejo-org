# Estratégia de Aquisição — Orgânico e Pago

> Complementa a seção 8 ("Estratégia de Crescimento") do [PRD](./prd-agrovivo.md).
> Documento vivo — sem orçamento de mídia definido no momento (2026-09).

## 0. Situação atual

Não existe hoje nenhum canal ativo de aquisição além do boca-a-boca e das duas táticas
virais já descritas no PRD (selo "Gerado por ManejoOrg" no PDF exportado, relatório
espacial compartilhável). Não há verba para mídia paga. Os dois ativos que a equipe já tem
para trabalhar são:

- **Planilha CNPO (Cadastro Nacional de Produtores Orgânicos, MAPA):** nome, telefone e
  e-mail de produtores certificados, com dados de UF/localização.
- **Contatos de OPACs, OCS e OACs:** os organismos de certificação/controle social que
  atendem esses produtores.

Avaliação do repositório [`google/skills`](https://github.com/google/skills): contém
skills técnicas para Google Ads API, Data Manager API e Google Analytics API — todas
pressupõem conta de anúncios ativa e orçamento de mídia. Não há nada de estratégia
orgânica, SEO ou growth ali. **Conclusão:** prematuro para a fase atual; revisitar quando
existir orçamento e uma campanha paga real para instrumentar (ver seção 3).

## 1. Orgânico (fase atual, custo ≈ zero)

### 1.1 OPACs/OCS/OACs como canal multiplicador (prioridade #1)
Contato individual e frio com milhares de produtores da planilha CNPO tem custo alto por
conversão e risco de compliance (ver seção 2). Um organismo de certificação/controle social
concentra dezenas a centenas de produtores sob uma única relação de confiança já
estabelecida — e o produto já suporta esse modelo via multitenancy/organizações (ADR-010).
Uma parceria fechada com uma OPAC/OCS/OAC vale, em alcance, muito mais que dezenas de
contatos individuais.

- Priorizar organismos em regiões/culturas onde o ManejoOrg já tem cobertura de conteúdo
  (ex.: culturas já mapeadas no ZARC, legislação já coberta no RAG).
- Abordagem sugerida: demonstração do caderno de campo + geração automática do PMO como
  ferramenta de apoio ao trabalho do próprio organismo (menos trabalho de auditoria para
  eles), não só um "produto para o produtor".

### 1.2 Segmentação da planilha CNPO
Usar a planilha para priorizar, não para disparo em massa: cruzar UF/cultura/tipo de
certificação com onde o produto já é forte, e usar essa lista para embasar quais
OPACs/OCS/OACs abordar primeiro (seção 1.1) — o contato direto ao produtor individual só
deve acontecer depois de uma base legal e um canal adequados (seção 2).

### 1.3 Reforçar os loops virais já existentes
Antes de somar canais novos, medir e reforçar o que já existe no PRD:
- Selo "Gerado por ManejoOrg" no PDF do PMO exportado para certificadoras.
- Link público de relatório espacial da propriedade, compartilhável com cooperativas e
  compradores.

Ambos já rodam sem custo adicional — o ganho está em rastrear quantos cliques/registros
eles geram (ver seção 4) para saber se vale investir em ampliá-los.

### 1.4 Conteúdo educativo
A base de conhecimento RAG (Lei 10.831/2003, manuais técnicos já ingeridos) já existe e
pode virar conteúdo educativo de baixo esforço (respostas prontas reaproveitadas em
posts/mensagens) para produtores e OPACs, sem trabalho novo de pesquisa.

## 2. Compliance do outreach (ler antes de operacionalizar qualquer contato frio)

- **LGPD:** a planilha CNPO é dado público do MAPA, mas usá-la para contato ativo de
  marketing exige base legal própria (legítimo interesse, com teste de balanceamento) e
  opt-out fácil e claro. Isso é diferente da base legal já documentada em
  [`pmo-bot-go/docs/LGPD_GUIDELINES.md`](../../pmo-bot-go/docs/LGPD_GUIDELINES.md), que
  cobre dado operacional de quem **já é usuário** — não cobre prospecção fria.
- **Política do WhatsApp Business:** disparar mensagens não solicitadas em volume para
  números que nunca interagiram com o número oficial do bot arrisca degradar a qualidade
  do número ou banimento. Por isso:
  - Contato frio inicial deve ser por **e-mail** ou **intermediado pela OPAC/OCS/OAC**
    (que já tem relação com o produtor), nunca WhatsApp direto em massa.
  - WhatsApp só entra depois que o produtor iniciar a conversa ou der opt-in explícito.

## 3. Pago (fase futura — não iniciar sem orçamento definido)

Pré-requisitos antes de considerar qualquer campanha paga:
1. Orçamento de mídia definido pelo negócio.
2. Tração orgânica mínima que valide mensagem/proposta de valor (seção 1).
3. Tracking mínimo — reaproveitar o que o Supabase já registra + UTMs simples nos links
   compartilháveis (seção 1.3), sem subir ferramenta de analytics nova (infra enxuta).

Só nesse ponto vale revisitar as skills técnicas do `google/skills` (Google Ads API,
Data Manager API) para instrumentar campanhas via API — hoje seria infraestrutura sem uso
real por trás.

## 4. Métricas (enxuto, sem infra nova)

- UTM simples nos dois loops virais existentes (seção 1.3) para saber quantos
  cliques/cadastros eles geram.
- Contagem de parcerias OPAC/OCS/OAC fechadas e produtores cobertos por elas — é a métrica
  mais barata de acompanhar e a que mais indica se a prioridade #1 (seção 1.1) está
  funcionando.
- Não criar dashboard novo enquanto o volume não justificar — revisar manualmente a cada
  ciclo até que valha a pena automatizar.
