import { supabase } from "./lib/supabaseClient";

/**
 * Fetches saved books for a given user from Supabase.
 */
export async function getBooks(userId: string) {
  const { data, error } = await supabase
    .from("saved_books") // Adjust table name if yours is different
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching books:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Saves or updates a book for a user in Supabase.
 */
export async function saveBook(bookData: Record<string, any>, userId: string) {
  const { data, error } = await supabase
    .from("saved_books") // Adjust table name if yours is different
    .upsert(
      {
        ...bookData,
        user_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id, user_id" },
    )
    .select();

  if (error) {
    console.error("Error saving book:", error);
    throw error;
  }

  return data;
}

/**
 * Deletes a book for the current user.
 */
export async function deleteBook(
  id: string | number,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_books") // Adjust table name if yours is different
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting book:", error);
    throw error;
  }
}

/**
 * Translates a single word via MyMemory API.
 */
export async function translateWord(
  word: string,
  sentence: string,
  LanguageToTranslateFrom: string,
  LanguageToTranslateTo: string,
): Promise<string> {
  const cleanWord = word.replace(/[^\p{L}'-]/gu, "").trim();
  if (!cleanWord) return "";

  const params = new URLSearchParams({
    q: cleanWord,
    langpair: `${LanguageToTranslateFrom.toLowerCase()}|${LanguageToTranslateTo.toLowerCase()}`,
  });

  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?${params}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.responseData?.translatedText;

    if (
      !resultText ||
      resultText.includes("INVALID SOURCE LANGUAGE") ||
      resultText.includes("IS AN INVALID") ||
      (resultText.toUpperCase() === cleanWord.toUpperCase() &&
        LanguageToTranslateFrom.toLowerCase() !==
          LanguageToTranslateTo.toLowerCase())
    ) {
      const fallbackParams = new URLSearchParams({
        q: cleanWord.toLowerCase(),
        langpair: `${LanguageToTranslateFrom.toLowerCase()}|${LanguageToTranslateTo.toLowerCase()}`,
      });
      const fallbackRes = await fetch(
        `https://api.mymemory.translated.net/get?${fallbackParams}`,
      );
      const fallbackData = await fallbackRes.json();
      const fallbackText = fallbackData.responseData?.translatedText;

      if (fallbackText && !fallbackText.includes("INVALID")) {
        return fallbackText;
      }
    }

    return resultText ?? cleanWord;
  } catch (err) {
    console.error("Translation API failure:", err);
    return cleanWord;
  }
}
