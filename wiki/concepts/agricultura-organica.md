# Agricultura orgânica

Sistema de produção que dispensa insumos sintéticos e organismos
geneticamente modificados, sustentando a fertilidade por manejo biológico do
solo, diversificação, ciclagem de nutrientes e controle preventivo.

No Brasil, o conceito não é apenas técnico: é **jurídico**. A Lei 10.831/2003
define o que pode ser chamado de orgânico, e apenas produtos com garantia
formal — ver [[certificacao-organica]] — podem ser comercializados com essa
alegação.

## Por que isso define o produto

O Manejo.ORG não é um app de gestão agrícola genérico. Toda entidade do
sistema existe para produzir **prova auditável** de conformidade:

- O que se planeja fazer vira [[plano-de-manejo-organico]].
- O que se fez de fato vira [[caderneta-de-campo]].
- O que entrou na lavoura passa por [[compliance-de-insumos]].
- O que saiu para o mercado carrega [[rastreabilidade]].

Uma propriedade pode estar em três modalidades — orgânica, em transição ou
convencional. A convivência entre elas é o problema tratado em
[[producao-paralela]].

## Onde isso aparece no código

O enum `modalidade_producao_enum` (`ORGANICO`, `TRANSICAO`, `CONVENCIONAL`)
é criado em `supabase/migrations/20260330_bootstrap_extensions_and_types.sql`
e carimbado em [[propriedade]], [[talhao]] e em cada [[registro-de-caderno]].

## Fontes

- `docs/knowledge_base/L10831.pdf`
- `docs/knowledge_base/PR.0122-Organica-Informacoes-Basicas_web.pdf`
