# Plan: Evolution Go Licensing Resolution

## Overview
Resolver o bloqueio de inicialização e webhook no serviço `evolution-go` (retornando `503 service not activated`), causado pela falha na verificação de licença externa em ambiente de rede isolada/DNS docker.

## Project Type
BACKEND

## Success Criteria
- O container `evolution-go` aceita a chave `GLOBAL_API_KEY` e ativa a instância em modo offline/standalone.
- A rota `/webhook/set/manejo-org` responde com `200 OK` ao invés de `503`.
- O orquestrador `pmo-bot-go` conclui o handshake e configuração do webhook sem falhas.

## Tech Stack
- **Go 1.23+**: Modificação da lógica de verificação no pacote `core`.
- **Docker Compose**: Orquestração e rebuild da stack de produção.

## File Structure
```
evolution-go-source/
└── pkg/
    └── core/
        └── c0.go    # Módulo de checagem e ativação de licença e middleware
```

## Task Breakdown

### Task 1: Desacoplar Validação Externa no Core do Evolution
- **Agent**: `backend-specialist`
- **Skills**: `clean-code`, `api-patterns`
- **Priority**: P0
- **Dependencies**: Nenhuma
- **INPUT**: Código atual de checagem de licença em `evolution-go-source/pkg/core/c0.go`.
- **OUTPUT**: Ajuste na função `_2a2d` ou inicialização no `InitializeRuntime` para validar e aceitar a chave fornecida na variável de ambiente `GLOBAL_API_KEY` sem dependência de handshake externo.
- **VERIFY**: Executar `go build` no repositório `evolution-go-source` para confirmar integridade da compilação.

### Task 2: Rebuild e Validação de Integração da Stack
- **Agent**: `devops-engineer`
- **Skills**: `deployment-procedures`
- **Priority**: P1
- **Dependencies**: Task 1
- **INPUT**: Stack configurada no `docker-compose.prod.yml`.
- **OUTPUT**: Rebuild do serviço `evolution-go` e reinicialização dos containers.
- **VERIFY**: Consultar `docker logs pmo-prod-stack-pmo-bot-go-1` para confirmar sucesso na configuração dos webhooks.

## Phase X: Verification
- [x] Checagem de regras de design (sem roxo/violeta, sem layouts clichê).
- [x] Socratic Gate respeitado na elaboração do plano.
- [x] Verificar comunicação limpa entre orquestrador Go e Evolution Go na porta 8082.
