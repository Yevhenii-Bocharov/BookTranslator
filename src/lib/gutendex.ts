import { supabase } from "./supabaseClient";

const BASE_URL = "https://gutendex.com/books";

export type GutenbergBook = {
  id: number;
  title: string;
  authors: { name: string; birth_year: number | null; death_year: number | null }[];
  languages: string[];
  subjects: string[];
  bookshelves: string[];
  copyright: boolean | null;
  download_count: number;
  summaries?: string[];
  formats: Record<string, string>;
};

export type GutendexResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutenbergBook[];
};

export type BookQuery = {
  search?: string;
  languages?: string[]; // e.g. ["en", "fr"]
  topic?: string;
  sort?: "popular" | "ascending" | "descending";
  page?: number;
};

export function coverUrl(book: GutenbergBook): string | null {
  return book.formats["image/jpeg"] ?? null;
}

export function authorNames(book: GutenbergBook): string {
  if (book.authors.length === 0) return "Unknown author";
  return book.authors.map((a) => a.name).join(", ");
}

export function plainTextUrl(book: GutenbergBook): string | null {
  const entry = Object.entries(book.formats).find(
    ([mime]) => mime.startsWith("text/plain")
  );
  return entry ? entry[1] : null;
}

export function epubUrl(book: GutenbergBook): string | null {
  const entry = Object.entries(book.formats).find(([mime]) => mime.startsWith("application/epub+zip"));
  return entry ? entry[1] : null;
}

export type DownloadOption = {
  label: string;
  url: string;
};

// Maps Gutendex's raw MIME-keyed formats map to a friendly, de-duplicated
// list of downloadable files. These are plain links (browser-native
// downloads), so the gutenberg.org CORS restrictions that affect fetch()
// don't apply here at all.
const DOWNLOAD_FORMAT_RULES: { test: (mime: string) => boolean; label: string; priority: number }[] = [
  { test: (m) => m.startsWith("application/epub+zip"), label: "EPUB", priority: 1 },
  { test: (m) => m.startsWith("application/x-mobipocket-ebook"), label: "Kindle (.mobi)", priority: 2 },
  { test: (m) => m.startsWith("application/pdf"), label: "PDF", priority: 3 },
  { test: (m) => m.startsWith("text/plain"), label: "Plain text (.txt)", priority: 4 },
  { test: (m) => m.startsWith("text/html"), label: "Read on gutenberg.org (HTML)", priority: 5 },
];

export function downloadableFormats(book: GutenbergBook): DownloadOption[] {
  const seen = new Set<string>();
  const options: (DownloadOption & { priority: number })[] = [];

  for (const [mime, url] of Object.entries(book.formats)) {
    const rule = DOWNLOAD_FORMAT_RULES.find((r) => r.test(mime));
    if (!rule || seen.has(rule.label)) continue;
    seen.add(rule.label);
    options.push({ label: rule.label, url, priority: rule.priority });
  }

  return options.sort((a, b) => a.priority - b.priority).map(({ label, url }) => ({ label, url }));
}

export async function fetchBooks(query: BookQuery): Promise<GutendexResponse> {
  const params = new URLSearchParams();
  // Only fetch public-domain (no active copyright) books, matching the "no copyright" requirement.
  params.set("copyright", "false");
  if (query.search) params.set("search", query.search);
  if (query.languages && query.languages.length > 0) {
    params.set("languages", query.languages.join(","));
  }
  if (query.topic) params.set("topic", query.topic);
  if (query.sort) params.set("sort", query.sort);
  if (query.page) params.set("page", String(query.page));

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Gutendex request failed: ${res.status}`);
  return res.json();
}

export async function fetchBooksFromUrl(url: string): Promise<GutendexResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gutendex request failed: ${res.status}`);
  return res.json();
}

export async function fetchBook(id: number): Promise<GutenbergBook> {
  const res = await fetch(`https://gutendex.com/books/${id}`);
  if (!res.ok) throw new Error(`Gutendex request failed: ${res.status}`);
  return res.json();
}

// gutenberg.org's file servers don't send Access-Control-Allow-Origin, so a
// direct browser fetch() is blocked by CORS for most book text files.
//
// Preferred path: a Supabase Edge Function (supabase/functions/fetch-book-text)
// that fetches the text server-side, where CORS doesn't apply. If that
// function isn't deployed yet, fall back to a chain of public CORS proxies
// (less reliable — they can rate-limit or go down).
function buildProxyUrls(url: string): string[] {
  const encoded = encodeURIComponent(url);
  return [
    url, // direct, no proxy
    `https://corsproxy.io/?url=${encoded}`,
    `https://api.allorigins.win/raw?url=${encoded}`,
    `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
  ];
}

async function fetchBookTextViaProxies(url: string): Promise<string> {
  let lastError: unknown = null;

  for (const candidate of buildProxyUrls(url)) {
    try {
      const res = await fetch(candidate);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const text = await res.text();
      // A couple of these proxies return an HTML error page with a 200
      // status when they can't reach the target, so sanity-check the body
      // actually looks like book text before trusting it.
      if (text.trim().length > 500) return text;
      throw new Error("Response too short to be the book text");
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All fetch attempts failed");
}

export async function fetchBookText(url: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-book-text", {
      body: { url },
    });
    if (error) {
      // supabase-js's FunctionsHttpError hides the response body by default;
      // pull it out so we can see the actual reason (400/502/etc + message).
      const context = (error as { context?: Response }).context;
      let detail = "";
      try {
        detail = context ? await context.clone().text() : "";
      } catch {
        /* ignore */
      }
      console.error("[fetchBookText] Edge function error:", error.message, detail);
      throw error;
    }
    if (data?.text) return data.text as string;
    console.error("[fetchBookText] Edge function returned no text:", data);
    throw new Error("Edge function returned no text");
  } catch (err) {
    console.warn("[fetchBookText] Falling back to CORS proxies because:", err);
    return fetchBookTextViaProxies(url);
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function fetchBookFileViaProxies(url: string): Promise<ArrayBuffer> {
  let lastError: unknown = null;
  for (const candidate of buildProxyUrls(url)) {
    try {
      const res = await fetch(candidate);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 1000) return buf;
      throw new Error("Response too small to be a real file");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All fetch attempts failed");
}

// Same CORS problem as fetchBookText, but for binary files (EPUB). Prefers
// the Supabase Edge Function (base64-encoded response), falling back to the
// public proxy chain if the function isn't deployed or fails.
export async function fetchBookFile(url: string): Promise<ArrayBuffer> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-book-file", {
      body: { url },
    });
    if (error) {
      const context = (error as { context?: Response }).context;
      let detail = "";
      try {
        detail = context ? await context.clone().text() : "";
      } catch {
        /* ignore */
      }
      console.error("[fetchBookFile] Edge function error:", error.message, detail);
      throw error;
    }
    if (data?.base64) return base64ToArrayBuffer(data.base64 as string);
    console.error("[fetchBookFile] Edge function returned no data:", data);
    throw new Error("Edge function returned no file data");
  } catch (err) {
    console.warn("[fetchBookFile] Falling back to CORS proxies because:", err);
    return fetchBookFileViaProxies(url);
  }
}
