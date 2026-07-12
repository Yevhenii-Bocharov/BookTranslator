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
