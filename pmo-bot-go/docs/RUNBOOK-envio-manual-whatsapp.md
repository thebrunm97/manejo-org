# Runbook: envio manual de WhatsApp (suporte)

Quando um problema é resolvido direto no banco (ex.: vínculo de telefone
feito manualmente porque o e-mail de OTP não chegou) e é preciso avisar o
produtor fora do fluxo normal do bot, use o script:

```bash
set -a; source .env; set +a
./scripts/send_manual_message.sh <telefone_sem_mais> "<mensagem>"
```

- `<telefone>`: DDI + DDD + número, só dígitos (ex.: `554891314552`).
- As credenciais (`EVOLUTION_BASE_URL`, `EVOLUTION_INSTANCE_NAME`,
  `EVOLUTION_API_KEY`) vêm do `.env` — mesmas usadas pelo bot em produção
  (ver `.env.example`).
- O script chama `POST {EVOLUTION_BASE_URL}/send/text`, o mesmo endpoint que
  `internal/adapter/evolution/adapter.go` (`EvolutionAdapter.SendMessage`)
  usa em produção — não é um caminho paralelo, é o mesmo Evolution API.

## Por que não existia algo assim antes

O único disparador de mensagem avulsa no repo era
`cmd/tester/evolution_lab/shooter/main.go`, uma ferramenta de laboratório
para testes de integração (áudio, mídia etc.), não pensada para suporte
pontual em produção. `send_manual_message.sh` cobre só o caso de texto
simples, sem precisar compilar/rodar um binário Go.

## Caso de uso original (2026-08-24)

Vínculo manual de telefone a conta existente porque o OTP por e-mail não
chegava (ver [state/onboarding.go](../internal/state/onboarding.go) para o
fluxo normal). Após o `UPDATE auth.users` manual, a produtora precisava ser
avisada que já podia usar o bot — daí este script.
