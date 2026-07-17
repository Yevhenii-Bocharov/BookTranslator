import { useEffect, useRef, useState } from "react";
import ePub from "epubjs";
import type { Book, Rendition, Contents, Location } from "epubjs";
import { translateWord } from "../../funcs";
import WordTranslationPopup from "../WordTranslationPopup/WordTranslationPopup";
import "./EpubReader.css";

type PopupState = {
  word: string;
  sentence: string;
  translation: string | null;
  loading: boolean;
  position: { x: number; y: number };
};

type Props = {
  fileBuffer: ArrayBuffer;
  sourceLang: string;
  targetLang: string;
  savedWords: Set<string>;
  onToggleSaveWord: (word: string, translation: string, sentence: string) => void;
};

// Picks out the sentence around `word` inside a paragraph's text, falling
// back to a trimmed slice of the paragraph if sentence splitting doesn't
// find a clean match (e.g. abbreviations, dialogue punctuation).
function findSentenceInParagraph(paragraphText: string, word: string): string {
  const sentences = paragraphText.split(/(?<=[.!?])\s+/);
  const match = sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()));
  if (match && match.trim().length > 0) return match.trim();
  return paragraphText.trim().slice(0, 240);
}

// Walks the rendered chapter's text nodes and wraps each word in a
// clickable span, without touching images or other markup. Runs once per
// section (epub.js calls the content hook again each time a new spine item
// is rendered), guarded by a data attribute so it never double-wraps.
function wrapWordsInDocument(doc: Document) {
  const body = doc.body;
  if (!body || body.dataset.wordsWrapped === "true") return;
  body.dataset.wordsWrapped = "true";

  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "TITLE"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const text = textNode.textContent ?? "";
    const frag = doc.createDocumentFragment();
    text.split(/(\s+)/).forEach((part) => {
      if (part === "") return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(doc.createTextNode(part));
        return;
      }
      const span = doc.createElement("span");
      span.className = "epub-word";
      span.textContent = part;
      frag.appendChild(span);
    });
    textNode.parentNode?.replaceChild(frag, textNode);
  });
}

export default function EpubReader({
  fileBuffer,
  sourceLang,
  targetLang,
  savedWords,
  onToggleSaveWord,
}: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [pageLabel, setPageLabel] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!viewerRef.current) return;

    const book: Book = ePub(fileBuffer);
    const rendition = book.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "auto",
    });
    renditionRef.current = rendition;

    rendition.themes.default({
      body: {
        background: "#ffffff !important",
        color: "#1a1a1a !important",
        padding: "0 32px !important",
        "font-family": "Georgia, 'Times New Roman', serif !important",
        "line-height": "1.6 !important",
      },
      img: {
        "max-width": "100% !important",
        height: "auto !important",
      },
      ".epub-word": {
        cursor: "pointer",
      },
      ".epub-word:hover": {
        background: "rgba(255, 200, 80, 0.35)",
      },
    });

    rendition.hooks.content.register((contents: Contents) => {
      const doc = contents.document;
      wrapWordsInDocument(doc);

      doc.body.addEventListener("click", (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains("epub-word")) return;

        const rawWord = target.textContent ?? "";
        const clean = rawWord.replace(/[^\p{L}'-]/gu, "");
        if (!clean) return;

        const paragraph = target.closest("p, li, blockquote, div") as HTMLElement | null;
        const sentence = paragraph
          ? findSentenceInParagraph(paragraph.textContent ?? "", clean)
          : rawWord;

        const iframe = doc.defaultView?.frameElement as HTMLIFrameElement | null;
        const wordRect = target.getBoundingClientRect();
        const frameRect = iframe?.getBoundingClientRect();
        const position = {
          x: (frameRect?.left ?? 0) + wordRect.left,
          y: (frameRect?.top ?? 0) + wordRect.bottom + 8,
        };

        setPopup({ word: clean, sentence, translation: null, loading: true, position });

        translateWord(clean, sourceLang, targetLang)
          .then((translation) => {
            setPopup((prev) =>
              prev && prev.word === clean ? { ...prev, translation, loading: false } : prev
            );
          })
          .catch(() => {
            setPopup((prev) =>
              prev && prev.word === clean
                ? { ...prev, translation: "Translation unavailable", loading: false }
                : prev
            );
          });
      });
    });

    rendition.on("relocated", (location: Location) => {
      if (location?.start?.displayed) {
        setPageLabel(`Page ${location.start.displayed.page} of ${location.start.displayed.total}`);
      }
    });

    rendition.display().then(() => setReady(true));

    return () => {
      rendition.destroy();
      book.destroy();
    };
    // fileBuffer identity is stable for the lifetime of a given book, and
    // sourceLang/targetLang changes shouldn't force a full re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileBuffer]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") renditionRef.current?.next();
      if (e.key === "ArrowLeft") renditionRef.current?.prev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="epub-reader">
      <div className="epub-viewer-wrap">
        <button
          className="epub-nav epub-nav-prev"
          onClick={() => renditionRef.current?.prev()}
          aria-label="Previous page"
        >
          ‹
        </button>
        <div className="epub-viewer" ref={viewerRef} />
        <button
          className="epub-nav epub-nav-next"
          onClick={() => renditionRef.current?.next()}
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      {!ready && <p className="epub-loading">Rendering book…</p>}
      {pageLabel && <p className="epub-page-label">{pageLabel}</p>}

      {popup && (
        <WordTranslationPopup
          word={popup.word}
          translation={popup.translation}
          loading={popup.loading}
          position={popup.position}
          onClose={() => setPopup(null)}
          onToggleSave={() => onToggleSaveWord(popup.word, popup.translation ?? "", popup.sentence)}
          saved={savedWords.has(popup.word.toLowerCase())}
        />
      )}
    </div>
  );
}
