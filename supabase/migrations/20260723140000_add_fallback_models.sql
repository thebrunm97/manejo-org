-- Migração para suporte a Resilient Intelligent Routing (Sprint 3)

-- 1. Adicionar suporte a fallbacks na tabela de configuração de modelos da Arena
ALTER TABLE rag_arena_models
ADD COLUMN fallback_models TEXT[] DEFAULT '{}';

-- 2. Adicionar rastreamento do modelo real que respondeu a requisição na tabela de execuções
ALTER TABLE rag_experiment_runs
ADD COLUMN actual_model_used TEXT;

-- Adicionar comentário para documentar os campos
COMMENT ON COLUMN rag_arena_models.fallback_models IS 'Lista ordenada de model IDs para fallback automático via OpenRouter em caso de rate limit ou falha.';
COMMENT ON COLUMN rag_experiment_runs.actual_model_used IS 'O modelo que efetivamente gerou a resposta (pode diferir do requested_model se houve fallback).';
