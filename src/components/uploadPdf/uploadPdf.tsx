import React, { useState, useRef } from "react";
import "./uploadPdf.css";

interface UploadPdfProps {
  onUpload: (file: File) => Promise<void> | void;
}

const UploadPdf: React.FC<UploadPdfProps> = ({ onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();

      if (ext !== "pdf" && ext !== "epub") {
        setError("Unsupported format. Only PDF and EPUB files are supported.");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setFile(selectedFile);
      const cleanTitle = selectedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(cleanTitle);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a local document.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Pass the actual file up to your BookListPage handler
      await onUpload(file);

      // Reset form on success
      setTitle("");
      setAuthor("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error(err);
      setError("System encountered failure compiling or saving file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-card">
      <h3 className="upload-header">Upload Document</h3>
      {error && <div className="upload-alert-danger">{error}</div>}

      <form onSubmit={handleUpload} className="upload-form">
        <div className="upload-field-group">
          <label htmlFor="file-upload" className="upload-label">
            Choose Book File (.pdf, .epub)
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".pdf,.epub"
            ref={fileInputRef}
            onChange={handleFileChange}
            required
            className="upload-file-input"
          />
        </div>

        <div className="upload-field-group">
          <label htmlFor="book-title" className="upload-label">
            Book Title
          </label>
          <input
            id="book-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            required
            className="upload-text-input"
          />
        </div>

        <div className="upload-field-group">
          <label htmlFor="book-author" className="upload-label">
            Author Name (Optional)
          </label>
          <input
            id="book-author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author / Creator"
            className="upload-text-input"
          />
        </div>

        <button
          type="submit"
          className="upload-submit-btn"
          disabled={uploading || !file}
        >
          {uploading
            ? "Processing & Saving Document..."
            : "Import to Reading List"}
        </button>
      </form>
    </div>
  );
};

// Export as Default so BookListPage.tsx can import it exactly as is!
export default UploadPdf;
