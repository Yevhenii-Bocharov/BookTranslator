import { useEffect, useState } from "react";
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
  const [sort, setSort] = useState<"popular" | "ascending" | "descending">("popular");

  const [response, setResponse] = useState<GutendexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<GutenbergBook | null>(null);

  // Debounce the search box so we don't fire a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchBooks({
      search: search || undefined,
      languages: language ? [language] : undefined,
      sort,
    })
      .then(setResponse)
      .catch(() => setError("Couldn't load books right now. Try again in a moment."))
      .finally(() => setLoading(false));
  }, [search, language, sort]);

  const loadPage = (url: string | null) => {
    if (!url) return;
    setLoading(true);
    setError(null);
    fetchBooksFromUrl(url)
      .then(setResponse)
      .catch(() => setError("Couldn't load that page. Try again."))
      .finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="home-page">
      <div className="home-hero">
        <h1>Discover public-domain books</h1>
        <p>Read the classics while learning a language — click any word as you go.</p>
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

        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="popular">Most popular</option>
          <option value="descending">Newest catalog ID</option>
          <option value="ascending">Oldest catalog ID</option>
        </select>
      </div>

      {error && <p className="home-error">{error}</p>}

      {loading ? (
        <p className="home-status">Loading books…</p>
      ) : response && response.results.length === 0 ? (
        <p className="home-status">No books match those filters.</p>
      ) : (
        <>
          <div className="home-grid">
            {response?.results.map((book) => (
              <GutenbergBookCard key={book.id} book={book} onClick={() => setSelectedBook(book)} />
            ))}
          </div>

          <div className="home-pagination">
            <button
              disabled={!response?.previous}
              onClick={() => loadPage(response?.previous ?? null)}
            >
              ← Previous
            </button>
            <button disabled={!response?.next} onClick={() => loadPage(response?.next ?? null)}>
              Next →
            </button>
          </div>
        </>
      )}

      {selectedBook && (
        <GutenbergBookModal book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  );
}
