import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import "./ReadingListPage.css";

type SavedBook = {
  gutenberg_id: number;
  title: string;
  authors: string | null;
  cover_url: string | null;
  languages: string | null;
};

export default function ReadingListPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reading_list")
      .select("gutenberg_id, title, authors, cover_url, languages")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setBooks(data ?? []);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <p className="reading-status">Loading your reading list…</p>;

  if (books.length === 0) {
    return (
      <div className="reading-list-page">
        <h1>Your Reading List</h1>
        <p className="reading-status">
          Nothing saved yet. Head to <Link to="/">Home</Link> and add a book to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="reading-list-page">
      <h1>Your Reading List</h1>
      <div className="reading-grid">
        {books.map((book) => (
          <Link key={book.gutenberg_id} to={`/read/${book.gutenberg_id}`} className="reading-card">
            <div className="reading-cover">
              {book.cover_url ? <img src={book.cover_url} alt={book.title} /> : <span>No cover</span>}
            </div>
            <div className="reading-title">{book.title}</div>
            <div className="reading-author">{book.authors}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
