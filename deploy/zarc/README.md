# Base ZARC — Zoneamento Agrícola de Risco Climático

A tábua de risco do ZARC (MAPA) responde *"posso plantar cebola agora, aqui?"* com
dado oficial: para cada município × cultura × solo × ciclo × manejo, em quais períodos
do ano o plantio tem risco climático de 20%, 30% ou 40%, e sob qual Portaria. É a mesma
base que lastreia crédito rural e seguro agrícola — por isso **serve como evidência numa
auditoria de PMO**, e não só como palpite agronômico.

No bot, isso é a ferramenta `consultar_janela_plantio`.

## O que isto é (e o que não é)

**Não é um banco de dados.** É um **arquivo SQLite somente-leitura** de ~400 MB,
construído fora de produção e montado como volume `:ro` no contêiner do bot.

Foi uma decisão deliberada, e as alternativas foram descartadas por motivos concretos:

| Alternativa | Por que não |
|---|---|
| Supabase | A organização está no plano **free**, teto de 500 MB, e o banco de produção usa 46 MB. Só a safra corrente + perenes já estouraria o teto — e estourá-lo põe o projeto inteiro em modo restrito. |
| Postgres na VPS | Cabia nos 200 GB, mas traria senha, pool de conexões, tuning de `shared_buffers`, healthcheck, túnel SSH para ingestão e mais uma porta para vigiar. Infraestrutura dimensionada pelo tamanho do dado, não pelo uso real. |

O ZARC é público, somente-leitura, imutável entre safras, consultado por lookup pontual
e **100% reconstruível a partir da fonte**. Esse perfil justifica um arquivo, não um
serviço. "Migração de banco em produção" vira "deploy de asset estático".

## Conteúdo atual

Gerado em 2026-09-08 a partir dos dados abertos do MAPA (licença CC-BY):

| | |
|---|---|
| Tamanho | 398,6 MB |
| Janelas | 3.247.372 |
| Municípios | 5.573 (todos, com geocódigo IBGE) |
| Culturas | 91 |
| Safras | perenes/olerícolas (`safra_ini = 0`) + 2026/2027 |

O `MANIFEST.txt` que acompanha o arquivo tem o `sha256`, a data do build, as URLs exatas
dos recursos usados e a linha de comando para recriar tudo.

### O que o ZARC cobre — e o que não cobre

Isto importa mais do que parece para o nosso público. O ZARC tem **cebola, alho, batata,
mandioca, melancia, abacaxi, mamão, banana, café, citros, uva, maçã, pêssego, cacau e
açaí**, entre outras.

**Não tem tomate, alface, couve, cenoura nem brócolis** — justamente algumas das culturas
mais comuns na horticultura orgânica. A ferramenta responde a esses casos com
`status: "nao_zoneada"`, explicando que não existe janela oficial e oferecendo as
culturas que o ZARC cobre naquele município. O que ela **nunca** faz é inventar datas.

## Arquivos

| Arquivo | Papel |
|---|---|
| `schema.sql` | Definição autoritativa das tabelas. Lido pelo build e pelos testes de `internal/zarc` — não é uma cópia decorativa. |
| `indexes.sql` | Índices, aplicados **depois** da carga (criá-los antes faria cada INSERT reordenar a árvore B, em milhões de linhas). |
| `../../scripts/ingestion/zarc_build.py` | Baixa os CSVs, normaliza e monta o arquivo. Roda local. |
| `../../pmo-bot-go/internal/zarc/store.go` | Leitura no bot. |

## Como reconstruir

```bash
python scripts/ingestion/zarc_build.py
```

Sem argumentos: safra corrente + perenes, saída em `data/zarc.sqlite`. O script consulta
o catálogo CKAN do MAPA, então **a safra nova é reconhecida sozinha** quando o Ministério
publicar — que é justamente quando alguém vai rodar isto.

Os CSVs somam ~750 MB e ficam em `.cache/zarc/`. A segunda execução reaproveita o cache.
Leva cerca de 45 segundos com o cache quente.

Outras formas:

```bash
python scripts/ingestion/zarc_build.py --safras all
```

```bash
python scripts/ingestion/zarc_build.py --validate
```

`--safras all` traz as 11 safras (2016/17 → 2026/27, ~1,2 GB estimado). **Não é o que vai
para produção**: ninguém pergunta qual era a janela de plantio em 2018, e o histórico
multiplica o arquivo por ~4 sem agregar nada ao produtor. A opção existe para o dia em
que a pergunta aparecer.

`--validate` é o portão antes do `scp`: reabre o arquivo, confere contagens, verifica que
todo `riscos` tem 36 bytes, que São Paulo/SP resolve para 3550308, que não há janela órfã
de município, e confere uma linha de controle conhecida. Sai com código ≠ 0 se algo
falhar, e regrava o `MANIFEST.txt`.

## Primeira instalação

Diferente da troca de safra: aqui o **binário do bot muda** (pacote `internal/zarc`,
driver do SQLite, `ZARC_DB_PATH` no compose), então um `restart` não basta — o contêiner
precisa ser reconstruído.

```bash
ssh "$VPS_HOST" 'cd ~/manejo-org-app-clean && git pull && docker compose -f docker-compose.prod.yml up -d --build pmo-bot-go'
```

O `scp` do arquivo tem de vir **antes**: o volume é um bind mount de um arquivo, e o
Docker cria um diretório vazio no lugar se o caminho não existir no host — o bot subiria
com `unavailable` sem dizer por quê.

## Como atualizar em produção

Sai portaria nova de safra, tipicamente 1–2 vezes por ano. Aqui só o arquivo muda, então
`restart` basta:

```bash
python scripts/ingestion/zarc_build.py --validate
```

As variáveis são as mesmas de [`deploy/scripts/03-cutover-local.sh`](../scripts/03-cutover-local.sh):
`VPS_HOST=usuario@ip_da_vps` e `VPS_REPO_DIR` (padrão `~/manejo-org-app-clean`).

```bash
scp data/zarc.sqlite data/zarc.sqlite.MANIFEST.txt "$VPS_HOST:${VPS_REPO_DIR:-~/manejo-org-app-clean}/data/"
```

```bash
ssh "$VPS_HOST" 'cd ~/manejo-org-app-clean && docker compose -f docker-compose.prod.yml restart pmo-bot-go'
```

O volume no compose é relativo à raiz do repo (`./data/zarc.sqlite`), então o arquivo tem
de cair em `data/` **dentro do clone na VPS** — não em outro lugar do sistema.

O log de startup confirma o que subiu:

```
🌱 [ZARC] Base carregada: /data/zarc.sqlite (safra 2026, sha256=a9350e328a15…)
```

**Rollback** é restaurar o arquivo anterior e reiniciar. Não há migração para desfazer.

Se `ZARC_DB_PATH` não estiver definida, ou o arquivo não existir, **o bot sobe normalmente**
e a ferramenta responde `unavailable`. É o comportamento esperado em staging e na máquina
do desenvolvedor, onde ninguém quer os 400 MB.

## Backup

O artefato vai para uma pasta no Google Drive, um arquivo por safra, junto do
`MANIFEST.txt`. Cópia manual ou `rclone` — o conector de Drive não serve para centenas
de MB.

Isso é **conveniência, não rede de segurança**: a fonte é pública e o script reconstrói
tudo. O Drive só evita rebaixar 750 MB e reprocessar. A receita de recuperação de
desastre é rodar o build de novo.

## Detalhes da fonte que já custaram tempo

Anotados porque não estão documentados em lugar nenhum do portal:

- O portal devolve **403 sem `User-Agent` de navegador**, e também para requisições `HEAD`.
- O portal **ignora o header `Range`**: não existe download parcial. É o arquivo inteiro
  ou nada — daí o cache em disco ser requisito, não otimização.
- Os CSVs são `;` e **UTF-8 com BOM** (`utf-8-sig`).
- `SafraFin` nem sempre é numérico: nas perenes vem a string `SEM SAFRA`.
- A coluna `Portaria` tem formato inconsistente **entre arquivos**:
  `Port.272_de_22-07-2026` e `Port. 438_de_28-12-2023`. O build colapsa os dois.
- As janelas **atravessam a virada do ano**. O sorgo 2ª safra em João Neiva/ES vai do
  decêndio 27 (fim de setembro) ao 6 (fim de fevereiro), com o meio do ano zerado. Um
  decodificador que trate os 36 bytes como uma linha do tempo com começo e fim quebra
  aqui — `decodificarRiscos` fecha o ciclo de propósito.
- O **dicionário de dados é um PDF digitalizado** (imagem, sem camada de texto). Por isso
  `solos.descricao` e `ciclos.descricao` estão nulos: dependem de OCR, que é tarefa
  posterior e não bloqueia nada.
- O dataset **Cultivares (SISZARC)** está marcado "EM MANUTENÇÃO" na origem e ficou de
  fora. A tábua de risco não depende dele.

## Decisões de modelagem

**`riscos` é um BLOB de 36 bytes**, um por decêndio, valor 0/20/30/40 — não 36 colunas.
O Go decodifica direto de `[]byte`.

**`safra_ini = 0` marca as perenes/olerícolas.** Isso não é detalhe: quase todas as
culturas relevantes para o nosso público estão ali, e só os grãos ficam nas safras
datadas. Toda consulta cobre `safra_ini IN (0, vigente)` — filtrar por uma safra só faria
a cebola voltar como "não zoneada" mesmo estando na base.

**A cultura casa por prefixo.** Os nomes do MAPA são longos e qualificados ("Sorgo
Granífero 2ª Safra", "Café Arábica Produção", "Batata Mesa") e o produtor no WhatsApp diz
"sorgo", "café", "batata". Igualdade exata devolveria "não zoneada" para quase toda
pergunta real. O prefixo também é o que faz uma pergunta sobre batata trazer mesa **e**
indústria, que é a resposta certa.

**`nome_norm` é gravado sem acento e em minúsculas**, pelo Python do build. O Go replica a
mesma normalização (NFD + descarte de diacríticos) em `zarc.Normalizar`. As duas têm de
produzir a mesma string, byte a byte — é por ela que "sao paulo" encontra "São Paulo". Há
um teste em `internal/zarc` fixando os valores esperados.
