import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchBook,
  fetchBookText,
  plainTextUrl,
  type GutenbergBook,
} from "../../lib/gutendex";
import { translateWord } from "../../funcs";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import "./GutenbergReaderPage.css";

type ThemeMode = "light" | "sepia" | "dark" | "ocean" | "forest";
type FontStyle = "serif" | "sans" | "mono";

type PopupState = {
  word: string;
  sentence: string;
  translation: string | null;
  loading: boolean;
  position: { x: number; y: number };
};

type Page = string[];

const SETTINGS_STORAGE_KEY = "gutenberg_reader_settings";

interface ReaderSettings {
  theme: ThemeMode;
  fontSize: number;
  fontFamily: FontStyle;
  lineHeight: number;
  dualPage: boolean;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "dark",
  fontSize: 18,
  fontFamily: "serif",
  lineHeight: 1.75,
  dualPage: false,
};

function getStoredSettings(): ReaderSettings {
  try {
    const item = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (item) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(item) };
    }
  } catch (err) {
    console.warn("Failed to load reader settings from localStorage:", err);
  }
  return DEFAULT_SETTINGS;
}

function stripBoilerplate(raw: string): string {
  const startMarker =
    /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*/is;
  const endMarker =
    /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*/is;
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

const FONT_MAP: Record<FontStyle, string> = {
  serif: '"Source Serif 4", Georgia, "Times New Roman", serif',
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"SFMono-Regular", Consolas, Menlo, monospace',
};

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pl", name: "Polish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ru", name: "Russian" },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractSentence(paragraph: string, word: string): string {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const lower = word.toLowerCase();
  const found = sentences.find((s) => s.toLowerCase().includes(lower));
  return (found ?? paragraph).replace(/\s+/g, " ").trim();
}

export default function GutenbergReaderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { profile } = useSettings();

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const [book, setBook] = useState<GutenbergBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Appearance Options — initialized directly from localStorage
  const [theme, setTheme] = useState<ThemeMode>(
    () => getStoredSettings().theme,
  );
  const [fontSize, setFontSize] = useState<number>(
    () => getStoredSettings().fontSize,
  );
  const [fontFamily, setFontFamily] = useState<FontStyle>(
    () => getStoredSettings().fontFamily,
  );
  const [lineHeight, setLineHeight] = useState<number>(
    () => getStoredSettings().lineHeight,
  );
  const [dualPage, setDualPage] = useState<boolean>(
    () => getStoredSettings().dualPage,
  );

  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layout Boundaries
  const [pageIndex, setPageIndex] = useState(0);
  const [initialPageLoaded, setInitialPageLoaded] = useState(false);
  const [resizeTick, setResizeTick] = useState(0);

  // Translation configuration mappings
  const [sourceLang, setSourceLang] = useState<string>("en");
  const [targetLang, setTargetLang] = useState<string>("fr");

  // Local document cache
  const [fullText, setFullText] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [paginating, setPaginating] = useState(false);

  // Dictionary records state hooks
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [recentSaved, setRecentSaved] = useState<
    Array<{ word: string; translation: string }>
  >([]);
  const [popup, setPopup] = useState<PopupState | null>(null);

  // Persist settings whenever they change
  useEffect(() => {
    try {
      const settingsToSave: ReaderSettings = {
        theme,
        fontSize,
        fontFamily,
        lineHeight,
        dualPage,
      };
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settingsToSave),
      );
    } catch (err) {
      console.warn("Failed to persist reader settings to localStorage:", err);
    }
  }, [theme, fontSize, fontFamily, lineHeight, dualPage]);

  // Sync windowed context constraints for native screen triggers
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (err) {
        console.error("Error entering fullscreen mode:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    if (book) {
      const detected = book.languages[0] || "en";
      setSourceLang(detected);
      const appLang = profile?.app_language || "fr";
      setTargetLang(
        detected === appLang ? (detected === "en" ? "fr" : "en") : appLang,
      );
    }
  }, [book, profile]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchBook(Number(id))
      .then((b) => {
        setBook(b);
        if (!plainTextUrl(b)) {
          setError(
            "No readable plain-text edition is available for this book.",
          );
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Could not locate the requested book.");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!book || fullText !== null) return;
    const url = plainTextUrl(book);
    if (!url) return;
    fetchBookText(url)
      .then((raw) => setFullText(stripBoilerplate(raw)))
      .catch(() => setError("Failed to retrieve the plain text file."));
  }, [book, fullText]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("saved_words")
      .select("word, translation")
      .eq("user_id", user.id)
      .eq("gutenberg_id", Number(id))
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setSavedWords(new Set(data.map((r) => r.word.toLowerCase())));
          setRecentSaved(data.slice(0, 8));
        }
      });
  }, [user, id]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("reading_progress")
      .select("current_page")
      .eq("user_id", user.id)
      .eq("document_type", "gutenberg")
      .eq("document_id", String(id))
      .maybeSingle()
      .then(({ data, error }) => {
        if (data && !error) {
          setPageIndex(data.current_page);
        }
        setInitialPageLoaded(true);
      });
  }, [user, id]);

  const saveProgress = useCallback(
    async (targetPage: number) => {
      if (!user || !id || !initialPageLoaded) return;

      await supabase.from("reading_progress").upsert(
        {
          user_id: user.id,
          document_type: "gutenberg",
          document_id: String(id),
          current_page: targetPage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, document_type, document_id" },
      );
    },
    [user, id, initialPageLoaded],
  );

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setResizeTick((v) => v + 1), 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const paragraphs = useMemo(() => {
    if (!fullText) return [];
    return fullText
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
  }, [fullText]);

  useEffect(() => {
    if (!fullText || paragraphs.length === 0 || !measureRef.current) return;
    setPaginating(true);

    const timeoutId = setTimeout(() => {
      const measureEl = measureRef.current;
      if (!measureEl) return;

      const calculatedPages: Page[] = [];
      let currentChunk: string[] = [];
      const clientHeight = measureEl.clientHeight;

      const commitPage = () => {
        calculatedPages.push(currentChunk);
        currentChunk = [];
      };

      for (let p = 0; p < paragraphs.length; p++) {
        const paragraph = paragraphs[p];
        currentChunk.push(paragraph);

        measureEl.innerHTML = currentChunk
          .map((b) => `<p class="bt-paragraph">${escapeHtml(b)}</p>`)
          .join("");

        if (measureEl.scrollHeight > clientHeight + 1) {
          currentChunk.pop();
          commitPage();
          currentChunk.push(paragraph);
        }
      }

      if (currentChunk.length > 0) commitPage();
      if (calculatedPages.length === 0) calculatedPages.push([]);

      setPages(calculatedPages);
      setPaginating(false);
      setPageIndex((prev) =>
        Math.min(prev, Math.max(0, calculatedPages.length - 1)),
      );
    }, 120);

    return () => clearTimeout(timeoutId);
  }, [paragraphs, fontSize, lineHeight, fontFamily, dualPage, resizeTick]);

  useEffect(() => {
    setPageIndex(0);
    setInitialPageLoaded(false);
  }, [id]);

  const totalPages = pages.length;

  const goPrev = useCallback(() => {
    setPageIndex((i) => {
      const nextIdx = Math.max(0, i - (dualPage ? 2 : 1));
      saveProgress(nextIdx);
      return nextIdx;
    });
    setPopup(null);
  }, [dualPage, saveProgress]);

  const goNext = useCallback(() => {
    setPageIndex((i) => {
      const step = dualPage ? 2 : 1;
      const maxIdx = Math.max(0, totalPages - 1);
      const nextIdx = Math.min(maxIdx, i + step);
      saveProgress(nextIdx);
      return nextIdx;
    });
    setPopup(null);
  }, [dualPage, totalPages, saveProgress]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSettings || sidebarOpen) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, showSettings, sidebarOpen]);

  const triggerTranslation = async (
    word: string,
    contextParagraph: string,
    clientX: number,
    clientY: number,
  ) => {
    const cleanWord = word.replace(/[^\p{L}'-]/gu, "");
    if (!cleanWord) return;

    const CARD_WIDTH = 320;
    const CARD_HEIGHT = 230;
    const PADDING = 16;

    const clampedX = Math.max(
      PADDING,
      Math.min(clientX, window.innerWidth - CARD_WIDTH - PADDING),
    );
    const clampedY = Math.max(
      PADDING,
      Math.min(clientY + 12, window.innerHeight - CARD_HEIGHT - PADDING),
    );

    const sentence = extractSentence(contextParagraph, cleanWord);

    setPopup({
      word: cleanWord,
      sentence,
      translation: null,
      loading: true,
      position: { x: clampedX, y: clampedY },
    });

    try {
      const translation = await translateWord(
        cleanWord,
        sentence,
        sourceLang,
        targetLang,
      );

      setPopup((prev) =>
        prev && prev.word === cleanWord
          ? { ...prev, translation, loading: false }
          : prev,
      );
    } catch {
      setPopup((prev) =>
        prev && prev.word === cleanWord
          ? { ...prev, translation: "Translation unavailable", loading: false }
          : prev,
      );
    }
  };

  const toggleSaveWord = async (
    word: string,
    translation: string,
    sentence: string,
  ) => {
    if (!user || !id) return;
    const key = word.toLowerCase();

    if (savedWords.has(key)) {
      await supabase
        .from("saved_words")
        .delete()
        .eq("user_id", user.id)
        .eq("gutenberg_id", Number(id))
        .ilike("word", word);

      setSavedWords((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setRecentSaved((prev) =>
        prev.filter((i) => i.word.toLowerCase() !== key),
      );
    } else {
      await supabase.from("saved_words").insert({
        user_id: user.id,
        word,
        translation,
        context_sentence: sentence,
        source_lang: sourceLang,
        target_lang: targetLang,
        gutenberg_id: Number(id),
      });

      setSavedWords((prev) => new Set(prev).add(key));
      setRecentSaved((prev) => [{ word, translation }, ...prev.slice(0, 7)]);
    }
  };

  const speakWord = (word: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = sourceLang;
      window.speechSynthesis.speak(utterance);
    }
  };

  const renderPage = (page: Page | undefined, keyPrefix: string) => {
    if (!page) return <div className="bt-page-content bt-page-blank" />;
    return (
      <div className="bt-page-content">
        {page.map((paragraph, pIdx) => {
          const tokens = paragraph.split(/(\s+)/);
          return (
            <p key={`${keyPrefix}-${pIdx}`} className="bt-paragraph">
              {tokens.map((token, tIdx) => {
                if (/^\s+$/.test(token) || token === "") {
                  return <span key={tIdx}>{token}</span>;
                }
                const clean = token.replace(/[^\p{L}'-]/gu, "").toLowerCase();
                const isSaved = savedWords.has(clean);
                return (
                  <span
                    key={tIdx}
                    className={`bt-word ${isSaved ? "bt-word-saved" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerTranslation(
                        token,
                        paragraph,
                        e.clientX,
                        e.clientY,
                      );
                    }}
                  >
                    {token}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <div className="bt-loading-screen">Opening the book…</div>;
  }
  if (error) {
    return (
      <div className="bt-error-screen">
        <p>{error}</p>
        <Link to="/" className="bt-btn-back">
          Return to Library
        </Link>
      </div>
    );
  }
  if (!book) return null;

  const leftPage = pages[pageIndex];
  const rightPage = dualPage ? pages[pageIndex + 1] : undefined;
  const pageLabel = dualPage
    ? rightPage
      ? `Pages ${pageIndex + 1}–${pageIndex + 2} of ${totalPages}`
      : `Page ${pageIndex + 1} of ${totalPages}`
    : `Page ${pageIndex + 1} of ${totalPages}`;

  return (
    <div
      ref={containerRef}
      className={`bt-reader theme-${theme} ${fontFamily}-font`}
      style={
        {
          "--reader-font-size": `${fontSize}px`,
          "--reader-line-height": lineHeight,
          "--reader-font-family": FONT_MAP[fontFamily],
        } as React.CSSProperties
      }
    >
      {/* Topbar Navigation Controls */}
      <div className="bt-topbar">
        <Link
          to="/"
          className="bt-tb-btn bt-tb-library"
          title="Go to Home Library"
        >
          Library
        </Link>
        <span className="bt-tb-divider" />

        <button
          className="bt-tb-btn"
          onClick={goPrev}
          disabled={pageIndex <= 0}
        >
          Prev
        </button>

        <span className="bt-tb-page">
          {paginating ? "Paginating…" : pageLabel}
        </span>

        <button
          className="bt-tb-btn"
          onClick={goNext}
          disabled={pageIndex >= totalPages - 1}
        >
          Next
        </button>

        <span className="bt-tb-divider" />

        <button
          className={`bt-tb-btn bt-tb-icon ${dualPage ? "active" : ""}`}
          onClick={() => setDualPage((d) => !d)}
          title="Two-page spread"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3v18M4 5h6.5a2 2 0 0 1 2 2v13M20 5h-6.5a2 2 0 0 0-2 2v13" />
          </svg>
          Dual
        </button>

        <button
          className={`bt-tb-btn bt-tb-icon ${showSettings ? "active" : ""}`}
          onClick={() => setShowSettings((s) => !s)}
          title="Appearance"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <button
          className={`bt-tb-btn bt-tb-icon ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen((s) => !s)}
          title="Vocabulary"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5V4.5z" />
          </svg>
        </button>

        <button
          className={`bt-tb-btn bt-tb-fullscreen ${isFullscreen ? "active" : ""}`}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? "Windowed" : "Fullscreen"}
        </button>

        <span className="bt-tb-divider" />

        <div className="bt-tb-lang-group">
          <select
            className="bt-tb-select"
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            title="Book language"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="bt-tb-lang-arrow"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <select
            className="bt-tb-select"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            title="Translate into"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Settings Drawer */}
      {showSettings && (
        <div className="bt-settings-panel">
          <div className="bt-settings-section">
            <h4>Theme</h4>
            <div className="bt-settings-grid">
              <button
                className={theme === "light" ? "active" : ""}
                onClick={() => setTheme("light")}
              >
                Light
              </button>
              <button
                className={theme === "sepia" ? "active" : ""}
                onClick={() => setTheme("sepia")}
              >
                Sepia
              </button>
              <button
                className={theme === "dark" ? "active" : ""}
                onClick={() => setTheme("dark")}
              >
                Dark
              </button>
              <button
                className={theme === "ocean" ? "active" : ""}
                onClick={() => setTheme("ocean")}
              >
                Ocean
              </button>
              <button
                className={theme === "forest" ? "active" : ""}
                onClick={() => setTheme("forest")}
              >
                Forest
              </button>
            </div>
          </div>

          <div className="bt-settings-section">
            <h4>Font size ({fontSize}px)</h4>
            <div className="bt-settings-row">
              <button onClick={() => setFontSize((f) => Math.max(14, f - 1))}>
                A-
              </button>
              <input
                type="range"
                min="14"
                max="26"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <button onClick={() => setFontSize((f) => Math.min(26, f + 1))}>
                A+
              </button>
            </div>
          </div>

          <div className="bt-settings-section">
            <h4>Typeface</h4>
            <div className="bt-settings-row">
              <button
                className={fontFamily === "serif" ? "active" : ""}
                onClick={() => setFontFamily("serif")}
              >
                Serif
              </button>
              <button
                className={fontFamily === "sans" ? "active" : ""}
                onClick={() => setFontFamily("sans")}
              >
                Sans
              </button>
              <button
                className={fontFamily === "mono" ? "active" : ""}
                onClick={() => setFontFamily("mono")}
              >
                Mono
              </button>
            </div>
          </div>

          <div className="bt-settings-section">
            <h4>Line spacing</h4>
            <div className="bt-settings-row">
              {[1.5, 1.75, 2.1].map((lh) => (
                <button
                  key={lh}
                  className={lineHeight === lh ? "active" : ""}
                  onClick={() => setLineHeight(lh)}
                >
                  {lh}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Book Stage */}
      <div className="bt-stage" onClick={() => setPopup(null)}>
        <div
          className={`bt-book-wrapper ${dualPage ? "is-dual" : "is-single"}`}
        >
          <div className="bt-book-canvas">
            {paginating && totalPages === 0 ? (
              <div className="bt-page-content bt-page-loading">
                Laying out pages…
              </div>
            ) : (
              renderPage(leftPage, "l")
            )}
          </div>
          {dualPage && (
            <div className="bt-book-canvas">{renderPage(rightPage, "r")}</div>
          )}
        </div>
      </div>

      {/* Hidden Calibration Container */}
      <div className="bt-book-measure-envelope" aria-hidden="true">
        <div className="bt-book-canvas">
          <div className="bt-page-content" ref={measureRef} />
        </div>
      </div>

      {/* Popup Translation Card */}
      {popup && (
        <div
          className="bt-popup"
          style={{ top: popup.position.y, left: popup.position.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bt-popup-header">
            <span className="bt-popup-word">{popup.word}</span>
            <div className="bt-popup-actions">
              <button
                className="bt-popup-icon-btn"
                onClick={() => speakWord(popup.word)}
                title="Listen"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
              <button
                className="bt-popup-icon-btn"
                onClick={() => setPopup(null)}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="bt-popup-body">
            {popup.loading ? (
              <div className="bt-popup-loading">Translating…</div>
            ) : (
              <>
                <div className="bt-popup-translation">
                  <span className="bt-popup-lang-code">
                    {targetLang.toUpperCase()}
                  </span>
                  <p>{popup.translation}</p>
                </div>
                <div className="bt-popup-context">
                  <h5>Context</h5>
                  <p>&ldquo;{popup.sentence}&rdquo;</p>
                </div>
              </>
            )}
          </div>

          {user && !popup.loading && (
            <div className="bt-popup-footer">
              <button
                className={`bt-popup-save ${savedWords.has(popup.word.toLowerCase()) ? "saved" : ""}`}
                onClick={() =>
                  toggleSaveWord(
                    popup.word,
                    popup.translation ?? "",
                    popup.sentence,
                  )
                }
              >
                {savedWords.has(popup.word.toLowerCase())
                  ? "Saved to Vocabulary"
                  : "Add to Vocabulary"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Vocabulary Sidebar */}
      <aside className={`bt-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="bt-sidebar-inner">
          <div className="bt-sidebar-section">
            <h3>Reading Insights</h3>
            <div className="bt-stats-card">
              <div className="bt-stats-metric">
                <span className="value">{savedWords.size}</span>
                <span className="label">Words Saved</span>
              </div>
              <div className="bt-stats-metric">
                <span className="value">
                  {totalPages > 0
                    ? Math.round(((pageIndex + 1) / totalPages) * 100)
                    : 0}
                  %
                </span>
                <span className="label">Through Book</span>
              </div>
            </div>
          </div>

          <div className="bt-sidebar-section">
            <h3>Saved in Book</h3>
            {recentSaved.length === 0 ? (
              <div className="bt-empty-history">
                <p>
                  Click any word in the text to look up and save its
                  translation.
                </p>
              </div>
            ) : (
              <ul className="bt-vocab-list">
                {recentSaved.map((item, idx) => (
                  <li key={idx} className="bt-vocab-item">
                    <div className="bt-vocab-meta">
                      <span className="native">{item.word}</span>
                      <span className="trans">{item.translation}</span>
                    </div>
                    <button
                      className="bt-popup-icon-btn"
                      onClick={() => speakWord(item.word)}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
