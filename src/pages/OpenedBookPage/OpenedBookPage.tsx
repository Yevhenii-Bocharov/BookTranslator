import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import type { Book } from "../../types/book";
import "./OpenedBookPage.css";

const OpenedBookPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBookDetails = async () => {
      if (!bookId) return;
      try {
        const { data, error } = await supabase
          .from("books")
          .select("*")
          .eq("id", bookId)
          .single();

        if (error) throw error;
        setBook(data);
      } catch (err: any) {
        console.error("Error fetching reader details:", err);
        setError("Failed to fetch the metadata of this document.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookDetails();
  }, [bookId]);

  const handleUpdateProgress = async (newPage: number) => {
    if (!book) return;
    try {
      const { error: patchError } = await supabase
        .from("books")
        .update({ current_page: newPage })
        .eq("id", book.id);

      if (patchError) throw patchError;
      setBook((prev) => (prev ? { ...prev, current_page: newPage } : null));
    } catch (err) {
      console.error("Could not commit tracking progress:", err);
    }
  };

  if (loading) {
    return (
      <div className="reader-status-screen">
        <div className="spinner"></div>
        <p>Opening document engine...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="reader-status-screen error-box">
        <h3>Oops! Something went wrong</h3>
        <p>{error || "This book record is missing from your database."}</p>
        <button
          onClick={() => navigate("/reading-list")}
          className="fallback-btn"
        >
          Back to Library
        </button>
      </div>
    );
  }

  const getGutenbergSrc = () => {
    if (book.file_url) return book.file_url;
    return `https://www.gutenberg.org/files/${book.gutenberg_id}/${book.gutenberg_id}-h/${book.gutenberg_id}-h.htm`;
  };

  return (
    <div className="opened-book-layout">
      <header className="reader-navbar">
        <button
          onClick={() => navigate("/reading-list")}
          className="btn-exit-reader"
        >
          ← Exit Reader
        </button>
        <div className="reader-meta">
          <h2 className="reader-title">{book.title}</h2>
          <span className="reader-author">by {book.author || "Unknown"}</span>
        </div>
        <div className="reader-page-controls">
          <label htmlFor="current-pg" className="control-label">
            Current Page Tracker:
          </label>
          <input
            id="current-pg"
            type="number"
            min={1}
            value={book.current_page}
            onChange={(e) =>
              handleUpdateProgress(Math.max(1, parseInt(e.target.value) || 1))
            }
            className="input-page-tracker"
          />
        </div>
      </header>

      <main className="reader-viewport-frame">
        {book.file_type === "pdf" && book.file_data ? (
          <iframe
            src={`${book.file_data}#page=${book.current_page}`}
            className="reader-frame"
            title={book.title}
            frameBorder="0"
          />
        ) : book.file_type === "gutenberg_text" ? (
          <iframe
            src={getGutenbergSrc()}
            className="reader-frame html-mode"
            title={book.title}
            frameBorder="0"
          />
        ) : (
          <div className="fallback-epub-interface">
            <div className="unsupported-box">
              <h3>EPUB Viewer Active</h3>
              <p>
                EPUB documents are dynamically stored on your account database!
                To preview reflowable structures natively, we suggest exporting
                your asset to PDF format, or accessing the document directly via
                our reader sync system.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Exported as DEFAULT so App.tsx can import it exactly as is!
export default OpenedBookPage;
