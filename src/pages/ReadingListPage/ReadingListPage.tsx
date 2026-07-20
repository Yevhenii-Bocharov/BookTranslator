import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import "./ReadingListPage.css";

type SavedBook = {
  gutenberg_id: number;
  title: string;
  authors: string | null;
  cover_url: string | null;
  languages: string | null;
  description?: string | null;
};

type BookStats = {
  progressPercent: number;
  savedWordsCount: number;
};

export default function ReadingListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBook, setSelectedBook] = useState<SavedBook | null>(null);
  const [selectedStats, setSelectedStats] = useState<BookStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reading_list")
      .select("gutenberg_id, title, authors, cover_url, languages")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Supabase Error Details:", error);
        setBooks(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const handleSelectBook = async (book: SavedBook) => {
    setSelectedBook(book);
    setLoadingStats(true);
    setSelectedStats(null);

    if (!user) return;

    try {
      const progressReq = supabase
        .from("reading_progress")
        .select("current_page")
        .eq("user_id", user.id)
        .eq("document_type", "gutenberg")
        .eq("document_id", String(book.gutenberg_id))
        .maybeSingle();

      const wordsReq = supabase
        .from("saved_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("gutenberg_id", book.gutenberg_id);

      const [progressRes, wordsRes] = await Promise.all([
        progressReq,
        wordsReq,
      ]);
      const currentPage = progressRes.data?.current_page ?? 0;

      setSelectedStats({
        progressPercent:
          currentPage > 0
            ? Math.min(100, Math.max(1, Math.round(currentPage * 0.8)))
            : 0,
        savedWordsCount: wordsRes.count ?? 0,
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleRemoveBook = async (e: React.MouseEvent, bookId: number) => {
    e.stopPropagation();
    if (!user) return;

    const confirmRemove = window.confirm("Remove this book from your list?");
    if (!confirmRemove) return;

    const { error } = await supabase
      .from("reading_list")
      .delete()
      .eq("user_id", user.id)
      .eq("gutenberg_id", bookId);

    if (!error) {
      setBooks((prev) => prev.filter((b) => b.gutenberg_id !== bookId));
      setSelectedBook(null);
      setSelectedStats(null);
    } else {
      console.error("Error removing book:", error);
    }
  };

  if (loading)
    return <p className="reading-status">Loading your reading list…</p>;

  if (books.length === 0) {
    return (
      <div className="reading-list-page">
        <h1>Your Reading List</h1>
        <p className="reading-status">
          Nothing saved yet. Head to <Link to="/">Home</Link> and add a book to
          get started.
        </p>
      </div>
    );
  }

  return (
    <div className="reading-list-page">
      <h1>Your Reading List</h1>

      <div className="reading-grid">
        {books.map((book) => (
          <div
            key={book.gutenberg_id}
            className="reading-card"
            onClick={() => handleSelectBook(book)}
          >
            <div className="reading-cover">
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} />
              ) : (
                <span>No cover</span>
              )}
            </div>
            <div className="reading-title">{book.title}</div>
            <div className="reading-author">{book.authors}</div>
          </div>
        ))}
      </div>

      {selectedBook && (
        <div
          className="rl-modal-backdrop"
          onClick={() => setSelectedBook(null)}
        >
          <div className="rl-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="rl-modal-close"
              onClick={() => setSelectedBook(null)}
            >
              ✕
            </button>

            <div className="rl-modal-body">
              <div className="rl-modal-left">
                <div className="rl-modal-cover">
                  {selectedBook.cover_url ? (
                    <img
                      src={selectedBook.cover_url}
                      alt={selectedBook.title}
                    />
                  ) : (
                    <span>No Cover Available</span>
                  )}
                </div>
              </div>

              <div className="rl-modal-right">
                <h2 className="rl-modal-title">{selectedBook.title}</h2>
                <p className="rl-modal-author">{selectedBook.authors}</p>
                <p className="rl-modal-lang">
                  Language: {(selectedBook.languages ?? "en").toUpperCase()}
                </p>

                <div className="rl-modal-description">
                  {selectedBook.description ? (
                    selectedBook.description
                  ) : (
                    <span className="rl-no-desc">
                      This is an automated placeholder summary. Open the reader
                      to view full contents, notes, and translated vocabulary
                      controls for this edition.
                    </span>
                  )}
                </div>

                <div className="rl-modal-stats">
                  {loadingStats ? (
                    <p className="rl-stats-loading">Loading stats…</p>
                  ) : (
                    <div className="rl-stats-row">
                      <div className="rl-stat-pill">
                        <strong>{selectedStats?.savedWordsCount ?? 0}</strong>{" "}
                        saved words
                      </div>
                      <div className="rl-stat-pill">
                        <strong>{selectedStats?.progressPercent ?? 0}%</strong>{" "}
                        completion progress
                      </div>
                    </div>
                  )}
                </div>

                <div className="rl-modal-actions">
                  <button
                    className="rl-btn rl-btn-remove"
                    onClick={(e) =>
                      handleRemoveBook(e, selectedBook.gutenberg_id)
                    }
                  >
                    Remove from Reading List
                  </button>
                  <button
                    className="rl-btn rl-btn-read"
                    onClick={() =>
                      navigate(`/read/${selectedBook.gutenberg_id}`)
                    }
                  >
                    Read
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
