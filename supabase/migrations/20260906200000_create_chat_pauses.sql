-- Migration: 20260906200000_create_chat_pauses.sql
-- Description: Creates the chat_pauses table to track bot pausing by phone number.

CREATE TABLE public.chat_pauses (
    phone TEXT PRIMARY KEY,
    is_paused BOOLEAN NOT NULL DEFAULT true,
    paused_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paused_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.chat_pauses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins podem gerenciar chat_pauses"
    ON public.chat_pauses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Add helper RPC to toggle bot pause state
CREATE OR REPLACE FUNCTION toggle_bot_pause(p_phone TEXT, p_paused BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.chat_pauses (phone, is_paused, paused_by, paused_at)
    VALUES (p_phone, p_paused, auth.uid(), NOW())
    ON CONFLICT (phone) DO UPDATE 
    SET is_paused = EXCLUDED.is_paused,
        paused_by = EXCLUDED.paused_by,
        paused_at = EXCLUDED.paused_at;
END;
$$;

-- Add helper RPC to get bot pause status
CREATE OR REPLACE FUNCTION get_bot_pause_status(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT is_paused 
    FROM public.chat_pauses 
    WHERE phone = p_phone;
$$;

GRANT ALL ON public.chat_pauses TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_pauses TO authenticated;
