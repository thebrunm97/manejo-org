# Testes de carga do DT-38

Dois binários que medem o teto de capacidade da stack antes da migração para a
VPS. Foram escritos para responder a uma pergunta específica: **quantos
produtores simultâneos o Piper aguenta com 1 vCPU?**

## ⚠️ Leia antes de rodar `cmd/loadtest` — incidente real em 2026-08-23 (DT-52)

`cmd/loadtest` entra pelo webhook real e fabrica envelopes de mensagem do
WhatsApp com ID inexistente. Rodá-lo contra a URL de produção (que, antes da
VPS, é a única URL que funciona nesta máquina — ver DT-38) fez o
`evolution-go` tentar baixar mídia para uma mensagem que a sessão real do
WhatsApp nunca recebeu de verdade. O protocolo Signal da sessão dessincronizou,
a Meta derrubou a conexão (`StreamReplaced`), e o bot ficou **24 minutos fora
do ar**, sem nenhum aviso, até um restart manual do container.

Por isso `-url` não tem valor padrão, e o script pede confirmação digitada
(`CONFIRMO`) antes de disparar contra qualquer alvo que não pareça
inequivocamente seguro (staging, CI). Não desative isso com `-yes` a menos que
o alvo seja garantidamente uma instância de WhatsApp descartável.

**Se o objetivo é só medir CPU do Piper — que é o objetivo original do
DT-38 — use `cmd/loadtest_piper`.** Ele fala direto com o Piper, nunca passa
pelo WhatsApp, e não tem este risco. É a escolha padrão certa; só use
`cmd/loadtest` quando precisar validar o pipeline ponta a ponta de verdade.

| Binário | O que mede | Risco de sessão do WhatsApp |
|---|---|---|
| `cmd/loadtest_piper` | Só o Piper, direto na porta 5000, isolando o passo de CPU | Nenhum — não toca o WhatsApp |
| `cmd/loadtest` | Pipeline inteiro, entrando pelo webhook (áudio → transcrição → LLM → TTS → envio) | **Sim, se o alvo for uma sessão real** |

Os dois existem porque medir só a ponta não distingue "o LLM está lento" de
"o TTS está saturado". O `loadtest_piper` é o grupo de controle — e o ponto de
partida seguro.

## Rodando

```bash
cd pmo-bot-go/cmd/loadtest_piper
go run . -workers 5 -url http://piper:5000/v1/audio/speech
```

```bash
cd pmo-bot-go/cmd/loadtest
go run . -url http://localhost:8080/webhook/evolution -workers 5 -timeout 150
# o script vai pedir para digitar CONFIRMO antes de disparar
```

Use `-h` para as demais flags (token, porta do file server, texto).

## Pré-requisito: o áudio de teste

`cmd/loadtest` sobe um file server local e serve um `.ogg` para o bot baixar,
simulando um áudio do WhatsApp. Esse arquivo **não é versionado**: um áudio de
voz real é biometria vocal, dado sensível pela LGPD (art. 5º, II) — a mesma
razão do DT-42. Forneça o seu:

```bash
mkdir -p test_assets   # relativo ao diretorio de onde voce roda
# coloque um audio_teste.ogg (opus, ~5s) em test_assets/
```

Ou aponte para outro diretório com `-assets`. Grave um áudio qualquer no
WhatsApp e exporte — não precisa ser fala real, qualquer opus válido serve, já
que o objetivo é medir CPU e não qualidade de transcrição.

`payload_audio_stress.json` é o template do webhook e **já vai anonimizado**
(`5511999999999`). Se trocar por um número real para testar ponta a ponta, não
commite a alteração: o repositório é público.

## Cuidado ao interpretar o resultado

O script valida que houve **trabalho**, não apenas que houve **resposta**. Um
webhook que devolve `200` na hora e processa em background daria um resultado
excelente e falso. Se alterar o script, preserve essa verificação.

Os números já medidos (2026-08-22) estão no **DT-38** em
[`docs/debitos_tecnicos.md`](../../docs/debitos_tecnicos.md) — inclusive a
descoberta de que **concorrência não aumenta vazão** com 1 vCPU. Leia antes de
re-medir; provavelmente a pergunta já tem resposta.
