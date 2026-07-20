import { useEffect, useState, useRef } from "react";
import {
  fetchBooks,
  fetchBooksFromUrl,
  type GutenbergBook,
  type GutendexResponse,
} from "../../lib/gutendex";
import GutenbergBookCard from "../../components/GutenbergBookCard/GutenbergBookCard";
import GutenbergBookModal from "../../components/GutenbergBookModal/GutenbergBookModal";
import "./HomePage.css";

const LANGUAGE_OPTIONS = [
  { code: "", label: "Any language" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
];

export default function HomePage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [sort, setSort] = useState<"popular" | "ascending" | "descending">(
    "popular",
  );

  const [response, setResponse] = useState<GutendexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<GutenbergBook | null>(null);

  // In-memory reference cache for next page prefetching to avoid state-trigger storms
  const prefetchedNext = useRef<{ url: string; data: GutendexResponse } | null>(
    null,
  );

  // 1. Debounce the search input to avoid spamming the slow API
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 2. Fetch or serve from fast SessionStorage cache
  useEffect(() => {
    setLoading(true);
    setError(null);

    const cacheKey = `gutendex_q_${search}_lang_${language}_sort_${sort}`;
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
      setResponse(JSON.parse(cachedData));
      setLoading(false);
      return;
    }

    fetchBooks({
      search: search || undefined,
      languages: language ? [language] : undefined,
      sort,
    })
      .then((data) => {
        setResponse(data);
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      })
      .catch(() =>
        setError("Couldn't load books right now. Try again in a moment."),
      )
      .finally(() => setLoading(false));
  }, [search, language, sort]);

  // 3. Silent Prefetcher Engine for Next Page
  useEffect(() => {
    if (!response?.next) return;
    const nextUrl = response.next;

    // Skip if we already cached this next page URL locally
    if (
      sessionStorage.getItem(nextUrl) ||
      prefetchedNext.current?.url === nextUrl
    )
      return;

    fetchBooksFromUrl(nextUrl)
      .then((data) => {
        prefetchedNext.current = { url: nextUrl, data };
        sessionStorage.setItem(nextUrl, JSON.stringify(data));
      })
      .catch(() => {}); // Fail silently behind the scenes
  }, [response]);

  const loadPage = (url: string | null) => {
    if (!url) return;
    setLoading(true);
    setError(null);

    // Check memory/storage caches first
    const cachedPage = sessionStorage.getItem(url);
    if (cachedPage) {
      setResponse(JSON.parse(cachedPage));
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Fallback to fetch if cache missed
    fetchBooksFromUrl(url)
      .then((data) => {
        setResponse(data);
        sessionStorage.setItem(url, JSON.stringify(data));
      })
      .catch(() => setError("Couldn't load that page. Try again."))
      .finally(() => setLoading(false));

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="home-page">
      <div className="home-hero">
        <h1>Discover public-domain books</h1>
        <p>
          Read the classics while learning a language — click any word as you
          go.
        </p>
      </div>

      <div className="home-filters">
        <input
          className="home-search"
          type="text"
          placeholder="Search by title or author…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="popular">Most popular</option>
          <option value="descending">Newest catalog ID</option>
          <option value="ascending">Oldest catalog ID</option>
        </select>
      </div>

      {error && <p className="home-error">{error}</p>}

      {/* Optimistic UI state overlay to prevent layout flashing shifts */}
      <div
        className={`home-content-wrapper ${loading ? "content-loading" : ""}`}
      >
        {loading && !response && <p className="home-status">Loading books…</p>}

        {response && response.results.length === 0 && !loading && (
          <p className="home-status">No books match those filters.</p>
        )}

        {response && response.results.length > 0 && (
          <>
            <div className="home-grid">
              {response.results.map((book) => (
                <GutenbergBookCard
                  key={book.id}
                  book={book}
                  onClick={() => setSelectedBook(book)}
                />
              ))}
            </div>

            <div className="home-pagination">
              <button
                disabled={!response.previous || loading}
                onClick={() => loadPage(response.previous)}
              >
                ← Previous
              </button>
              <button
                disabled={!response.next || loading}
                onClick={() => loadPage(response.next)}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      {selectedBook && (
        <GutenbergBookModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </div>
  );
}
