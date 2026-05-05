import React, { useState, useEffect } from "react";
import { getBooks, saveBook, deleteBook } from "../../funcs";
import BookList from "../../components/BookList";
import UploadPdf from "../../components/uploadPdf/uploadPdf";
import type { Book } from "../../components/Book/Book";

function BookListPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  // Load books automatically when the page opens
  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    const data = await getBooks();
    setBooks(data);
  }

  async function handleUpload(file: File) {
    await saveBook(file);
    await loadBooks(); // Refresh list after upload
    setShowUpload(false); // Hide upload after successful upload
  }

  async function handleDeleteBook(id: string) {
    await deleteBook(id);
    await loadBooks(); // Refresh list after deletion
  }

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ margin: 0 }}>Book List Page</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "#989a9d",
            color: "white",
            border: "none",
            fontSize: "20px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Toggle upload"
        >
          {showUpload ? "−" : "+"}
        </button>
      </div>

      {/* Upload Input */}
      {showUpload && (
        <div style={{ marginBottom: "20px" }}>
          <UploadPdf onUpload={handleUpload} />
        </div>
      )}

      {/* Book List Display */}
      <BookList books={books} onDelete={handleDeleteBook} />
      {books.length === 0 && <p>No books uploaded yet.</p>}
    </div>
  );
}

export default BookListPage;
