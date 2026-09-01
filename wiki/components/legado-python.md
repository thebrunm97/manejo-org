# Legado Python

O bot original era em Python. A migração para Go está registrada em
`docs/architecture/adr/001-go-over-python.md`.

## O que sobrou

`legacy_python/pmo_bot/` **não contém código**. São apenas artefatos de
execução da versão antiga:

```
all_logs.txt  bot_logs.txt  logs_bot.txt  logs_wpp.txt
verify_logs.txt  worker_logs.txt  wpp_debug_logs.txt  wpp_fail_log.txt
wpp_logs.txt  test_output.txt  qrcode.html  latest_qrcode.html  .env
```

> **Não existe backend Python ativo neste repositório.** O backend é o
> [[pmo-bot-go]]. Se você procurava lógica de negócio em Python, ela foi
> reescrita em Go ou empurrada para RPCs no [[supabase-postgres]].

O `.env` desse diretório **não está versionado** (verificado com
`git ls-files`) — e não deve passar a estar.

## Valor residual

Os logs registram o comportamento do WhatsApp na implementação anterior
(pareamento por QR, falhas de sessão) e podem servir de referência histórica
ao depurar o [[gateway-whatsapp]]. Fora isso, o diretório é candidato a
arquivamento em `_archive/`.
