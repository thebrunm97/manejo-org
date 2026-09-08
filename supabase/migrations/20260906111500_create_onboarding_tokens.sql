-- Migration: Create onboarding_tokens table for secure Auth PKCE exchange
-- Enables securely tracking single-use opaque codes for onboarding links

CREATE TABLE IF NOT EXISTS public.onboarding_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false
);

-- Index for fast token exchange lookup
CREATE INDEX IF NOT EXISTS idx_onboarding_tokens_hash ON public.onboarding_tokens(token_hash);

-- Enable RLS
ALTER TABLE public.onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- Notice: NO public policies are created. 
-- Access is strictly through the `service_role` key from the backend.
