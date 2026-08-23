# Testes de carga do DT-38

Dois binários que medem o teto de capacidade da stack antes da migração para a
VPS. Foram escritos para responder a uma pergunta específica: **quantos
produtores simultâneos o Piper aguenta com 1 vCPU?**

| Binário | O que mede |
|---|---|
| `cmd/loadtest` | Pipeline inteiro, entrando pelo webhook (áudio → transcrição → LLM → TTS → envio) |
| `cmd/loadtest_piper` | Só o Piper, direto na porta 5000, isolando o passo de CPU |

Os dois existem porque medir só a ponta não distingue "o LLM está lento" de
"o TTS está saturado". O `loadtest_piper` é o grupo de controle.

## Rodando

```bash
cd pmo-bot-go/cmd/loadtest
go run . -workers 5 -timeout 150
```

```bash
cd pmo-bot-go/cmd/loadtest_piper
go run . -workers 5 -url http://piper:5000/v1/audio/speech
```

Use `-h` para as demais flags (URL, token, porta do file server, texto).

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
