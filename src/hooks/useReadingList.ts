import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import type { GutenbergBook } from "../lib/gutendex";
import { authorNames, coverUrl } from "../lib/gutendex";

export function useReadingList() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("reading_list")
      .select("gutenberg_id")
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to load reading list", error);
    } else {
      setIds(new Set(data.map((row) => row.gutenberg_id)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isInList = useCallback((id: number) => ids.has(id), [ids]);

  const add = useCallback(
    async (book: GutenbergBook) => {
      if (!user) return { error: "You need to log in to save books." };
      const { error } = await supabase.from("reading_list").insert({
        user_id: user.id,
        gutenberg_id: book.id,
        title: book.title,
        authors: authorNames(book),
        cover_url: coverUrl(book),
        languages: book.languages.join(","),
      });
      if (error) return { error: error.message };
      setIds((prev) => new Set(prev).add(book.id));
      return { error: null };
    },
    [user]
  );

  const remove = useCallback(
    async (gutenbergId: number) => {
      if (!user) return { error: "You need to log in." };
      const { error } = await supabase
        .from("reading_list")
        .delete()
        .eq("user_id", user.id)
        .eq("gutenberg_id", gutenbergId);
      if (error) return { error: error.message };
      setIds((prev) => {
        const next = new Set(prev);
        next.delete(gutenbergId);
        return next;
      });
      return { error: null };
    },
    [user]
  );

  return { isInList, add, remove, loading, refresh };
}
