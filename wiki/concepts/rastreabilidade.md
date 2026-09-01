# Rastreabilidade

Capacidade de reconstruir o caminho de um alimento do ponto de venda até o
canteiro e a data em que foi colhido — e, no sentido inverso, de descobrir
todos os lotes afetados quando um problema aparece.

## O fluxo no Manejo.ORG

1. Uma colheita é registrada na [[caderneta-de-campo]].
2. Ela gera um [[lote-de-rastreabilidade]] com `codigo_lote` e `qr_code_url`.
3. O QR Code aponta para uma página **pública**, sem login:
   `/t/:id` (`PublicTraceabilityPage.tsx`) — e a rota legada `/trace/:codigoLote`.
4. O consumidor vê origem, cultura, data de colheita e o vínculo com a
   propriedade certificada.

## O ponto sensível

A página pública é a única superfície que atravessa o isolamento por RLS
descrito em [[supabase-postgres]]. O acesso anônimo é concedido por uma
migration dedicada (`supabase/migrations/20260503_public_traceability.sql`),
que expõe deliberadamente um subconjunto mínimo de campos. Qualquer campo
novo adicionado ao lote precisa ser avaliado contra essa exposição.

## Onde isso aparece no código

- `pmo-frontend/src/services/traceabilityService.ts`
- `pmo-frontend/src/pages/PublicTraceabilityPage.tsx`
- `react-qr-code` para geração do código no cliente.

## Fontes

- `docs/raw/RESEARCH_RASTREABILIDADE.md`
