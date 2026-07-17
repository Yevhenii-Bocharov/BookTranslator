import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ePub, { Book, Rendition, Contents } from "epubjs";
import {
  fetchBook,
  fetchBookText,
  fetchBookFile,
  plainTextUrl,
  epubUrl,
  type GutenbergBook,
} from "../../lib/gutendex";
import { translateWord } from "../../funcs";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import "./GutenbergReaderPage.css";

type ViewMode = "epub" | "text";
type ThemeMode = "light" | "sepia" | "dark";
type FontStyle = "serif" | "sans" | "mono";

type PopupState = {
  word: string;
  sentence: string;
  translation: string | null;
  loading: boolean;
  position: { x: number; y: number };
};

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

const THEME_MAP = {
  light: { bg: "#fcfcfc", fg: "#111827" },
  sepia: { bg: "#fbf0db", fg: "#433422" },
  dark: { bg: "#0f141c", fg: "#e2e8f0" },
};

const FONT_MAP = {
  serif: '"Georgia", "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"SFMono-Regular", Consolas, Menlo, monospace',
};

// Supported language options
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

export default function GutenbergReaderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { profile } = useSettings();

  const [book, setBook] = useState<GutenbergBook | null>(null);
  const [mode, setMode] = useState<ViewMode>("epub");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Appearance Settings
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [fontSize, setFontSize] = useState<number>(18);
  const [fontFamily, setFontFamily] = useState<FontStyle>("serif");
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dynamic Translation Languages
  const [sourceLang, setSourceLang] = useState<string>("en");
  const [targetLang, setTargetLang] = useState<string>("fr");

  // Book Buffers
  const [fullText, setFullText] = useState<string | null>(null);
  const [visibleChars, setVisibleChars] = useState(6000);
  const [epubBuffer, setEpubBuffer] = useState<ArrayBuffer | null>(null);
  const [epubLoading, setEpubLoading] = useState(false);
  const [epubError, setEpubError] = useState<string | null>(null);

  // Saved word collections
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [recentSaved, setRecentSaved] = useState<
    Array<{ word: string; translation: string }>
  >([]);
  const [popup, setPopup] = useState<PopupState | null>(null);

  const viewerRef = useRef<HTMLDivElement>(null);
  const epubBookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  // Sync initial metadata language settings
  useEffect(() => {
    if (book) {
      const detected = book.languages[0] || "en";
      setSourceLang(detected);

      const appLang = profile?.app_language || "fr";
      // Ensure source is never identical to target automatically on load
      setTargetLang(
        detected === appLang ? (detected === "en" ? "fr" : "en") : appLang,
      );
    }
  }, [book, profile]);

  // Fetch book metadata
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchBook(Number(id))
      .then((b) => {
        setBook(b);
        const hasEpub = !!epubUrl(b);
        const hasText = !!plainTextUrl(b);
        if (!hasEpub && !hasText) {
          setError("No readable online formats available for this book.");
        } else {
          setMode(hasEpub ? "epub" : "text");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Could not locate the requested book.");
        setLoading(false);
      });
  }, [id]);

  // Read raw txt fallback file
  useEffect(() => {
    if (mode !== "text" || !book || fullText !== null) return;
    const url = plainTextUrl(book);
    if (!url) return;
    fetchBookText(url)
      .then((raw) => setFullText(stripBoilerplate(raw)))
      .catch(() => setError("Failed to retrieve the plain text file."));
  }, [mode, book, fullText]);

  // Fetch epub buffer file
  useEffect(() => {
    if (mode !== "epub" || !book || epubBuffer !== null) return;
    const url = epubUrl(book);
    if (!url) {
      setEpubError("No EPUB translation stream found.");
      return;
    }
    setEpubLoading(true);
    setEpubError(null);
    fetchBookFile(url)
      .then((buf) => setEpubBuffer(buf))
      .catch(() =>
        setEpubError("EPUB asset stream failed. Please try Plain Text Mode."),
      )
      .finally(() => setEpubLoading(false));
  }, [mode, book, epubBuffer]);

  // Sync persistent saved vocab words
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

  // 1. Initialize Book and Rendition
  useEffect(() => {
    if (mode !== "epub" || !epubBuffer || !viewerRef.current) return;

    viewerRef.current.innerHTML = "";

    const bookInstance = ePub(epubBuffer);
    epubBookRef.current = bookInstance;

const rendition = bookInstance.renderTo(viewerRef.current, {
  width: "100%",
  height: "100%",
  spread: "none",
  flow: "paginated", // Changed from scrolled-doc to prevent overflow
});
    renditionRef.current = rendition;

    rendition.display();

    return () => {
      bookInstance.destroy();
    };
  }, [mode, epubBuffer]);

  // 2. Inject CSS Styles Dynamic properties down into iframe
  useEffect(() => {
    if (!renditionRef.current) return;
    const rendition = renditionRef.current;
    const themeStyles = THEME_MAP[theme];
    const computedFont = FONT_MAP[fontFamily];

    const applyStyles = (contents: Contents) => {
      contents.addStylesheetRules({
        body: {
          "background-color": `${themeStyles.bg} !important`,
          color: `${themeStyles.fg} !important`,
          "font-family": `${computedFont} !important`,
          "font-size": `${fontSize}px !important`,
          "line-height": `${lineHeight} !important`,
          padding: "0 40px !important",
          transition: "background-color 0.2s ease, color 0.2s ease",
        },
        "p, span, li, h1, h2, h3, h4, h5, h6, div, section": {
          color: `${themeStyles.fg} !important`,
          "font-family": `${computedFont} !important`,
        },
        /* Custom highlight rules injected directly inside the epub document */
        ".highlight-word-hover": {
          "background-color": "rgba(59, 130, 246, 0.25) !important",
          "border-radius": "3px !important",
          cursor: "pointer !important",
        },
      });
    };

    rendition.getContents().forEach(applyStyles);
    rendition.hooks.content.register(applyStyles);
  }, [theme, fontSize, fontFamily, lineHeight, epubBuffer, mode]);

  // 3. Iframe mouse-tracking word hover-and-point logic
  useEffect(() => {
    if (!renditionRef.current) return;
    const rendition = renditionRef.current;
    let lastHighlightedNode: Text | null = null;
    let wrapperSpan: HTMLSpanElement | null = null;

    const clearActiveHighlight = () => {
      if (wrapperSpan && wrapperSpan.parentNode) {
        const parent = wrapperSpan.parentNode;
        while (wrapperSpan.firstChild) {
          parent.insertBefore(wrapperSpan.firstChild, wrapperSpan);
        }
        parent.removeChild(wrapperSpan);
        parent.normalize(); // merge text nodes back cleanly
        wrapperSpan = null;
        lastHighlightedNode = null;
      }
    };

    const handleIframeMouseMove = (event: MouseEvent) => {
      const doc = event.currentTarget as Document;

      // Cancel tracking if user is actively highlighting text ranges manually
      const selection = doc.defaultView?.getSelection();
      if (selection && selection.toString().trim().length > 0) return;

      let range: Range | null = null;
      if ((doc as any).caretPositionFromPoint) {
        const pos = (doc as any).caretPositionFromPoint(
          event.clientX,
          event.clientY,
        );
        if (pos) {
          range = doc.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      } else if (doc.caretRangeFromPoint) {
        range = doc.caretRangeFromPoint(event.clientX, event.clientY);
      }

      if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer as Text;
        const offset = range.startOffset;
        const text = textNode.textContent || "";

        // Find precise word boundaries
        const words = text.split(/(\s+)/);
        let curPos = 0;
        let targetWord = "";
        let wordStartIdx = 0;
        let wordEndIdx = 0;

        for (const token of words) {
          if (curPos <= offset && offset <= curPos + token.length) {
            targetWord = token.replace(/[^\p{L}'-]/gu, "");
            wordStartIdx = curPos;
            wordEndIdx = curPos + token.length;
            break;
          }
          curPos += token.length;
        }

        if (targetWord && textNode !== lastHighlightedNode) {
          clearActiveHighlight();
          lastHighlightedNode = textNode;

          // Isolate targeted word and wrap it with dynamic highlight tag
          const splitRange = doc.createRange();
          splitRange.setStart(textNode, wordStartIdx);
          splitRange.setEnd(textNode, wordEndIdx);

          wrapperSpan = doc.createElement("span");
          wrapperSpan.className = "highlight-word-hover";

          try {
            splitRange.surroundContents(wrapperSpan);
          } catch (e) {
            // Avoid failing if splitting node structures intersects nested markup tags
          }
        }
      } else {
        clearActiveHighlight();
      }
    };

    // If word is clicked inside the iframe
    const handleIframeClick = (event: MouseEvent) => {
      if (wrapperSpan) {
        const targetWordText = wrapperSpan.textContent || "";
        const parentParagraphText =
          wrapperSpan.parentElement?.textContent || "";
        const rect = wrapperSpan.getBoundingClientRect();

        triggerTranslation(
          targetWordText,
          parentParagraphText.trim(),
          event.clientX,
          rect.bottom + window.scrollY,
        );
      }
    };

    const attachIframeMovementListeners = (contents: Contents) => {
      const doc = contents.document;
      doc.body.addEventListener("mousemove", handleIframeMouseMove);
      doc.body.addEventListener("click", handleIframeClick);
      doc.body.addEventListener("mouseleave", clearActiveHighlight);
    };

    rendition.getContents().forEach(attachIframeMovementListeners);
    rendition.hooks.content.register(attachIframeMovementListeners);

    return () => {
      if (renditionRef.current) {
        renditionRef.current.off("selected", () => {});
      }
    };
  }, [epubBuffer, mode, sourceLang, targetLang]);

  // Master translation launcher
  const triggerTranslation = async (
    word: string,
    contextSentence: string,
    xPos: number,
    yPos: number,
  ) => {
    const cleanWord = word.replace(/[^\p{L}'-]/gu, "");
    if (!cleanWord) return;

    setPopup({
      word: cleanWord,
      sentence: contextSentence,
      translation: null,
      loading: true,
      position: { x: Math.min(xPos, window.innerWidth - 340), y: yPos + 12 },
    });

    try {
      const translation = await translateWord(
        cleanWord,
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
          ? { ...prev, translation: "Unavailable", loading: false }
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

  const nextPage = () => {
    if (renditionRef.current) renditionRef.current.next();
  };

  const prevPage = () => {
    if (renditionRef.current) renditionRef.current.prev();
  };

  const textParagraphs = useMemo(() => {
    if (!fullText) return [];
    return fullText.slice(0, visibleChars).split(/\n\s*\n/);
  }, [fullText, visibleChars]);

  const progressPercentage = useMemo(() => {
    if (!fullText) return 0;
    return Math.round((visibleChars / fullText.length) * 100);
  }, [fullText, visibleChars]);

  const speakWord = (word: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = sourceLang;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (loading)
    return (
      <div className="reader-loading-screen">
        Preparing dynamic workspace translation layers…
      </div>
    );
  if (error) {
    return (
      <div className="reader-error-screen">
        <p>{error}</p>
        <Link to="/" className="btn-back">
          Return to Library
        </Link>
      </div>
    );
  }
  if (!book) return null;

  const hasEpub = !!epubUrl(book);
  const hasText = !!plainTextUrl(book);
  let charIndexOffset = 0;

  return (
    <div
      className={`book-translator-layout theme-${theme}`}
      style={{ "--reader-font-size": `${fontSize}px` } as React.CSSProperties}
    >
      {/* Top Header Navigation */}
      <header className="translator-header">
        <div className="header-left">
          <Link to="/" className="btn-icon" title="Return to Library">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="book-meta-nav">
            <span className="brand">Book Translator</span>
            <span className="divider">/</span>
            <span className="nav-book-title">{book.title}</span>
          </div>
        </div>

        {/* Real-time Dynamic Translation Language Selectors */}
        <div className="header-center">
          <div className="header-lang-selector-group">
            <div className="select-wrapper">
              <label>Read</label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <svg
              className="connector-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>

            <div className="select-wrapper">
              <label>Translate</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="header-right">
          <button
            className={`btn-icon ${sidebarOpen ? "active" : ""}`}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Vocabulary sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5V4.5z" />
            </svg>
          </button>
          <button
            className={`btn-icon ${showSettings ? "active" : ""}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Format Styles"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {showSettings && (
            <div className="appearance-dropdown">
              <div className="dropdown-section">
                <h4>Appearance</h4>
                <div className="theme-selectors">
                  <button
                    className={`theme-btn light ${theme === "light" ? "active" : ""}`}
                    onClick={() => setTheme("light")}
                  >
                    Light
                  </button>
                  <button
                    className={`theme-btn sepia ${theme === "sepia" ? "active" : ""}`}
                    onClick={() => setTheme("sepia")}
                  >
                    Sepia
                  </button>
                  <button
                    className={`theme-btn dark ${theme === "dark" ? "active" : ""}`}
                    onClick={() => setTheme("dark")}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div className="dropdown-section">
                <h4>Font Size ({fontSize}px)</h4>
                <div className="slider-group">
                  <button
                    className="stepper-btn"
                    onClick={() => setFontSize(Math.max(14, fontSize - 1))}
                  >
                    A-
                  </button>
                  <input
                    type="range"
                    min="14"
                    max="28"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                  <button
                    className="stepper-btn"
                    onClick={() => setFontSize(Math.min(28, fontSize + 1))}
                  >
                    A+
                  </button>
                </div>
              </div>

              <div className="dropdown-section">
                <h4>Typography</h4>
                <div className="font-selectors">
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

              <div className="dropdown-section">
                <h4>Line Spacing</h4>
                <div className="spacing-selectors">
                  <button
                    className={lineHeight === 1.5 ? "active" : ""}
                    onClick={() => setLineHeight(1.5)}
                  >
                    1.5x
                  </button>
                  <button
                    className={lineHeight === 1.8 ? "active" : ""}
                    onClick={() => setLineHeight(1.8)}
                  >
                    1.8x
                  </button>
                  <button
                    className={lineHeight === 2.2 ? "active" : ""}
                    onClick={() => setLineHeight(2.2)}
                  >
                    2.2x
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="workspace-container">
        <main
          className={`reading-pane ${fontFamily}-font`}
          style={{ lineHeight }}
        >
          <div className="reading-canvas">
            {hasEpub && hasText && (
              <div className="inline-mode-tabs">
                <button
                  className={mode === "epub" ? "active" : ""}
                  onClick={() => setMode("epub")}
                >
                  EPUB Mode
                </button>
                <button
                  className={mode === "text" ? "active" : ""}
                  onClick={() => setMode("text")}
                >
                  Plain Text Mode
                </button>
              </div>
            )}

            {mode === "epub" && (
              <div className="epub-stage">
                {epubLoading && (
                  <div className="reader-loader">
                    Importing typography framework...
                  </div>
                )}
                {epubError && (
                  <div className="reader-stage-error">{epubError}</div>
                )}

                {/* Centered sheet wrapper mimicking your reference image */}
                <div className="epub-page-sheet">
                  <div ref={viewerRef} className="epub-internal-viewer" />
                </div>
              </div>
            )}

            {mode === "text" && (
              <article className="plain-text-reader">
                {fullText === null && !error && (
                  <div className="reader-loader">
                    Importing raw typography files...
                  </div>
                )}

                {textParagraphs.map((paragraph, pIdx) => {
                  const tokens = paragraph.split(/(\s+)/);
                  return (
                    <p key={pIdx} className="paragraph-block">
                      {tokens.map((token, tIdx) => {
                        charIndexOffset += token.length;

                        if (/^\s+$/.test(token) || token === "") {
                          return <span key={tIdx}>{token}</span>;
                        }

                        const clean = token
                          .replace(/[^\p{L}'-]/gu, "")
                          .toLowerCase();
                        const isSaved = savedWords.has(clean);

                        return (
                          <span
                            key={tIdx}
                            className={`reader-word-token ${isSaved ? "highlight-saved" : ""}`}
                            onClick={(e) =>
                              triggerTranslation(
                                token,
                                paragraph,
                                e.clientX,
                                e.clientY + window.scrollY,
                              )
                            }
                          >
                            {token}
                          </span>
                        );
                      })}
                    </p>
                  );
                })}

                {fullText && visibleChars < fullText.length && (
                  <button
                    className="reader-load-more"
                    onClick={() => setVisibleChars((v) => v + 6000)}
                  >
                    Load Next Page
                  </button>
                )}
              </article>
            )}
          </div>
        </main>

        {/* Collapsible Sidebar */}
        {sidebarOpen && (
          <aside className="study-sidebar">
            <div className="sidebar-section">
              <h3 className="section-title">Reading Insights</h3>
              <div className="stats-card">
                <div className="stats-metric">
                  <span className="value">{savedWords.size}</span>
                  <span className="label">Words Saved</span>
                </div>
                <div className="stats-metric">
                  <span className="value">85%</span>
                  <span className="label">Comprehension</span>
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <h3 className="section-title">Saved in Book</h3>
              {recentSaved.length === 0 ? (
                <div className="empty-history">
                  <p>
                    Move mouse pointer over unfamiliar words, then click to
                    query translations contextually.
                  </p>
                </div>
              ) : (
                <ul className="vocabulary-quicklist">
                  {recentSaved.map((item, idx) => (
                    <li key={idx} className="vocab-item">
                      <div className="vocab-meta">
                        <span className="native">{item.word}</span>
                        <span className="trans">{item.translation}</span>
                      </div>
                      <button
                        className="speak-btn"
                        onClick={() => speakWord(item.word)}
                      >
                        <svg
                          width="14"
                          height="14"
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
          </aside>
        )}
      </div>

      {/* Dynamic Word Translation Modal Card */}
      {popup && (
        <div
          className="context-translation-card"
          style={{ top: popup.position.y, left: popup.position.x }}
        >
          <div className="card-header">
            <span className="target-word">{popup.word}</span>
            <div className="action-buttons">
              <button
                className="speak-btn"
                onClick={() => speakWord(popup.word)}
                title="Listen"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
              <button className="close-btn" onClick={() => setPopup(null)}>
                ✕
              </button>
            </div>
          </div>

          <div className="card-body">
            {popup.loading ? (
              <div className="popup-loading">
                Retrieving translator dictionary definitions...
              </div>
            ) : (
              <>
                <div className="translation-main">
                  <span className="lang-code">{targetLang.toUpperCase()}</span>
                  <p className="translation-result">{popup.translation}</p>
                </div>

                <div className="context-quote">
                  <h5>Context</h5>
                  <p>"{popup.sentence}"</p>
                </div>
              </>
            )}
          </div>

          {user && !popup.loading && (
            <div className="card-footer">
              <button
                className={`btn-save-word ${savedWords.has(popup.word.toLowerCase()) ? "saved" : ""}`}
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

      {/* bottom Page Navigation & Metadata Footer */}
      <footer className="reader-footer-toolbar">
        <div className="footer-left">
          <button className="nav-btn" onClick={prevPage}>
            Previous
          </button>
        </div>
        <div className="footer-center">
          <span className="completion-stats">E-Reader Mode</span>
        </div>
        <div className="footer-right">
          <button className="nav-btn" onClick={nextPage}>
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}
