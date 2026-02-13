-- SCRIPT DE DIAGNÓSTICO DE DADOS (CORRIGIDO)
-- Rode este script no Editor SQL do Supabase

-- 1. Verifique as últimas atualizações no PMO
SELECT 
    id, 
    created_at, -- Corrigido de updated_at para created_at
    jsonb_array_length(form_data->'insumos_melhorar_fertilidade') as qtd_insumos_sec8,
    form_data->'insumos_melhorar_fertilidade' as dados_brutos_sec8
FROM pmos
ORDER BY created_at DESC
LIMIT 5;

-- 2. Verifique dados de ML (Feedback Loop)
SELECT 
    id, 
    created_at, 
    processado, 
    foi_editado, 
    status_validacao, 
    json_corrigido 
FROM logs_treinamento
WHERE processado = true
ORDER BY created_at DESC
LIMIT 5;
