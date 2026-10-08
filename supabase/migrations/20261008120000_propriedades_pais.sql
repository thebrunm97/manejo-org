-- País da propriedade — primeiro passo de internacionalização (Moçambique).
--
-- Até aqui a localização era sempre "cidade/UF" brasileira. Com pais = 'MZ',
-- as mesmas colunas guardam o DISTRITO (cidade) e a PROVÍNCIA em código
-- ISO 3166-2:MZ (uf: L, MPM, G, I, S, B, T, Q, N, P, A) — ver
-- pmo-bot-go/internal/zae. Isso evita uma tabela de endereço nova só para um
-- piloto, e todo código que já lê cidade/uf continua funcionando.
--
-- Aditiva e segura em produção: todas as propriedades existentes são
-- brasileiras e ficam com o default 'BR'.

ALTER TABLE public.propriedades
  ADD COLUMN IF NOT EXISTS pais TEXT NOT NULL DEFAULT 'BR';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'propriedades_pais_iso2' AND conrelid = 'public.propriedades'::regclass
  ) THEN
    ALTER TABLE public.propriedades
      ADD CONSTRAINT propriedades_pais_iso2 CHECK (pais ~ '^[A-Z]{2}$');
  END IF;
END
$$;

COMMENT ON COLUMN public.propriedades.pais IS
  'País da propriedade, ISO 3166-1 alfa-2 (BR, MZ). Em MZ, cidade = distrito e uf = província ISO 3166-2:MZ.';
