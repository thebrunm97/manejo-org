-- Fix deprecated/invalid model names
UPDATE public.rag_arena_models 
SET model_id = 'moonshotai/moonlight-16b-a3b-instruct', label = 'Moonlight 16B'
WHERE model_id = 'moonshotai/moonshot-v1-8k';

UPDATE public.rag_arena_models 
SET model_id = 'z-ai/glm-4.5-air', label = 'GLM-4.5 Air'
WHERE model_id = 'zhipuai/glm-4-9b-chat';
