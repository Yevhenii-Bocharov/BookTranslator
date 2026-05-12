import { dbPromise } from "./db";
import { getPdfThumbnail } from "./pdfUtils";

export async function saveBook(file: File) {
  const db = await dbPromise;
  let thumbnail: string | undefined = undefined;

  try {
    thumbnail = await getPdfThumbnail(file);
  } catch (error) {
    console.warn("Saving book without thumbnail due to error:", error);
  }

  const book = {
    id: crypto.randomUUID(),
    name: file.name,
    file: file,
    thumbnail: thumbnail,
  };

  await db.put("books", book);
  console.log("5. Book entry committed to IndexedDB");
}

export async function getBooks() {
  const db = await dbPromise;
  return await db.getAll("books");
}

export async function getBook(id: string) {
  const db = await dbPromise;
  return await db.get("books", id);
}

export async function deleteBook(id: string) {
  const db = await dbPromise;
  await db.delete("books", id);
}

export async function translateWord(
  word: string,
  LanguageToTranslateFrom: string,
  LanguageToTranslateTo: string
): Promise<string> {
  const params = new URLSearchParams({
    q: word,
    langpair: `${LanguageToTranslateFrom}|${LanguageToTranslateTo}`,
  });

  const response = await fetch(
    `https://api.mymemory.translated.net/get?${params}`,
  );
  if (!response.ok) throw new Error(`Translation error: ${response.status}`);

  const data = await response.json();
  return data.responseData.translatedText;
}
