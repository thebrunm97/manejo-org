# Notas semânticas do Cartographer — fonte versionada

Relatórios de ingestão para `cartographer notes ingest`. Cada arquivo aqui é
o *claim* — a afirmação com evidência de linha — que vira uma nota
auditável em `.cartographer/notes.jsonl` (gerado, ignorado pelo git).

## Por que isso mora fora de `.cartographer/`

`.cartographer/` é artefato de build: cache SQLite e overlays derivados,
recriáveis a qualquer momento por `cartographer index`. O *claim* em si —
"este trecho de código tem esta propriedade" — não é recalculável a partir
do código; é conhecimento que alguém (agente ou humano) extraiu e precisa
sobreviver a uma reindexação ou a um clone novo. Por isso o relatório-fonte
é versionado aqui, e só o resultado ingerido vive no diretório ignorado.

## Arquivos

- `wiki-divergencias.json` — as quatro divergências entre documentação e
  código mapeadas ao inicializar a wiki (webhook sem HMAC de payload,
  schema drift em `caderno_campo_canteiros`, CHECK divergente em
  `transacoes_financeiras`, ausência de backend Python). Espelha o que está
  em `wiki/components/gateway-whatsapp.md`, `wiki/entities/canteiro.md`,
  `wiki/entities/transacao-financeira.md` e `wiki/components/legado-python.md`.
  Escrito à mão — curadoria, não extração.
- `wiki-citations.json` — **gerado** por `extract_citations.py`: toda
  citação `caminho/arquivo.ext:linha` presente nas 30 notas da wiki, exceto
  as já cobertas por `wiki-divergencias.json`. Não edite à mão — regenere.
- `extract_citations.py` — o extrator. Varre `wiki/**/*.md`, exige número
  de linha explícito na citação (menção de caminho sem linha não vira
  claim — evidência fraca demais para hash de trecho), resolve nomes de
  arquivo soltos (ex.: `` `handler.go:846` ``) pelo último caminho
  totalmente qualificado visto antes no mesmo documento, confirma que o
  arquivo alvo existe de fato no repositório, e pula qualquer
  `(path, startLine, endLine)` que já apareça em `wiki-divergencias.json`.
- `refresh_and_audit.py` — rotina de manutenção: reindexa o grafo, roda
  `notes audit` e lista só as notas `candidate`/`accepted` sinalizadas
  (pula as já `retired`), com o claim inteiro impresso para revisão rápida.
  Não reingere nem aposenta nada sozinho — decidir se uma nota sinalizada
  continua verdadeira é sempre um julgamento, nunca automático (o hash de
  evidência é do arquivo inteiro, não da linha citada, então uma edição
  em qualquer lugar do arquivo invalida a nota mesmo sem relação com o
  que ela afirma). Rodar depois de qualquer leva de mudanças de código,
  antes de considerar a wiki em dia:
  ```bash
  python wiki/.cartographer-notes/refresh_and_audit.py
  ```

## Regenerando `wiki-citations.json`

```bash
python wiki/.cartographer-notes/extract_citations.py
```

Roda de novo sempre que uma nota da wiki ganhar (ou perder) uma citação
`arquivo:linha`. O script imprime um resumo em stderr — citações
encontradas, resolvidas, ambíguas, arquivo inexistente, linha fora do
range, já cobertas pela curadoria — para auditar a extração antes de
ingerir.

## Como (re)aplicar

```bash
bun /caminho/para/cartographer/src/cli/index.ts notes ingest \
  --out .cartographer \
  --report wiki/.cartographer-notes/wiki-divergencias.json \
  --author "wiki-divergencias-pipeline"

bun /caminho/para/cartographer/src/cli/index.ts notes ingest \
  --out .cartographer \
  --report wiki/.cartographer-notes/wiki-citations.json \
  --author "wiki-citations-pipeline"

bun /caminho/para/cartographer/src/cli/index.ts notes audit --out .cartographer
```

A ingestão é idempotente: o id de cada nota é um hash do conteúdo do claim,
então rodar de novo sem mudanças não duplica.

## Como isso detecta obsolescência

Cada claim referencia linhas específicas do código
(`evidence[].startLine`/`endLine`). Na ingestão, o Cartographer calcula um
hash dessas linhas e grava junto da nota. Uma reindexação (`update`) seguida
de `notes audit` recalcula o hash atual e sinaliza divergência:

```
warn evidence-hash-mismatch: note:<id> (<path>) - Evidence hash changed for <path>
```

Ou seja: se o trecho citado por uma nota mudar, a nota vira candidata a
`stale` automaticamente — sem precisar reler a wiki inteira para saber o
que ainda é verdade.

## Ciclo de vida da nota

Toda nota ingerida nasce `status: candidate`, `confidence: agent-inferred`.
Fica assim até revisão humana:

```bash
bun .../cartographer/src/cli/index.ts notes review --out .cartographer \
  --note-id note:<id> --action accept --reviewer "<nome>"
```

`accept` falha se houver issue de auditoria pendente (ex.: hash divergente)
— a revisão manual é o portão antes de uma nota virar `accepted`.

## Adicionando novos claims

1. Escreva um novo `.json` neste diretório seguindo o formato de
   `wiki-divergencias.json` (`target` + `claims[]`, cada um com `summary`,
   `kind` e `evidence[]` com `path`/`startLine`/`endLine`).
2. Rode `notes ingest` apontando para o novo arquivo.
3. Rode `notes audit` para confirmar zero issues antes de considerar a nota
   pronta para revisão humana.
