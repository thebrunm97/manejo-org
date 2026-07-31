## Question

Onde vivem os testes E2E e como são organizados?

- Ficam em `tests/` (já existe) ou numa nova pasta `e2e/`?
- Usam `go test` normal ou uma framework (ex: Playwright para o webhook HTTP, testify para Go)?
- Qual é o scope mínimo que dá confiança para um deploy: apenas os fluxos críticos (colheita + despesa + RAG) ou todos os handlers?
- Como o CI sabe quais testes são E2E vs unit (build tags? sufixo `_e2e_test.go`? pasta separada)?
