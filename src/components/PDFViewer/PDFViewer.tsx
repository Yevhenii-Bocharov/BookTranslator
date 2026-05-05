import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import "./PDFViewer.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
  file: Blob;
  bookId: string;
};

function PDFViewer({ file, bookId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  const [pageNum, setPageNum] = useState<number>(() => {
    const saved = localStorage.getItem(`book_progress_${bookId}`);
    return saved ? parseInt(saved, 10) : 1;
  });

  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

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
    let renderTask: any;
    let isCancelled = false;

    const render = async () => {
      if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const viewport = page.getViewport({ scale: 1.5 });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
        if (isCancelled) return;

        const textLayerDiv = textLayerRef.current;
        textLayerDiv.innerHTML = "";
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        if (isCancelled) return;

        // We need a hidden measuring canvas to calculate word widths
        const measureCanvas = document.createElement("canvas");
        const measureCtx = measureCanvas.getContext("2d")!;

        textContent.items.forEach((item: any) => {
          if (!item.str?.trim()) return;

          const [a, b, c, d, e, f] = item.transform;

          // Font size is the vertical scale component
          const fontSize = Math.sqrt(b * b + d * d) * viewport.scale;

          // Angle of the text (usually 0)
          const angle = Math.atan2(b, a);

          // Convert PDF coords (bottom-left origin) to screen coords (top-left origin)
          const x = e * viewport.scale;
          const y = viewport.height - f * viewport.scale;

          // Total width of this text item in screen pixels
          const totalWidth = item.width * viewport.scale;

          // Measure total string width so we can proportionally split into words
          measureCtx.font = `${fontSize}px sans-serif`;
          const totalMeasured = measureCtx.measureText(item.str).width;
          const scaleX = totalWidth / (totalMeasured || 1);

          // Split into words and place each one individually
          const words = item.str.split(/(\s+)/);
          let offsetX = 0;
          const charWidth = totalWidth / (item.str.length || 1); // avg width per char

          words.forEach((word: string) => {
            const wordWidth = word.length * charWidth;

            if (word.trim()) {
              const span = document.createElement("span");
              span.textContent = word;
              span.style.position = "absolute";
              span.style.left = `${x + offsetX}px`;
              span.style.top = `${y - fontSize}px`;
              span.style.fontSize = `${fontSize}px`;
              span.style.lineHeight = "1";
              span.style.whiteSpace = "pre";
              span.style.transformOrigin = "0 100%";
              span.style.transform =
                angle !== 0
                  ? `rotate(${-angle}rad) scaleX(${scaleX})`
                  : `scaleX(${scaleX})`;
              textLayerDiv.appendChild(span);
            }

            offsetX += wordWidth;
          });
        });
      } catch (err: any) {
        if (err.name === "RenderingCancelledException") {
          console.log("Cleanup: Previous render cancelled.");
        } else {
          console.error("Render error:", err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum]);

  const handleTextLayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "SPAN") {
      const word = target.textContent?.trim();
      if (word) console.log("Clicked word:", word);
    }
  };

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-controls">
        <button
          onClick={() => setPageNum((p) => Math.max(p - 1, 1))}
          disabled={pageNum <= 1}
        >
          Prev
        </button>
        <span>
          Page {pageNum} of {numPages}
        </span>
        <button
          onClick={() => setPageNum((p) => Math.min(p + 1, numPages))}
          disabled={pageNum >= numPages}
        >
          Next
        </button>
      </div>

      <div className="canvas-wrapper">
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div
          ref={textLayerRef}
          className="textLayer"
          onClick={handleTextLayerClick}
        />
      </div>
    </div>
  );
}

export default PDFViewer;
