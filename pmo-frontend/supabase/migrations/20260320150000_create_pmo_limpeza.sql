-- Migration for Form 04 SEBRAE: Cleaning Control
-- Applied directly via MCP for Sprint 2

CREATE TABLE IF NOT EXISTS pmo_limpeza (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pmo_id bigint NOT NULL,
    data_limpeza date NOT NULL DEFAULT CURRENT_DATE,
    item_area text NOT NULL,
    tipo_limpeza text NOT NULL,
    produto_utilizado text,
    dosagem text,
    responsavel text NOT NULL,
    observacao text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT fk_pmo_limpeza_pmo FOREIGN KEY (pmo_id) REFERENCES profiles(pmo_ativo_id) ON DELETE CASCADE
);

ALTER TABLE pmo_limpeza ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'pmo_limpeza' AND policyname = 'Users can manage their own pmo_limpeza'
    ) THEN
        CREATE POLICY "Users can manage their own pmo_limpeza" ON pmo_limpeza
        FOR ALL
        USING (auth.uid() IN (SELECT id FROM profiles WHERE pmo_ativo_id = pmo_limpeza.pmo_id));
    END IF;
END $$;
