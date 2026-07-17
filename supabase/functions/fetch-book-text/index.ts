// Supabase Edge Function: fetch-book-text
//
// Fetches a Project Gutenberg plain-text file server-side and returns it to
// the browser. CORS is a browser-only restriction, so a server making this
// same request never hits it — this sidesteps the gutenberg.org CORS issue
// entirely instead of relying on flaky third-party CORS proxies.
//
// Deploy with:
//   supabase functions deploy fetch-book-text --no-verify-jwt
//
// Call from the client with:
//   supabase.functions.invoke('fetch-book-text', { body: { url } })

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Only allow fetching from gutenberg.org so this function can't be used as
// an open proxy to arbitrary URLs.
const ALLOWED_HOST_SUFFIX = "gutenberg.org";

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
        // Some Gutenberg mirrors reject requests with no/unusual User-Agent.
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

    const text = await upstream.text();

    return new Response(JSON.stringify({ text }), {
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
