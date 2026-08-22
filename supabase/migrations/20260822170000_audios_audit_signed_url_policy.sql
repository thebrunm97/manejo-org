-- P1-5 — permite ao titular assinar URL do próprio áudio.
--
-- CONTEXTO
--
-- Ao fechar o bucket `audios_audit` (P0-1, que estava público e expunha toda
-- gravação a quem tivesse o link), as URLs em `caderno_campo.audio_url`
-- passaram a retornar 400 e os players do frontend quebraram.
--
-- A correção não é reabrir o bucket, e sim trocar URL pública por URL ASSINADA
-- de curta duração. Guardar URL pública numa coluna significa que vazar a
-- tabela vaza também o acesso ao áudio — permanentemente e sem expiração. A
-- assinatura tem prazo curto e é emitida só para quem a política autoriza.
--
-- Mas `createSignedUrl` só autoriza quem tem permissão de leitura sobre o
-- objeto, e um bucket privado sem política não permite nada a ninguém. Daí
-- estas políticas.
--
-- COMO O DONO É DERIVADO
--
-- Os dois buckets usam convenções de caminho diferentes, por razões históricas:
--
--   audios_audit (legado):  pmo_<id>/<data>/<arquivo>.ogg   → join com pmos
--   audit-vault  (cofre):   <profile_id>/<data>/<aleatorio>.ogg → direto
--
-- O formato do cofre é melhor justamente por dispensar o join — foi escolhido
-- assim para que o expurgo por titular (art. 18, VI) possa varrer por prefixo.
--
-- Verificado antes de aplicar: os PMOs 6 e 7 (únicos com objetos) têm
-- `user_id` preenchido, e o teste de isolamento confirmou 24/24 objetos
-- autorizados ao titular e 0/24 a um usuário estranho.

BEGIN;

-- Somente SELECT em ambas: assinar exige apenas leitura.
--
-- Escrita e exclusão continuam exclusivas do service_role (bot e Triturador),
-- pelo mesmo motivo que a tabela do Cofre não tem política de DELETE para o
-- titular: ele não deve poder destruir a própria prova de não-repúdio.

DROP POLICY IF EXISTS "titular assina audio do proprio pmo" ON storage.objects;

CREATE POLICY "titular assina audio do proprio pmo"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audios_audit'
  AND EXISTS (
    SELECT 1
    FROM public.pmos p
    WHERE p.user_id = auth.uid()
      AND 'pmo_' || p.id::text = split_part(storage.objects.name, '/', 1)
  )
);

DROP POLICY IF EXISTS "titular assina audio do cofre" ON storage.objects;

CREATE POLICY "titular assina audio do cofre"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audit-vault'
  AND auth.uid()::text = split_part(storage.objects.name, '/', 1)
);

COMMIT;
