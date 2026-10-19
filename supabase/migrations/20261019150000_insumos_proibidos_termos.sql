-- Lista de insumos proibidos em produção orgânica: termos curtos, como o
-- produtor escreve ("NPK", "ureia"), e não só nomes longos. O bot compara por
-- palavra inteira, sem acento (pmo-bot-go: supabase.IsProhibitedCheck), e só
-- avisa em área ORGANICO/TRANSICAO.
--
-- Base normativa:
--   BR: Portaria MAPA nº 52/2021, Anexos V e VI (fertilizantes e
--       agrotóxicos permitidos; o que não está listado não é permitido).
--   MZ: sem regulamento nacional; referência IFOAM Norms / East African
--       Organic Products Standard (EAS 456), que excluem adubos minerais
--       sintéticos solúveis e agrotóxicos de síntese.
-- Fosfato natural, sulfato de potássio de origem natural, calcário e gesso
-- são permitidos e ficam de fora de propósito.

ALTER TABLE public.insumos_proibidos ADD COLUMN IF NOT EXISTS referencia TEXT;

INSERT INTO public.insumos_proibidos (nome, referencia)
SELECT v.nome, v.referencia
FROM (VALUES
    -- Adubos minerais sintéticos solúveis
    ('NPK',                    'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Ureia',                  'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Uréia',                  'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Superfosfato',           'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Sulfato de amônio',      'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Nitrato de amônio',      'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Nitrato de cálcio',      'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Cloreto de potássio',    'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('KCl',                    'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('MAP',                    'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('DAP',                    'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Fosfato monoamônico',    'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    ('Fosfato diamônico',      'Portaria MAPA 52/2021 Anexo V; IFOAM/EAS 456'),
    -- Agrotóxicos de síntese (comuns no BR e em MZ)
    ('Glifosato',              'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Paraquat',               'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('2,4-D',                  'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Atrazina',               'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Mancozebe',              'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Mancozeb',               'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Clorpirifós',            'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Cipermetrina',           'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Lambda-cialotrina',      'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Imidacloprido',          'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456'),
    ('Carbofurano',            'Portaria MAPA 52/2021 Anexo VI; IFOAM/EAS 456')
) AS v(nome, referencia)
WHERE NOT EXISTS (
    SELECT 1 FROM public.insumos_proibidos p WHERE lower(p.nome) = lower(v.nome)
);

UPDATE public.insumos_proibidos
SET referencia = 'Portaria MAPA 52/2021; IFOAM/EAS 456'
WHERE referencia IS NULL;
