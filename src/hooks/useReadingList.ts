import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import type { GutenbergBook } from "../lib/gutendex";
import { authorNames, coverUrl } from "../lib/gutendex";

export type ReadingListItem = {
  gutenberg_id: number;
  title: string;
  authors: string | null;
  cover_url: string | null;
  languages: string | null;
  added_at: string;
};

type ActionResult = { error: string | null };

export function useReadingList() {
  const { user } = useAuth();
  const [books, setBooks] = useState<ReadingListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBooks = useCallback(async () => {
    if (!user) {
      setBooks([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("reading_list")
        .select("gutenberg_id, title, authors, cover_url, languages, added_at")
        .eq("user_id", user.id)
        .order("added_at", { ascending: false });

      if (error) throw error;
      setBooks(data ?? []);
    } catch (err) {
      console.error("Error fetching reading list:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const isInList = useCallback(
    (gutenbergId: number) => books.some((b) => b.gutenberg_id === gutenbergId),
    [books]
  );

  const add = async (book: GutenbergBook): Promise<ActionResult> => {
    if (!user) return { error: "You need to be logged in to save books." };

    const payload = {
      user_id: user.id,
      gutenberg_id: book.id,
      title: book.title,
      authors: authorNames(book),
      cover_url: coverUrl(book),
      languages: book.languages.join(", "),
    };

    // Optimistic update so the UI reacts instantly.
    setBooks((prev) => [
      { ...payload, added_at: new Date().toISOString() },
      ...prev,
    ]);

    const { error } = await supabase.from("reading_list").insert(payload);
    if (error) {
      console.error("Error adding book to reading list:", error);
      // Roll back the optimistic update.
      setBooks((prev) => prev.filter((b) => b.gutenberg_id !== book.id));
      return { error: error.message };
    }
    return { error: null };
  };

  const remove = async (gutenbergId: number): Promise<ActionResult> => {
    if (!user) return { error: "You need to be logged in." };

    const previous = books;
    setBooks((prev) => prev.filter((b) => b.gutenberg_id !== gutenbergId));

    const { error } = await supabase
      .from("reading_list")
      .delete()
      .eq("user_id", user.id)
      .eq("gutenberg_id", gutenbergId);

    if (error) {
      console.error("Error removing book from reading list:", error);
      setBooks(previous);
      return { error: error.message };
    }
    return { error: null };
  };

  return {
    books,
    loading,
    isInList,
    add,
    remove,
    refetch: fetchBooks,
  };
}
