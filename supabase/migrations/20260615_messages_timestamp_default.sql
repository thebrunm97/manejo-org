-- Migration: Set default timestamp for messages table to now()
-- File: supabase/migrations/20260615_messages_timestamp_default.sql

BEGIN;

ALTER TABLE public.messages ALTER COLUMN timestamp SET DEFAULT now();

COMMIT;
