-- =========================================================
-- STORAGE SECURITY POLICIES FOR BUCKET: anexos-pmos
-- Target: PostgreSQL 15+ / Supabase
-- CWE-434 Mitigation: Unrestricted Upload of Dangerous Files
-- Created: 2026-01-19
-- =========================================================

-- Enable RLS on storage.objects (should already be enabled, but safe to call)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------
-- HELPER FUNCTION: Validate file extension from object name
-- -----------------------------------------------------------
-- Extracts the last extension from the filename and checks against whitelist
-- Handles edge cases like double extensions (.pdf.exe) by only checking the final one
CREATE OR REPLACE FUNCTION storage.validate_file_extension(name text, allowed_extensions text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    file_extension text;
BEGIN
    -- Extract extension (case-insensitive, takes the last segment after '.')
    file_extension := LOWER(
        SUBSTRING(name FROM '\.([^\.\/]+)$')
    );
    
    -- If no extension found, reject
    IF file_extension IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if extension is in the allowed list
    RETURN file_extension = ANY(allowed_extensions);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION storage.validate_file_extension(text, text[]) TO authenticated;

-- -----------------------------------------------------------
-- ALLOWED EXTENSIONS REFERENCE
-- -----------------------------------------------------------
-- This list matches the frontend's accept attributes in WebMediaPicker.ts:
-- Images: jpg, jpeg, png, gif, webp, heic, heif
-- Documents: pdf, doc, docx

-- -----------------------------------------------------------
-- POLICY 1: INSERT (Upload) - Extension & Ownership Validation
-- -----------------------------------------------------------
-- Users can only upload to their own folder (userId/filename)
-- File extension must be in the allowed whitelist
DROP POLICY IF EXISTS "Upload policy for anexos-pmos" ON storage.objects;

CREATE POLICY "Upload policy for anexos-pmos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'anexos-pmos'
    -- Ownership: first folder segment must match user's auth.uid
    AND auth.uid()::text = (storage.foldername(name))[1]
    -- Extension whitelist validation
    AND storage.validate_file_extension(
        name,
        ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf', 'doc', 'docx']
    )
);

-- -----------------------------------------------------------
-- POLICY 2: SELECT (Read) - Users read their own files
-- -----------------------------------------------------------
-- Each user can only read files within their own folder
DROP POLICY IF EXISTS "Read policy for anexos-pmos" ON storage.objects;

CREATE POLICY "Read policy for anexos-pmos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ALTERNATIVE: If you need PUBLIC read access (e.g., for sharing URLs):
-- Uncomment below and comment out the policy above
-- CREATE POLICY "Public read policy for anexos-pmos"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'anexos-pmos');

-- -----------------------------------------------------------
-- POLICY 3: DELETE - Users delete their own files only
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "Delete policy for anexos-pmos" ON storage.objects;

CREATE POLICY "Delete policy for anexos-pmos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- -----------------------------------------------------------
-- POLICY 4: UPDATE - Prevent metadata tampering
-- -----------------------------------------------------------
-- Users can update their own files but cannot change to a disallowed extension
DROP POLICY IF EXISTS "Update policy for anexos-pmos" ON storage.objects;

CREATE POLICY "Update policy for anexos-pmos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
    -- Prevent extension change to a disallowed type on update
    AND storage.validate_file_extension(
        name,
        ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf', 'doc', 'docx']
    )
);

-- =========================================================
-- VERIFICATION QUERIES (Run these after applying migration)
-- =========================================================
-- 1. Check that policies were created:
-- SELECT policyname, tablename FROM pg_policies WHERE tablename = 'objects';
--
-- 2. Test the helper function:
-- SELECT storage.validate_file_extension('photo.jpg', ARRAY['jpg', 'png']); -- true
-- SELECT storage.validate_file_extension('malware.exe', ARRAY['jpg', 'png']); -- false
-- SELECT storage.validate_file_extension('tricky.jpg.exe', ARRAY['jpg', 'png']); -- false
-- =========================================================
