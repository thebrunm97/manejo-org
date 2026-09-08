# Lote de rastreabilidade

Quantidade colhida de uma cultura em uma data, identificada por código e
publicável por QR Code. É a ponte entre a lavoura e o consumidor — ver
[[rastreabilidade]].

## `public.lotes_rastreabilidade`

`supabase/migrations/20260402000000_create_core_app_tables.sql:278`

| Coluna | Papel |
| --- | --- |
| `id` UUID PK | Identidade interna (usada na URL pública `/t/:id`) |
| `codigo_lote` | Código legível pelo produtor |
| `caderno_campo_id` | Colheita de origem ([[registro-de-caderno]]) |
| `propriedade_id`, `user_id` | Vínculo |
| `cultura`, `quantidade`, `data_colheita` | Conteúdo do lote |
| `qr_code_url` | Etiqueta |

RLS: `USING (user_id = auth.uid())` — **mais** o acesso anônimo de leitura
concedido em `20260503_public_traceability.sql`, que sustenta a página
pública. Esta é a única entidade com superfície não autenticada.

## Cuidado ao evoluir

Toda coluna nova aqui é candidata a vazar pela página pública. Avalie a
exposição antes de adicionar campo com dado pessoal ou comercial sensível.
