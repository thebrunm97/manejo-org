// supabase/functions/validate-upload/index.ts
// Edge Function for Magic Number (File Signature) Validation
// CWE-434 Defense-in-Depth Layer
// Deploy with: supabase functions deploy validate-upload --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Magic Number Signatures for allowed file types
// Reference: https://en.wikipedia.org/wiki/List_of_file_signatures
const MAGIC_SIGNATURES: Record<string, { bytes: Uint8Array; offset?: number }> = {
    "image/jpeg": { bytes: new Uint8Array([0xFF, 0xD8, 0xFF]) },
    "image/png": { bytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) },
    "image/gif": { bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38]) }, // GIF87a or GIF89a
    "image/webp": { bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]), offset: 0 }, // RIFF header, WEBP at offset 8
    "application/pdf": { bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) }, // %PDF
    // DOCX/DOC are ZIP-based or OLE
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        bytes: new Uint8Array([0x50, 0x4B, 0x03, 0x04]), // PK (ZIP header)
    },
    "application/msword": {
        bytes: new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), // OLE Compound
    },
};

// HEIC/HEIF have more complex detection (ftyp box at offset 4)
// For simplicity, we check for 'ftyp' string at offset 4
const HEIC_MIMES = ["image/heic", "image/heif"];

const ALLOWED_MIME_TYPES = [...Object.keys(MAGIC_SIGNATURES), ...HEIC_MIMES];

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateMagicNumber(bytes: Uint8Array, claimedMime: string): boolean {
    // Handle HEIC/HEIF separately
    if (HEIC_MIMES.includes(claimedMime)) {
        // Check for 'ftyp' at offset 4
        const ftypSignature = new Uint8Array([0x66, 0x74, 0x79, 0x70]); // 'ftyp'
        for (let i = 0; i < ftypSignature.length; i++) {
            if (bytes[4 + i] !== ftypSignature[i]) return false;
        }
        return true;
    }

    // Handle WebP (needs RIFF at 0 and WEBP at 8)
    if (claimedMime === "image/webp") {
        const riff = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF
        const webp = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // WEBP
        for (let i = 0; i < riff.length; i++) {
            if (bytes[i] !== riff[i]) return false;
        }
        for (let i = 0; i < webp.length; i++) {
            if (bytes[8 + i] !== webp[i]) return false;
        }
        return true;
    }

    const signature = MAGIC_SIGNATURES[claimedMime];
    if (!signature) return false;

    const offset = signature.offset ?? 0;
    for (let i = 0; i < signature.bytes.length; i++) {
        if (bytes[offset + i] !== signature.bytes[i]) return false;
    }
    return true;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const claimedMime = formData.get("mimeType") as string | null;

        if (!file) {
            return new Response(
                JSON.stringify({ error: "Missing file in form data" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!claimedMime) {
            return new Response(
                JSON.stringify({ error: "Missing mimeType in form data" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check if MIME type is in our allowed list
        if (!ALLOWED_MIME_TYPES.includes(claimedMime)) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    error: `MIME type "${claimedMime}" is not allowed`,
                    allowedTypes: ALLOWED_MIME_TYPES
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Read first 16 bytes for magic number validation
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer.slice(0, 16));

        if (!validateMagicNumber(bytes, claimedMime)) {
            console.warn(`[SECURITY] Magic number mismatch: claimed=${claimedMime}, file=${file.name}`);
            return new Response(
                JSON.stringify({
                    valid: false,
                    error: "File content does not match claimed MIME type",
                    detail: "O conteúdo do arquivo não corresponde ao tipo declarado. Possível tentativa de upload malicioso.",
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Validation passed
        console.log(`[SECURITY] File validated: ${file.name} (${claimedMime})`);
        return new Response(
            JSON.stringify({ valid: true, mimeType: claimedMime }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[SECURITY] Validation error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error during validation" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
