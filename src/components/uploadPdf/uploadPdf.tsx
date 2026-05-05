import React from "react";
import "./uploadPdf.css";

interface UploadPdfProps {
  onUpload: (file: File) => Promise<void>;
}

function UploadPdf({ onUpload }: UploadPdfProps) {
  return (
    <div className="upload-pdf-container">
      <span className="upload-pdf-icon">📄</span>
      <span className="upload-pdf-label">Upload PDF Book</span>
      <span className="upload-pdf-text">Click to select or drag and drop</span>
      <input
        type="file"
        accept="application/pdf"
        className="upload-pdf-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            await onUpload(file);
          }
        }}
      />
    </div>
  );
}

export default UploadPdf;
