import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import type { Book } from "../types/book"; // Import from the dedicated types file

export function useReadingList() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
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
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBooks(data || []);
    } catch (err) {
      console.error("Error fetching reading list from database:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const addBook = async (bookData: Partial<Book>): Promise<Book | null> => {
    if (!user) {
      console.warn("User session not active.");
      return null;
    }
    try {
      const payload = {
        ...bookData,
        user_id: user.id,
        current_page: bookData.current_page || 1,
        total_pages: bookData.total_pages || 1,
      };

      const { data, error } = await supabase
        .from("books")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      setBooks((prev) => [data, ...prev]);
      return data;
    } catch (err) {
      console.error("Error executing addBook inside Supabase hook:", err);
      return null;
    }
  };

  const updateProgress = async (bookId: string, currentPage: number) => {
    try {
      const { error } = await supabase
        .from("books")
        .update({ current_page: currentPage })
        .eq("id", bookId);

      if (error) throw error;
      setBooks((prev) =>
        prev.map((b) =>
          b.id === bookId ? { ...b, current_page: currentPage } : b,
        ),
      );
    } catch (err) {
      console.error(
        "Error executing updateProgress inside database hook:",
        err,
      );
    }
  };

  const removeBook = async (bookId: string) => {
    try {
      const { error } = await supabase.from("books").delete().eq("id", bookId);

      if (error) throw error;
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
    } catch (err) {
      console.error("Error executing removeBook inside database hook:", err);
    }
  };

  return {
    books,
    loading,
    addBook,
    updateProgress,
    removeBook,
    refetch: fetchBooks,
  };
}
