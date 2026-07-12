import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchBook, plainTextUrl, type GutenbergBook } from "../../lib/gutendex";
import { translateWord } from "../../funcs";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import WordTranslationPopup from "../../components/WordTranslationPopup/WordTranslationPopup";
import "./GutenbergReaderPage.css";

const CHUNK_SIZE = 6000; // characters shown per "page" of the book

// Strips the Project Gutenberg boilerplate header/footer so reading starts
// at the actual text.
function stripBoilerplate(raw: string): string {
  const startMarker = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*/is;
  const endMarker = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*/is;
  let text = raw;
  const startMatch = text.match(startMarker);
  if (startMatch && startMatch.index !== undefined) {
    text = text.slice(startMatch.index + startMatch[0].length);
  }
  const endMatch = text.match(endMarker);
  if (endMatch && endMatch.index !== undefined) {
    text = text.slice(0, endMatch.index);
  }
  return text.trim();
}

function findSentence(text: string, wordIndex: number): string {
  const before = text.slice(Math.max(0, wordIndex - 300), wordIndex);
  const after = text.slice(wordIndex, wordIndex + 300);
  const startMatch = [...before.matchAll(/[.!?]\s/g)].pop();
  const start = startMatch ? Math.max(0, wordIndex - 300) + (startMatch.index ?? 0) + 2 : 0;
  const endMatch = after.match(/[.!?]/);
  const end = endMatch && endMatch.index !== undefined ? wordIndex + endMatch.index + 1 : text.length;
  return text.slice(start, end).trim();
}

type PopupState = {
  word: string;
  sentence: string;
  translation: string | null;
  loading: boolean;
  position: { x: number; y: number };
};

export default function GutenbergReaderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { profile } = useSettings();

  const [book, setBook] = useState<GutenbergBook | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);
  const [visibleChars, setVisibleChars] = useState(CHUNK_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [popup, setPopup] = useState<PopupState | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  const sourceLang = book?.languages[0] ?? "en";
  const targetLang = profile?.app_language ?? "en";

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchBook(Number(id))
      .then(async (b) => {
        setBook(b);
        const url = plainTextUrl(b);
        if (!url) {
          setError("This book doesn't have a plain-text version available to read online.");
          setLoading(false);
          return;
        }
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error();
          const raw = await res.text();
          setFullText(stripBoilerplate(raw));
        } catch {
          setError(
            "Couldn't load the book text (the source may not allow direct browser access). Try again later."
          );
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't find that book.");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("saved_words")
      .select("word")
      .eq("user_id", user.id)
      .eq("gutenberg_id", Number(id))
      .then(({ data }) => {
        if (data) setSavedWords(new Set(data.map((r) => r.word.toLowerCase())));
      });
  }, [user, id]);

  const visibleText = useMemo(
    () => (fullText ? fullText.slice(0, visibleChars) : ""),
    [fullText, visibleChars]
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const handleWordClick = async (e: React.MouseEvent, word: string, index: number) => {
    const clean = word.replace(/[^\p{L}'-]/gu, "");
    if (!clean) return;

    const sentence = findSentence(visibleText, index);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopup({
      word: clean,
      sentence,
      translation: null,
      loading: true,
      position: { x: rect.left, y: rect.bottom + 8 },
    });

    try {
      const translation = await translateWord(clean, sourceLang, targetLang);
      setPopup((prev) => (prev && prev.word === clean ? { ...prev, translation, loading: false } : prev));
    } catch {
      setPopup((prev) =>
        prev && prev.word === clean ? { ...prev, translation: "Translation unavailable", loading: false } : prev
      );
    }
  };

  const toggleSaveWord = async () => {
    if (!popup || !user || !id) return;
    const key = popup.word.toLowerCase();

    if (savedWords.has(key)) {
      await supabase
        .from("saved_words")
        .delete()
        .eq("user_id", user.id)
        .eq("gutenberg_id", Number(id))
        .ilike("word", popup.word);
      setSavedWords((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      await supabase.from("saved_words").insert({
        user_id: user.id,
        word: popup.word,
        translation: popup.translation ?? "",
        context_sentence: popup.sentence,
        source_lang: sourceLang,
        target_lang: targetLang,
        gutenberg_id: Number(id),
      });
      setSavedWords((prev) => new Set(prev).add(key));
    }
  };

  if (loading) return <p className="reader-status">Loading book…</p>;
  if (error)
    return (
      <p className="reader-status">
        {error} <Link to="/">Back to Home</Link>
      </p>
    );

  // Split on whitespace but keep the separators so layout/punctuation stays intact.
  const tokens = visibleText.split(/(\s+)/);
  let charIndex = 0;

  return (
    <div className="reader-page">
      {book && (
        <div className="reader-header">
          <h1>{book.title}</h1>
          <p>{book.authors.map((a) => a.name).join(", ")}</p>
        </div>
      )}

      <div className="reader-text" ref={containerRef}>
        {tokens.map((token, i) => {
          const start = charIndex;
          charIndex += token.length;
          if (/^\s+$/.test(token) || token === "") {
            return <span key={i}>{token}</span>;
          }
          return (
            <span
              key={i}
              className="reader-word"
              onClick={(e) => handleWordClick(e, token, start)}
            >
              {token}
            </span>
          );
        })}
      </div>

      {fullText && visibleChars < fullText.length && (
        <button className="reader-load-more" onClick={() => setVisibleChars((v) => v + CHUNK_SIZE)}>
          Load more
        </button>
      )}

      {popup && (
        <WordTranslationPopup
          word={popup.word}
          translation={popup.translation}
          loading={popup.loading}
          position={popup.position}
          onClose={() => setPopup(null)}
          onToggleSave={user ? toggleSaveWord : undefined}
          saved={savedWords.has(popup.word.toLowerCase())}
        />
      )}
    </div>
  );
}
