# Varredura de segredos (gitleaks)

Gate automático que impede credenciais de entrarem no repositório. Roda em
dois pontos: **antes de cada commit** (local) e **em cada PR/push** (CI).

## Por que isto existe

Três credenciais já vazaram para este repositório público:

| Débito | Credencial | Observação |
|--------|-----------|------------|
| DT-01 | Supabase `service_role` key | Rotação pendente com o dono do repositório |
| DT-01 | `SUPABASE_ACCESS_TOKEN` | Exposta em texto plano no terminal e revogada |
| DT-45 | Evolution API key | `pmo-bot-go/cmd/test_audio/main.go:20`, pública de 2026-07-30 a 2026-08-23 |

O DT-45 é o caso instrutivo. O literal era assim:

```go
apiKey := "SsU8y6SMSvsMkZdv" + 44 caracteres  // valor real truncado de proposito
```

> O literal acima está truncado porque **o próprio gate bloqueou o commit
> deste documento** enquanto ele continha a chave inteira. É o comportamento
> correto: colar um segredo já vazado dentro de um arquivo novo é publicá-lo
> de novo.

64 caracteres alfanuméricos, sem prefixo. Não é `eyJ`, não é `sk-`, não é
`ghp_`. **Qualquer scanner baseado só em prefixos conhecidos teria deixado
passar.** O que pega esse caso é a heurística "identificador suspeito +
operador de atribuição + string de alta entropia" — a regra `generic-api-key`
do ruleset padrão do gitleaks, medida com entropia 5.00 neste literal.

## Instalação

```bash
npm run hooks:install
```

Ou, sem npm:

```bash
bash scripts/install-git-hooks.sh
```

O script aponta `core.hooksPath` para `.githooks/`, instala o gitleaks via Go
se ele não estiver presente, e roda um teste de fumaça que **falha se o gate
não bloquear um segredo falso** — ou seja, ele prova que funciona em vez de
só afirmar.

> **Windows:** rode em **Git Bash**, não em PowerShell. O PowerShell 5.1 grava
> arquivos em UTF-16 e já corrompeu configs deste repositório (corrigido em
> `fd86039`). O Git Bash vem junto com o Git for Windows, então não há
> dependência nova.

Para desinstalar: `git config --unset core.hooksPath`.

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `.gitleaks.toml` | Regras e allowlists. Estende o ruleset padrão (`useDefault = true`). |
| `.gitleaksignore` | Supressões por fingerprint, para achados únicos. |
| `.githooks/pre-commit` | Hook local. Escaneia só o que está *staged*. |
| `scripts/install-git-hooks.sh` | Instalador + teste de fumaça. |
| `.github/workflows/secret-scan.yml` | Job de CI. Escaneia só o diff do PR/push. |

## O que as regras customizadas cobrem

O ruleset padrão do gitleaks tem palavras-chave **só em inglês**. Este projeto
nomeia variáveis em português, então há um buraco real. Medido com gitleaks
v8.30.1:

| Código | Ruleset padrão | Com `.gitleaks.toml` |
|--------|----------------|----------------------|
| `apiKey := "SsU8y6..."` | detecta | detecta |
| `chaveSecreta := "Qw8Er..."` | detecta | detecta |
| `senha := "hZ3kQ..."` | **passa batido** | detecta (`ptbr-generic-credential`) |
| `senhaBanco = "hZ3kQ..."` | **passa batido** | detecta (`ptbr-generic-credential`) |

Regras adicionadas: `ptbr-generic-credential`, `ptbr-chave-credential`,
`supabase-access-token` (`sbp_...`), `supabase-secret-key` (`sb_secret_...`),
`evolution-api-key`, `dotenv-high-entropy-value`.

## Escopo do scan (leia antes de estranhar)

Nem o hook nem o CI escaneiam a árvore ou a história inteira:

- **Hook local:** só o que está *staged* (`gitleaks git --staged`).
- **CI:** só os commits do PR/push (`--log-opts base...head`).

Isso é deliberado. Os vazamentos do DT-01 e DT-45 continuam na história e só
somem com reescrita de histórico. Um job que escaneia tudo ficaria vermelho
para sempre — e job cronicamente vermelho é job que a equipe aprende a
ignorar. Como as workflows existentes já estão falhando (DT-30), **o hook
local é a metade que realmente protege hoje.**

Para auditar a árvore ou a história sob demanda:

```bash
npm run scan:secrets
```

```bash
npm run scan:secrets:history
```

## Falsos positivos

A varredura completa da árvore em 2026-08-24 achou 18 ocorrências: **1 segredo
real (DT-45) e 17 falsos positivos.** Todos os 17 foram inspecionados e
liberados em `.gitleaks.toml`:

- 11× chaves de seção do formulário PMO (`key: 'secao_13_producao_animal'`) —
  constantes de domínio que o `generic-api-key` confunde com credencial.
- 4× `coliseu-api-key-2026`, literal do laboratório de benchmark local.
- 2× JWT de demonstração do Supabase local (issuer `supabase-demo`), publicado
  na documentação oficial e idêntico em toda máquina do mundo.

Resultado nessa árvore: **1 achado, 0 ruído.**

### Segunda calibragem — `feature/onboarding-mockup`

A branch onde o trabalho ativo acontece é bem maior. Rodando o mesmo config
contra ela: **126 achados brutos.** Separando por o que o git realmente
versiona — que é o único recorte que importa, já que o hook só enxerga
conteúdo *staged*:

| | Antes do ajuste | Depois |
|---|---|---|
| Em arquivos **versionados** | 42 | **0** |
| Em arquivos ignorados/locais | 84 | 65 |
| Tempo de varredura | 18,4 s | 0,97 s |

Os 42 versionados eram todos falsos positivos, concentrados em código de
terceiros: documentação vendorizada do `evolution-go` (exemplos de `curl` com
`apikey: token-vendas`, a `GLOBAL_API_KEY` de demonstração que está na doc
pública da Evolution), a constante do WhatsApp Web embutida no `whatsmeow`, a
fonte vendorizada do Azure MCP, e worktrees aninhados do Claude Code — que são
cópias do próprio repositório, multiplicando cada achado por worktree ativo.

### O que continua detectável de propósito

Os 65 achados restantes são credenciais **reais e vivas** (tokens `sbp_`,
chaves `sb_secret_`, GROQ, OpenRouter, Google) em `legacy_python/`, nos
scripts `.js` soltos na raiz, em `.vscode/mcp.json`, `.agent/mcp_config.json`
e nos vários `.env`. Verificado com `git check-ignore` em 2026-08-24: **todos
estão cobertos pelo `.gitignore`**, e por isso nunca chegaram ao repositório.

Eles **não** foram colocados na allowlist. Liberá-los trocaria proteção por
silêncio: no dia em que alguém mexer no `.gitignore` ou usar `git add -f`, o
gate precisa gritar. O ruído deles aparece apenas no `npm run scan:secrets`
(varredura da árvore inteira), nunca no hook de commit.

Isso importa mais do que parece — um gate que grita lobo é desligado pela
equipe em uma semana.

### Como suprimir algo novo

Escolha pelo tipo do caso, não pelo que for mais rápido:

| Situação | Onde | Por quê |
|----------|------|---------|
| Classe de valor que vai se repetir | `.gitleaks.toml` → `[[allowlists]]` | Resolve para sempre, inclusive casos futuros |
| Achado único e irrepetível | `.gitleaksignore` (fingerprint) | Não generaliza; morre se a linha se mover |
| Uma linha isolada | comentário `gitleaks:allow` na linha | Fica junto do código que o justifica |

**Regra da casa:** toda supressão vem com uma justificativa escrita ao lado.
Um fingerprint sem explicação é indistinguível de um segredo real que alguém
silenciou com pressa, e ninguém depois terá coragem de removê-lo.

## Quando o gate disparar de verdade

1. **Trate a credencial como já comprometida e rotacione.** Apagar a linha não
   basta: o valor fica no reflog, em forks, em clones e em caches de terceiros.
2. Tire o valor do código — leia de variável de ambiente ou `.env`.
3. Só então recommite.

Em emergência consciente o gate pode ser pulado com
`SKIP_SECRET_SCAN=1 git commit ...` (ou `--no-verify`). O hook avisa em amarelo
que você assumiu a responsabilidade. Use isso como exceção rara, não como
atalho de rotina.
