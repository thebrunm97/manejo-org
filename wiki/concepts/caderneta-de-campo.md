# Caderneta de campo

Registro cronológico de tudo que aconteceu na lavoura: plantio, manejo,
colheita, limpeza de equipamentos, entrada de insumos, descartes. É a
evidência que a auditoria confronta com o [[plano-de-manejo-organico]].

Historicamente é um caderno de papel preenchido no fim do dia — quando
preenchido. O Manejo.ORG ataca exatamente esse ponto de falha por dois
caminhos:

1. **Voz pelo WhatsApp** — o produtor fala o que fez; o áudio é transcrito e
   classificado pelo [[roteador-de-agentes-ia]] e vira registro estruturado.
2. **Formulário offline no PWA** — funciona sem sinal e sincroniza depois,
   ver [[offline-first]].

## O que caracteriza um bom registro

- **Quando** — `data_registro`.
- **Onde** — [[talhao]] e/ou [[canteiro]] (relação N:N via `caderno_campo_canteiros`).
- **O quê** — `tipo_atividade` (Plantio, Manejo, Colheita, Limpeza, Outro) e `produto`.
- **Quanto** — `quantidade_valor` + `quantidade_unidade`.
- **Sob qual regime** — `modalidade_aplicada`, ver [[producao-paralela]].
- **Com que prova** — `audio_url`, `observacao_original`, `raw_payload_id`.

A modelagem completa está em [[registro-de-caderno]]. Uma colheita registrada
aqui é o que origina um [[lote-de-rastreabilidade]].

## Onde isso aparece no código

- Rota `/caderno` → componente `DiarioDeCampo` (`pmo-frontend/src/App.tsx`).
- `pmo-frontend/src/services/cadernoService.ts` — leitura unificada de
  `caderno_campo` + `pmo_limpeza`, com validação Zod por tipo de atividade.
- `pmo-frontend/src/hooks/useFieldDiary.ts` e `hooks/offline/useCadernoOfflineLogic.ts`.
- RPC `rpc_registrar_operacao_campo` (chamada pelo [[pmo-bot-go]]) e
  `create_caderno_registro` / `create_limpeza_registro` (chamadas pelo PWA).
