# Diretrizes de Versionamento - ManejoORG (Fase Beta)

Este documento define as regras de versionamento semântico (SemVer) para o projeto ManejoORG durante sua fase de desenvolvimento inicial e piloto.

## A Regra de Ouro (Beta Stage)

O projeto está em fase **BETA**. Como definido pelo [Semantic Versioning 2.0.0](https://semver.org/), enquanto o produto não for considerado estável e pronto para lançamento geral (General Availability), o número da versão Maior (**Major**) deve permanecer obrigatoriamente em **0**.

-   **Formato:** `0.x.y` (ex: `0.9.0`, `0.9.1`)
-   **v1.0.0:** Esta versão está terminantemente bloqueada até o lançamento oficial do produto.

## Como Incrementar a Versão

### 1. Novas Funcionalidades / Sprints (Minor)
Ao final de cada Sprint ou entrega de novas funcionalidades, incrementamos a versão **Menor (Minor)**.
-   **Exemplo:** de `0.8.0` para `0.9.0`.
-   **Critério:** Adição de novas ferramentas, telas ou melhorias significativas na experiência do usuário.

### 2. Correção de Bugs / Hotfixes (Patch)
Para correções de erros, ajustes finos ou correções críticas de segurança que não alteram a funcionalidade principal da sprint.
-   **Exemplo:** de `0.9.0` para `0.9.1`.
-   **Critério:** Correções de lint, erros de tipagem, bugs visuais menores ou patches de dependências.

---

*Nota: Esta diretriz visa garantir a coesão técnica e comunicar claramente aos stakeholders e desenvolvedores o estado de maturidade do projeto.*
