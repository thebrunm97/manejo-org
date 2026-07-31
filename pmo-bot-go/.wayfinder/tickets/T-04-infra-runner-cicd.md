## Question

Uma vez que a estratégia de testes esteja decidida, esta pergunta torna-se respondível:

- Qual é o host de produção actual? (VPS, Fly.io, Railway, Render, outro?)
- O deploy actual é feito como? (docker pull + restart manual? docker-compose up -d? outro?)
- Que secrets precisam estar no GitHub Actions? (`DATABASE_URL`, `GEMINI_API_KEY`, `SSH_KEY` para o host?)
- Qual é a estratégia de rollback se o deploy falhar?
