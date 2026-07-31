-- Add new columns for OpenRouter sync
ALTER TABLE public.rag_arena_models
    ADD COLUMN supports_structured_outputs BOOLEAN DEFAULT FALSE,
    ADD COLUMN context_length INTEGER,
    ADD COLUMN prompt_price NUMERIC(24,10),
    ADD COLUMN completion_price NUMERIC(24,10),
    ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;

-- We need model_id to be unique to allow upserts
ALTER TABLE public.rag_arena_models
    ADD CONSTRAINT rag_arena_models_model_id_key UNIQUE (model_id);

-- Create the RPC for bulk upserting models
CREATE OR REPLACE FUNCTION public.upsert_arena_models(p_models jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_model jsonb;
BEGIN
    FOR v_model IN SELECT * FROM jsonb_array_elements(p_models)
    LOOP
        INSERT INTO public.rag_arena_models (
            model_id,
            provider_name,
            label,
            temperature,
            is_active,
            is_default,
            sort_order,
            supports_tools,
            supports_structured_outputs,
            context_length,
            prompt_price,
            completion_price,
            last_synced_at
        )
        VALUES (
            v_model->>'model_id',
            v_model->>'provider_name',
            COALESCE(v_model->>'label', v_model->>'model_id'),
            0.2, -- default temperature
            FALSE, -- is_active default to FALSE for newly inserted
            FALSE,
            100,
            COALESCE((v_model->>'supports_tools')::boolean, false),
            COALESCE((v_model->>'supports_structured_outputs')::boolean, false),
            (v_model->>'context_length')::integer,
            (v_model->>'prompt_price')::numeric,
            (v_model->>'completion_price')::numeric,
            now()
        )
        ON CONFLICT (model_id) DO UPDATE SET
            supports_tools = EXCLUDED.supports_tools,
            supports_structured_outputs = EXCLUDED.supports_structured_outputs,
            context_length = EXCLUDED.context_length,
            prompt_price = EXCLUDED.prompt_price,
            completion_price = EXCLUDED.completion_price,
            last_synced_at = EXCLUDED.last_synced_at;
            -- Note: We intentionally do NOT update is_active, label, temperature, etc.
            -- to preserve admin customizations for existing models.
    END LOOP;
END;
$$;
