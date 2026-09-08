# Certificação orgânica

Para vender como orgânico no Brasil, o produtor precisa estar em um dos
mecanismos de controle previstos na Lei 10.831/2003 e regulamentados pelo
Decreto 6.323/2007 e pela IN 19/2009:

1. **Certificação por auditoria** — um Organismo de Avaliação da
   Conformidade (OAC) audita e emite o certificado.
2. **Sistema Participativo de Garantia (SPG)** — controle social organizado,
   com responsabilidade solidária entre os pares. Ver
   [[spg-sistema-participativo-de-garantia]].
3. **Controle Social na Venda Direta (OCS)** — dispensa de certificação para
   agricultura familiar em venda direta ao consumidor, mediante cadastro.

Em todos os casos, dois artefatos são exigidos do produtor: o
[[plano-de-manejo-organico]] e os registros de execução, ou seja, a
[[caderneta-de-campo]].

## O que o software precisa garantir

- **Integridade temporal** — registro não pode ser reescrito sem rastro.
- **Isolamento por titular** — cada produtor vê apenas seus dados
  (RLS, ver [[supabase-postgres]]).
- **Cadeia de custódia** — do canteiro ao lote, ver [[rastreabilidade]].
- **Conformidade de insumo** — ver [[compliance-de-insumos]].

## Corpus normativo no repositório

`docs/knowledge_base/` contém a legislação em PDF que alimenta o
[[rag-e-base-de-conhecimento]]:

| Arquivo | Assunto |
| --- | --- |
| `L10831.pdf` | Lei da agricultura orgânica |
| `Decreto_6323_...pdf` | Regulamentação da Lei 10.831 |
| `11IN_19_28052009_MECANISMOS.pdf` | Mecanismos de controle |
| `IN_13_28052015_CPOrg_e_STPOrg.pdf` | Cadastro e sistemas de produção |
| `IN_18_de_20062014_SELO_BRASILEIRO.pdf` | Selo do SisOrg |
| `INC_17`, `INC_18`, `INI_28`, `IN_23` | Extrativismo, processamento, aquicultura, têxteis |
| `PORTARIAMAPAN52.2021 (2).pdf` | Atualização MAPA |
| `F.GEC_.052_Plano de Manejo Orgânico...pdf` | Formulário de referência do PMO |

> Os PDFs são a fonte autoritativa. Esta nota é um mapa, não um substituto.

## Fontes

- `docs/knowledge_base/` (corpus completo)
- `README.md` (raiz) — seção de compliance dinâmico
