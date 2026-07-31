-- Migration: Operational & Financial Tables (previously dashboard-only)
-- Created at: 2026-04-03 (runs just before 20260403 to ensure financial tables exist)
-- NOTE: Date suffix _b ensures ordering after core tables (20260402) and before motor agronomico (20260403)

-- ── categorias_financeiras ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT NOT NULL,
    tipo       TEXT NOT NULL,
    descricao  TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    pmo_id     BIGINT REFERENCES public.pmos(id)
);

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam suas categorias"
ON public.categorias_financeiras FOR ALL TO authenticated
USING (
    pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid())
    OR pmo_id IS NULL
);

-- ── transacoes_financeiras ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transacoes_financeiras (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    propriedade_id    BIGINT NOT NULL REFERENCES public.propriedades(id),
    pmo_id            BIGINT REFERENCES public.pmos(id),
    categoria_id      UUID REFERENCES public.categorias_financeiras(id),
    tipo              TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    valor_total       NUMERIC NOT NULL DEFAULT 0,
    data_competencia  DATE NOT NULL DEFAULT CURRENT_DATE,
    fornecedor_cliente TEXT,
    nota_fiscal       TEXT,
    status_pagamento  TEXT DEFAULT 'PAGO',
    observacao        TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    user_id           UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    data_transacao    DATE DEFAULT CURRENT_DATE,
    fornecedor        TEXT,
    raw_payload_id    UUID
);

ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam suas transações"
ON public.transacoes_financeiras FOR ALL TO authenticated
USING (user_id = auth.uid());

-- ── transacao_alocacoes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transacao_alocacoes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transacao_id       UUID NOT NULL REFERENCES public.transacoes_financeiras(id) ON DELETE CASCADE,
    talhao_id          BIGINT REFERENCES public.talhoes(id),
    caderno_campo_id   UUID REFERENCES public.caderno_campo(id),
    valor_alocado      NUMERIC NOT NULL DEFAULT 0,
    percentual_alocado NUMERIC,
    created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transacao_alocacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso via transação do usuário"
ON public.transacao_alocacoes FOR ALL TO authenticated
USING (
    transacao_id IN (SELECT id FROM public.transacoes_financeiras WHERE user_id = auth.uid())
);

-- ── logs_treinamento ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logs_treinamento (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criado_em        TIMESTAMPTZ DEFAULT now(),
    texto_usuario    TEXT,
    json_extraido    JSONB,
    tipo_atividade   TEXT,
    user_id          UUID REFERENCES auth.users(id),
    processado       BOOLEAN DEFAULT false,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    modelo_ia        TEXT DEFAULT 'llama-3-70b',
    validado         BOOLEAN DEFAULT false,
    pmo_id           BIGINT REFERENCES public.pmos(id),
    json_corrigido   JSONB,
    foi_editado      BOOLEAN DEFAULT false,
    status_validacao TEXT DEFAULT 'pendente'
);

ALTER TABLE public.logs_treinamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins acessam logs de treinamento"
ON public.logs_treinamento FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── logs_consumo ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logs_consumo (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID REFERENCES auth.users(id),
    request_id        TEXT,
    tokens_prompt     INTEGER DEFAULT 0,
    tokens_completion INTEGER DEFAULT 0,
    total_tokens      INTEGER DEFAULT 0,
    modelo_ia         TEXT,
    acao              TEXT,
    custo_estimado    NUMERIC,
    duracao_ms        INTEGER,
    status            TEXT DEFAULT 'success',
    meta              JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.logs_consumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins acessam logs de consumo"
ON public.logs_consumo FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── logs_processamento ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logs_processamento (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at        TIMESTAMPTZ DEFAULT now(),
    pmo_id            BIGINT REFERENCES public.pmos(id),
    mensagem_usuario  TEXT,
    resposta_bot      TEXT,
    modelo_ia         TEXT,
    tokens_prompt     INTEGER DEFAULT 0,
    tokens_completion INTEGER DEFAULT 0,
    intencao          TEXT
);

ALTER TABLE public.logs_processamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins acessam logs de processamento"
ON public.logs_processamento FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── bot_status ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_name    TEXT NOT NULL DEFAULT 'agro_vivo',
    status          TEXT NOT NULL DEFAULT 'UNKNOWN',
    phone_connected TEXT,
    last_heartbeat  TIMESTAMPTZ DEFAULT now(),
    details         JSONB DEFAULT '{}'
);

ALTER TABLE public.bot_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem status do bot"
ON public.bot_status FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT,
    timestamp  TEXT,
    status     TEXT,
    source     TEXT,
    phone      TEXT,
    content    TEXT,
    role       TEXT DEFAULT 'user'
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins acessam mensagens"
ON public.messages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── message_queue ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_queue (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    msg_id        TEXT NOT NULL,
    from_phone    TEXT NOT NULL,
    raw_payload   JSONB NOT NULL,
    body_text     TEXT,
    respond_audio BOOLEAN NOT NULL DEFAULT false,
    status        TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts  INTEGER NOT NULL DEFAULT 3,
    error_msg     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at    TIMESTAMPTZ,
    processed_at  TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fila de mensagens"
ON public.message_queue FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── instances (WppConnect) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instances (
    id               UUID PRIMARY KEY,
    name             TEXT,
    token            TEXT,
    webhook          TEXT,
    rabbitmq_enable  TEXT,
    web_socket_enable TEXT,
    nats_enable      TEXT,
    jid              TEXT,
    qrcode           TEXT,
    connected        BOOLEAN,
    expiration       BIGINT,
    disconnect_reason TEXT,
    events           TEXT,
    os_name          TEXT,
    proxy            TEXT,
    client_name      TEXT,
    created_at       TIMESTAMPTZ,
    always_online    BOOLEAN DEFAULT false,
    reject_call      BOOLEAN DEFAULT false,
    msg_reject_call  TEXT DEFAULT '',
    read_messages    BOOLEAN DEFAULT false,
    ignore_groups    BOOLEAN DEFAULT false,
    ignore_status    BOOLEAN DEFAULT false
);

ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam instâncias"
ON public.instances FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── runtime_configs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.runtime_configs (
    id         BIGSERIAL PRIMARY KEY,
    key        VARCHAR NOT NULL UNIQUE,
    value      TEXT NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

ALTER TABLE public.runtime_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam runtime configs"
ON public.runtime_configs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── poll_votes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id               VARCHAR PRIMARY KEY,
    company_id       VARCHAR NOT NULL,
    instance_id      VARCHAR NOT NULL,
    poll_message_id  VARCHAR NOT NULL,
    poll_chat_jid    VARCHAR NOT NULL,
    vote_message_id  VARCHAR NOT NULL,
    voter_jid        VARCHAR NOT NULL,
    voter_phone      VARCHAR,
    voter_name       VARCHAR,
    selected_options TEXT[] DEFAULT '{}',
    voted_at         TIMESTAMP DEFAULT now(),
    received_at      TIMESTAMP DEFAULT now()
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem votos"
ON public.poll_votes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── processed_webhooks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    event_id   TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem webhooks processados"
ON public.processed_webhooks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── raw_payloads ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.raw_payloads (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id        TEXT NOT NULL,
    payload_data      JSONB NOT NULL,
    source            TEXT,
    processing_status TEXT NOT NULL DEFAULT 'PENDING',
    processing_error  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.raw_payloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins acessam raw payloads"
ON public.raw_payloads FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── guardrail_events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guardrail_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    layer       TEXT NOT NULL,
    filter_name TEXT NOT NULL,
    phone       TEXT,
    job_id      UUID,
    blocked     BOOLEAN NOT NULL DEFAULT false,
    risk_score  FLOAT8 NOT NULL DEFAULT 0,
    reason      TEXT,
    violations  JSONB NOT NULL DEFAULT '[]',
    metadata    JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.guardrail_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem eventos de guardrail"
ON public.guardrail_events FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── hitl_pending ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hitl_pending (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    from_phone   TEXT NOT NULL,
    pmo_id       BIGINT REFERENCES public.pmos(id),
    user_id      TEXT,
    tool_name    TEXT NOT NULL,
    tool_args    JSONB NOT NULL,
    action_label TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'waiting',
    job_id       UUID
);

ALTER TABLE public.hitl_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam HITL"
ON public.hitl_pending FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── limites_seguranca ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.limites_seguranca (
    pmo_id           BIGINT NOT NULL REFERENCES public.pmos(id),
    propriedade_id   BIGINT NOT NULL REFERENCES public.propriedades(id),
    limite_transacao NUMERIC NOT NULL DEFAULT 50000.00,
    limite_manejo    NUMERIC NOT NULL DEFAULT 5000.00,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (pmo_id, propriedade_id)
);

ALTER TABLE public.limites_seguranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem seus limites"
ON public.limites_seguranca FOR ALL TO authenticated
USING (
    pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid())
);
