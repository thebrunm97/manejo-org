-- migrations/007_processed_webhooks.sql
-- Tabela de deduplicação de webhooks processados.
-- Evita que o mesmo evento seja processado múltiplas vezes devido a retentativas de rede.

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    event_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilita RLS (Row Level Security)
-- Como o bot usa a chave service_role, ele pode ler e gravar sem restrições.
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.processed_webhooks IS 'Tabela de deduplicação para armazenar IDs de eventos processados pelo bot do WhatsApp';
