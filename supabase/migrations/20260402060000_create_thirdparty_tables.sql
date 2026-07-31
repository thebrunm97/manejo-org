-- Migration: Third-party & Infrastructure Tables (n8n, whatsmeow, WppConnect)
-- Created at: 2026-04-03 06:00:00 (runs before motor_agronomico, after operational tables)
-- These tables are managed by external services and were never versioned.

-- ── n8n tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.migrations (
    id        SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    name      VARCHAR NOT NULL
);

ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam migrations" ON public.migrations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.settings (
    key             VARCHAR PRIMARY KEY,
    value           TEXT NOT NULL,
    "loadOnStartup" BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam settings" ON public.settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.event_destinations (
    id          UUID PRIMARY KEY,
    destination JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

ALTER TABLE public.event_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam event_destinations" ON public.event_destinations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.installed_packages (
    "packageName"      VARCHAR PRIMARY KEY,
    "installedVersion" VARCHAR NOT NULL,
    "authorName"       VARCHAR,
    "authorEmail"      VARCHAR,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

ALTER TABLE public.installed_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam installed_packages" ON public.installed_packages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.installed_nodes (
    name            VARCHAR NOT NULL,
    type            VARCHAR NOT NULL,
    "latestVersion" INTEGER NOT NULL DEFAULT 1,
    package         VARCHAR NOT NULL REFERENCES public.installed_packages("packageName") ON DELETE CASCADE,
    PRIMARY KEY (name, package)
);

ALTER TABLE public.installed_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam installed_nodes" ON public.installed_nodes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.execution_annotations (
    id            SERIAL PRIMARY KEY,
    "executionId" INTEGER NOT NULL,
    vote          VARCHAR,
    note          TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

ALTER TABLE public.execution_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam execution_annotations" ON public.execution_annotations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.execution_annotation_tags (
    "annotationId" INTEGER NOT NULL REFERENCES public.execution_annotations(id) ON DELETE CASCADE,
    "tagId"        VARCHAR NOT NULL,
    PRIMARY KEY ("annotationId", "tagId")
);

ALTER TABLE public.execution_annotation_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam execution_annotation_tags" ON public.execution_annotation_tags FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE SEQUENCE IF NOT EXISTS execution_metadata_temp_id_seq;
CREATE TABLE IF NOT EXISTS public.execution_metadata (
    id            INTEGER PRIMARY KEY DEFAULT nextval('execution_metadata_temp_id_seq'),
    "executionId" INTEGER NOT NULL,
    key           VARCHAR NOT NULL,
    value         TEXT NOT NULL
);

ALTER TABLE public.execution_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam execution_metadata" ON public.execution_metadata FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id          VARCHAR PRIMARY KEY,
    "userId"    UUID NOT NULL,
    label       VARCHAR NOT NULL,
    "apiKey"    VARCHAR NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    scopes      JSON
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam user_api_keys" ON public.user_api_keys FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.workflow_history (
    "versionId"  VARCHAR NOT NULL,
    "workflowId" VARCHAR NOT NULL,
    authors      VARCHAR NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    nodes        JSON NOT NULL,
    connections  JSON NOT NULL,
    PRIMARY KEY ("versionId", "workflowId")
);

ALTER TABLE public.workflow_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam workflow_history" ON public.workflow_history FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── WppConnect labels & LID ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.labels (
    id           UUID PRIMARY KEY,
    instance_id  UUID,
    label_id     TEXT,
    label_name   TEXT,
    label_color  TEXT,
    predefined_id TEXT
);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam labels" ON public.labels FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.lid_mappings (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lid_id       TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    user_name    TEXT,
    created_at   TIMESTAMP DEFAULT now(),
    updated_at   TIMESTAMP DEFAULT now(),
    registered_by TEXT DEFAULT 'manual'
);

ALTER TABLE public.lid_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam lid_mappings" ON public.lid_mappings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.pending_lids (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lid_id     TEXT NOT NULL,
    sender_name TEXT,
    status     TEXT DEFAULT 'awaiting_phone',
    created_at TIMESTAMP DEFAULT now(),
    expires_at TIMESTAMP DEFAULT (now() + INTERVAL '24 hours')
);

ALTER TABLE public.pending_lids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam pending_lids" ON public.pending_lids FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── whatsmeow tables (Go WhatsApp client) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsmeow_device (
    jid                 TEXT PRIMARY KEY,
    lid                 TEXT,
    facebook_uuid       UUID,
    registration_id     BIGINT NOT NULL,
    noise_key           BYTEA NOT NULL,
    identity_key        BYTEA NOT NULL,
    signed_pre_key      BYTEA NOT NULL,
    signed_pre_key_id   INTEGER NOT NULL,
    signed_pre_key_sig  BYTEA NOT NULL,
    adv_key             BYTEA NOT NULL,
    adv_details         BYTEA NOT NULL,
    adv_account_sig     BYTEA NOT NULL,
    adv_account_sig_key BYTEA NOT NULL,
    adv_device_sig      BYTEA NOT NULL,
    platform            TEXT NOT NULL DEFAULT '',
    business_name       TEXT NOT NULL DEFAULT '',
    push_name           TEXT NOT NULL DEFAULT '',
    lid_migration_ts    BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.whatsmeow_device ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_device" ON public.whatsmeow_device FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_identity_keys (
    our_jid  TEXT NOT NULL,
    their_id TEXT NOT NULL,
    identity BYTEA NOT NULL,
    PRIMARY KEY (our_jid, their_id)
);

ALTER TABLE public.whatsmeow_identity_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_identity_keys" ON public.whatsmeow_identity_keys FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_pre_keys (
    jid      TEXT NOT NULL,
    key_id   INTEGER NOT NULL,
    key      BYTEA NOT NULL,
    uploaded BOOLEAN NOT NULL,
    PRIMARY KEY (jid, key_id)
);

ALTER TABLE public.whatsmeow_pre_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_pre_keys" ON public.whatsmeow_pre_keys FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_sessions (
    our_jid  TEXT NOT NULL,
    their_id TEXT NOT NULL,
    session  BYTEA,
    PRIMARY KEY (our_jid, their_id)
);

ALTER TABLE public.whatsmeow_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_sessions" ON public.whatsmeow_sessions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_sender_keys (
    our_jid    TEXT NOT NULL,
    chat_id    TEXT NOT NULL,
    sender_id  TEXT NOT NULL,
    sender_key BYTEA NOT NULL,
    PRIMARY KEY (our_jid, chat_id, sender_id)
);

ALTER TABLE public.whatsmeow_sender_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_sender_keys" ON public.whatsmeow_sender_keys FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_app_state_sync_keys (
    jid         TEXT NOT NULL,
    key_id      BYTEA NOT NULL,
    key_data    BYTEA NOT NULL,
    timestamp   BIGINT NOT NULL,
    fingerprint BYTEA NOT NULL,
    PRIMARY KEY (jid, key_id)
);

ALTER TABLE public.whatsmeow_app_state_sync_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_app_state_sync_keys" ON public.whatsmeow_app_state_sync_keys FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_app_state_version (
    jid     TEXT NOT NULL,
    name    TEXT NOT NULL,
    version BIGINT NOT NULL,
    hash    BYTEA NOT NULL,
    PRIMARY KEY (jid, name)
);

ALTER TABLE public.whatsmeow_app_state_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_app_state_version" ON public.whatsmeow_app_state_version FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_contacts (
    our_jid       TEXT NOT NULL,
    their_jid     TEXT NOT NULL,
    first_name    TEXT,
    full_name     TEXT,
    push_name     TEXT,
    business_name TEXT,
    redacted_phone TEXT,
    PRIMARY KEY (our_jid, their_jid)
);

ALTER TABLE public.whatsmeow_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_contacts" ON public.whatsmeow_contacts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_chat_settings (
    our_jid    TEXT NOT NULL,
    chat_jid   TEXT NOT NULL,
    muted_until BIGINT NOT NULL DEFAULT 0,
    pinned     BOOLEAN NOT NULL DEFAULT false,
    archived   BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (our_jid, chat_jid)
);

ALTER TABLE public.whatsmeow_chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_chat_settings" ON public.whatsmeow_chat_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_message_secrets (
    our_jid    TEXT NOT NULL,
    chat_jid   TEXT NOT NULL,
    sender_jid TEXT NOT NULL,
    message_id TEXT NOT NULL,
    key        BYTEA NOT NULL,
    PRIMARY KEY (our_jid, chat_jid, sender_jid, message_id)
);

ALTER TABLE public.whatsmeow_message_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_message_secrets" ON public.whatsmeow_message_secrets FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_privacy_tokens (
    our_jid          TEXT NOT NULL,
    their_jid        TEXT NOT NULL,
    token            BYTEA NOT NULL,
    timestamp        BIGINT NOT NULL,
    sender_timestamp BIGINT,
    PRIMARY KEY (our_jid, their_jid)
);

ALTER TABLE public.whatsmeow_privacy_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_privacy_tokens" ON public.whatsmeow_privacy_tokens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_lid_map (
    lid TEXT NOT NULL,
    pn  TEXT NOT NULL,
    PRIMARY KEY (lid)
);

ALTER TABLE public.whatsmeow_lid_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_lid_map" ON public.whatsmeow_lid_map FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsmeow_version (
    version INTEGER NOT NULL,
    compat  INTEGER
);

ALTER TABLE public.whatsmeow_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins acessam whatsmeow_version" ON public.whatsmeow_version FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
