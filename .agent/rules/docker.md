---
globs: ["**/docker-compose.yml", "**/Dockerfile", "**/.dockerignore"]
---

# Regras para Docker e Infraestrutura

## Referências Obrigatórias
Antes de modificar a infraestrutura, consultar:
- **Configuração Docker:** [docker.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/deployment/docker.md)
- **Variáveis de ambiente:** [env_vars.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/deployment/env_vars.md)

## Regras
- **Rede interna:** todos os serviços devem estar na rede `pmo-net`.
- **Backend Go:** usar build multi-stage para imagem mínima (~20MB).
- **WPPConnect:** manter volumes persistentes para sessões WhatsApp (`./wpp-data` e `./tokens`).
- **Healthchecks:** todo serviço deve ter healthcheck configurado.
- **Variáveis sensíveis:** usar `.env` file, NUNCA hardcoded no compose.
- **Portas:** documentar toda porta exposta em [docker.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/deployment/docker.md).
- **Novo serviço:** documentar em [docker.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/deployment/docker.md) e [env_vars.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/deployment/env_vars.md).

## NÃO fazer
- **NÃO expor portas desnecessárias** ao host.
- **NÃO usar latest** como tag de imagem em produção.
- **NÃO commitar arquivos .env** com credenciais reais.
