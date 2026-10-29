# Conjunto de roteamento

`mensagens.jsonl`: mensagens de produtores com a resposta certa marcada. Serve
para comparar roteadores (o LLM atual, o JEV, um modelo menor), prompts e
filtros de ferramentas com um número em vez de impressão.

## Origem

- `real`: mensagens que chegaram ao bot (`messages` e `logs_processamento`,
  março a outubro de 2026), sem repetição. Saíram nomes de pessoas, e-mails,
  códigos de conexão e testes ("test", "ping"). Acentos estragados nos logs
  foram corrigidos. Áudios longos foram encurtados.
- `sintetica`: escritas à mão para o que ainda não tem mensagem real
  (Moçambique, aves, mensagens mistas). Trocar por reais quando houver.

## Campos

| campo | o que é |
|---|---|
| `intencao` | o que o roteador deve devolver: `DATABASE`, `AGRONOMY`, `CHAT`, `CLARIFICATION` |
| `escrita` | `needs_write` do roteador: o produtor relatou algo para guardar |
| `tema` | assunto (compra, colheita, aves, clima, janela_plantio, norma...): base para filtrar ferramentas por tema |
| `ferramentas` | ferramentas aceitas, a preferida primeiro; vazio = nenhuma |
| `precisa_contexto` | só faz sentido com a conversa anterior ("SIM", "3 toneladas"); fica fora da nota do roteador isolado |
| `nota` | por que o rótulo não é óbvio |

## Regras de rótulo

- Clima, janela de plantio, normas e dúvida técnica são `AGRONOMY` (as
  ferramentas deles são da categoria RAG).
- "Quero plantar X" sem dizer que plantou é pergunta (`AGRONOMY`), não registro.
- Compra de pintos é `registrar_avicultura` (entrada com valor); venda de ovos
  é `registrar_venda`.
- Mensagem mista (registo + pergunta) leva a intenção do registo e as duas
  ferramentas.

`go test ./internal/mcp -run TestConjuntoRoteamentoValido` confere o formato e
se as ferramentas citadas existem.
