# RAW — Material bruto, ainda não processado

Zona de entrada da base de conhecimento. Tudo que chega ao projeto sem
tratamento vive aqui até ser lido, destilado e transformado em notas na
[[wiki-index]].

## O que colocar aqui

- Especificações técnicas e PRDs recebidos de terceiros.
- Legislação, instruções normativas e material de certificação em PDF.
- Transcrições de reuniões com produtores, cooperativas e certificadoras.
- Rascunhos, anotações de campo, exports de pesquisa.
- Dumps de dados usados para investigar um problema pontual.

## O que NÃO colocar aqui

- Nota já destilada — vai para `wiki/concepts`, `wiki/entities` ou `wiki/components`.
- Segredos, `.env`, chaves de API ou dados pessoais de produtores.
- Binários grandes que já existam em `docs/knowledge_base/`.

## Regra do fluxo

O material bruto é **descartável**: uma vez que o conteúdo relevante virou
nota interligada na wiki, o arquivo em `RAW/` serve apenas como procedência.
Toda nota derivada de um arquivo daqui deve citar o arquivo de origem na
seção `Fontes`.

## Material bruto já existente no repositório

Antes de reingerir qualquer coisa, verifique o que já está mapeado:

- `docs/knowledge_base/` — corpus regulatório em PDF (Lei 10.831, Decreto 6.323,
  IN 13/2015, IN 17, IN 18, IN 19, IN 23, IN 28, Portaria MAPA 52/2021,
  selo brasileiro, programa de olericultura orgânica). É a fonte primária do
  [[rag-e-base-de-conhecimento]].
- `docs/raw/` — pesquisas internas já escritas (`RESEARCH_PWA_OFFLINE.md`,
  `RESEARCH_RASTREABILIDADE.md`, `RESEARCH_FINANCEIRO.md`,
  `RESEARCH_COOP_DASHBOARD.md`) e um guia da Embrapa já ingerido.
- `docs/plans/` e `docs/PLAN-*.md` — planos de implementação por feature.
