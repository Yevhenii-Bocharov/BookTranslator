import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
// Forcing a specific version and using the legacy minified worker for maximum compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function getPdfThumbnail(file: File): Promise<string> {
  console.log("--- STARTING PDF SCAN ---");
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D Context missing");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    const dataUrl = canvas.toDataURL("image/png");

    // VALIDATION: If the string is too short, it's a blank image
    if (dataUrl.length < 100) {
      throw new Error("Generated thumbnail string is suspiciously short.");
    }

    console.log("--- THUMBNAIL READY (Length: " + dataUrl.length + ") ---");
    return dataUrl;
  } catch (error) {
    console.error("PDF UTILS FAILED:", error);
    throw error; // Passing the error up to funcs.ts
  }
}
