// Supabase Edge Function: fetch-book-file
//
// Same idea as fetch-book-text, but for binary files (EPUB, MOBI, etc).
// Fetches server-side (no CORS restriction applies to server-to-server
// requests) and returns the bytes base64-encoded in JSON, since Deno Edge
// Functions respond most reliably with JSON across all client setups.
//
// Deploy with:
//   supabase functions deploy fetch-book-file --no-verify-jwt
//
// Call from the client with:
//   supabase.functions.invoke('fetch-book-file', { body: { url } })

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Only allow fetching from gutenberg.org so this function can't be used as
// an open proxy to arbitrary URLs.
const ALLOWED_HOST_SUFFIX = "gutenberg.org";

function toBase64(bytes: Uint8Array): string {
  // Chunk to avoid call-stack limits on String.fromCharCode(...bigArray)
  // for large files (some EPUBs are several MB).
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { url } = await req.json();

    if (typeof url !== "string" || !url) {
      return new Response(JSON.stringify({ error: "Missing 'url' in request body." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
      return new Response(JSON.stringify({ error: "URL host not allowed." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookTranslatorApp/1.0)",
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream fetch failed: ${upstream.status}` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    const base64 = toBase64(bytes);
    const contentType = upstream.headers.get("Content-Type") ?? "application/octet-stream";

    return new Response(JSON.stringify({ base64, contentType }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
