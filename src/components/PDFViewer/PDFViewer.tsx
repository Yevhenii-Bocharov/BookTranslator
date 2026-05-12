import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import "./PDFViewer.css";
import LanguageSelector from "../LanguageSelector/LanguageSelector";
import WordTranslationPopup from "../WordTranslationPopup/WordTranslationPopup";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
  file: Blob;
  bookId: string;
};

async function translateWord(
  word: string,
  from: string,
  to: string,
): Promise<string> {
  const params = new URLSearchParams({ q: word, langpair: `${from}|${to}` });
  const res = await fetch(`https://api.mymemory.translated.net/get?${params}`);
  if (!res.ok) throw new Error(`Translation error: ${res.status}`);
  const data = await res.json();
  return data.responseData.translatedText;
}

async function renderPage(
  page: any,
  canvas: HTMLCanvasElement,
  textLayerDiv: HTMLDivElement,
  scale: number,
) {
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext("2d")!;

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  textLayerDiv.innerHTML = "";
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;

  const textContent = await page.getTextContent({ includeMarkedContent: true });

  // Build a flat list of character positions from all items
  type CharInfo = {
    char: string;
    x: number;
    y: number;
    width: number;
    fontSize: number;
    angle: number;
  };

  const allChars: CharInfo[] = [];

  textContent.items.forEach((item: any) => {
    if (!item.str || item.str.length === 0) return;

    const [a, b, c, d, e, f] = item.transform;
    const fontSize = Math.sqrt(b * b + d * d) * viewport.scale;
    const angle = Math.atan2(b, a);
    const baseX = e * viewport.scale;
    const baseY = viewport.height - f * viewport.scale;
    const totalWidth = item.width * viewport.scale;

    // If we have per-char data, use it directly
    if (item.chars && item.chars.length === item.str.length) {
      item.chars.forEach((ch: any, i: number) => {
        if (item.str[i] === " ") return;
        const [, , , , cx, cy] = ch.transform ?? item.transform;
        const charWidth = (ch.width ?? 0) * viewport.scale;
        allChars.push({
          char: item.str[i],
          x: cx * viewport.scale,
          y: viewport.height - cy * viewport.scale - fontSize * 0.75,
          width: charWidth,
          fontSize,
          angle,
        });
      });
    } else {
      // Fallback: distribute characters evenly across item width
      const charWidth = totalWidth / (item.str.length || 1);
      let offsetX = 0;
      for (let i = 0; i < item.str.length; i++) {
        const ch = item.str[i];
        if (ch === " ") { offsetX += charWidth; continue; }
        allChars.push({
          char: ch,
          x: baseX + offsetX,
          y: baseY - fontSize * 0.75,
          width: charWidth,
          fontSize,
          angle,
        });
        offsetX += charWidth;
      }
    }
  });

  // Group chars into words by proximity
  // Two chars belong to the same word if the gap between them is small
  // relative to the font size (gap > 0.3 * fontSize = new word)
  type WordGroup = CharInfo[];
  const wordGroups: WordGroup[] = [];
  let currentWord: WordGroup = [];

  allChars.forEach((ch, i) => {
    if (currentWord.length === 0) {
      currentWord.push(ch);
      return;
    }

    const prev = currentWord[currentWord.length - 1];
    const gap = ch.x - (prev.x + prev.width);
    const sameBaseline = Math.abs(ch.y - prev.y) < prev.fontSize * 0.5;
    const isWordBreak = !sameBaseline || gap > prev.fontSize * 0.3;

    if (isWordBreak) {
      wordGroups.push(currentWord);
      currentWord = [ch];
    } else {
      currentWord.push(ch);
    }
  });
  if (currentWord.length > 0) wordGroups.push(currentWord);

  // Render one span per word group
  wordGroups.forEach((group) => {
    if (group.length === 0) return;

    const first = group[0];
    const last = group[group.length - 1];
    const wordText = group.map((c) => c.char).join("");
    const wordWidth = (last.x + last.width) - first.x;

    const span = document.createElement("span");
    span.textContent = wordText;
    span.style.position = "absolute";
    span.style.left = `${first.x}px`;
    span.style.top = `${first.y}px`;
    span.style.fontSize = `${first.fontSize}px`;
    span.style.lineHeight = "1";
    span.style.whiteSpace = "pre";
    span.style.transformOrigin = "0 100%";
    span.style.letterSpacing = "0px";

    // Stretch the word to exactly cover its real pixel span
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d")!;
    measureCtx.font = `${first.fontSize}px serif`;
    const measured = measureCtx.measureText(wordText).width || 1;
    const scaleX = wordWidth / measured;
    span.style.transform = first.angle !== 0
      ? `rotate(${-first.angle}rad) scaleX(${scaleX})`
      : `scaleX(${scaleX})`;

    textLayerDiv.appendChild(span);
  });
}

function PageThumbnail({
  pdfDoc,
  pageNumber,
  isActive,
  onClick,
}: {
  pdfDoc: any;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      if (!canvasRef.current) return;
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 0.2 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvasContext: ctx, viewport });
    };
    draw();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber]);

  return (
    <div
      className={`thumbnail ${isActive ? "thumbnail-active" : ""}`}
      onClick={onClick}
    >
      <canvas ref={canvasRef} />
      <span className="thumbnail-num">{pageNumber}</span>
    </div>
  );
}

function PDFViewer({ file, bookId }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const canvas2Ref = useRef<HTMLCanvasElement | null>(null);
  const textLayer2Ref = useRef<HTMLDivElement | null>(null);
  const activeThumbnailRef = useRef<HTMLDivElement | null>(null);

  const [pageNum, setPageNum] = useState<number>(() => {
    const saved = localStorage.getItem(`book_progress_${bookId}`);
    return saved ? parseInt(saved, 10) : 1;
  });

  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fromLang, setFromLang] = useState(
    () => localStorage.getItem("reader_from_lang") ?? "en",
  );
  const [toLang, setToLang] = useState(
    () => localStorage.getItem("reader_to_lang") ?? "uk",
  );
  const [dualPage, setDualPage] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [popup, setPopup] = useState<{
    word: string;
    translation: string | null;
    loading: boolean;
    position: { x: number; y: number } | null;
  }>({ word: "", translation: null, loading: false, position: null });

  // Sync fullscreen state with browser
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem("reader_from_lang", fromLang);
    localStorage.setItem("reader_to_lang", toLang);
  }, [fromLang, toLang]);
  // Scroll active thumbnail into view
  useEffect(() => {
    activeThumbnailRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [pageNum]);

  useEffect(() => {
    localStorage.setItem(`book_progress_${bookId}`, pageNum.toString());
  }, [pageNum, bookId]);

  useEffect(() => {
    const load = async () => {
      try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
      } catch (error) {
        console.error("PDF loading error:", error);
      }
    };
    load();
  }, [file]);

  useEffect(() => {
    let isCancelled = false;
    const render = async () => {
      if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;
      try {
        const scale = 1.5;
        const page1 = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;
        await renderPage(page1, canvasRef.current, textLayerRef.current, scale);

        if (dualPage && canvas2Ref.current && textLayer2Ref.current) {
          const page2Num = pageNum + 1;
          if (page2Num <= numPages) {
            const page2 = await pdfDoc.getPage(page2Num);
            if (isCancelled) return;
            await renderPage(
              page2,
              canvas2Ref.current,
              textLayer2Ref.current,
              scale,
            );
          } else {
            canvas2Ref.current.width = 0;
            textLayer2Ref.current.innerHTML = "";
          }
        }
      } catch (err: any) {
        if (err.name !== "RenderingCancelledException")
          console.error("Render error:", err);
      }
    };
    render();
    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNum, dualPage, numPages]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleTextLayerClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== "SPAN") return;
    const word = target.textContent?.trim();
    if (!word) return;

    const rect = target.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 280);
    const y = rect.bottom + 8;

    setPopup({ word, translation: null, loading: true, position: { x, y } });

    try {
      const translation = await translateWord(word, fromLang, toLang);
      setPopup((p) => ({ ...p, translation, loading: false }));
    } catch {
      setPopup((p) => ({
        ...p,
        translation: "Translation failed",
        loading: false,
      }));
    }
  };

  const prevPage = () => setPageNum((p) => Math.max(p - (dualPage ? 2 : 1), 1));
  const nextPage = () =>
    setPageNum((p) => Math.min(p + (dualPage ? 2 : 1), numPages));

  return (
    <div className="pdf-root" ref={rootRef}>
      {/* Sidebar */}
      <div className={`pdf-sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          {sidebarOpen ? "◀" : "▶"}
        </button>
        {sidebarOpen && pdfDoc && (
          <div className="thumbnail-list">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div key={n} ref={n === pageNum ? activeThumbnailRef : null}>
                <PageThumbnail
                  pdfDoc={pdfDoc}
                  pageNumber={n}
                  isActive={n === pageNum || (dualPage && n === pageNum + 1)}
                  onClick={() => setPageNum(n)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main viewer */}
      <div className="pdf-viewer-container">
        <div className="pdf-controls">
          <button onClick={prevPage} disabled={pageNum <= 1}>
            Prev
          </button>
          <span>
            Page {pageNum}
            {dualPage && pageNum + 1 <= numPages
              ? `–${pageNum + 1}`
              : ""} of {numPages}
          </span>
          <button onClick={nextPage} disabled={pageNum >= numPages}>
            Next
          </button>

          <button
            className={`dual-page-btn ${dualPage ? "active" : ""}`}
            onClick={() => setDualPage((d) => !d)}
          >
            {dualPage ? "⊟ Single" : "⊞ Dual"}
          </button>

          <button
            className={`fullscreen-btn ${isFullscreen ? "active" : ""}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? "⊠ Exit" : "⤢ Full"}
          </button>

          <LanguageSelector
            fromLang={fromLang}
            toLang={toLang}
            onChange={(from, to) => {
              setFromLang(from);
              setToLang(to);
            }}
          />
        </div>

        <div className={`pages-wrapper ${dualPage ? "dual" : ""}`}>
          <div className="canvas-wrapper">
            <canvas ref={canvasRef} className="pdf-canvas" />
            <div
              ref={textLayerRef}
              className="textLayer"
              onClick={handleTextLayerClick}
            />
          </div>
          {dualPage && (
            <div className="canvas-wrapper">
              <canvas ref={canvas2Ref} className="pdf-canvas" />
              <div
                ref={textLayer2Ref}
                className="textLayer"
                onClick={handleTextLayerClick}
              />
            </div>
          )}
        </div>
      </div>

      <WordTranslationPopup
        word={popup.word}
        translation={popup.translation}
        loading={popup.loading}
        position={popup.position}
        onClose={() => setPopup((p) => ({ ...p, position: null }))}
      />
    </div>
  );
}

export default PDFViewer;
