import React, { useState, useEffect } from "react";
import { getBook } from "../../funcs";
import { useParams } from "react-router-dom";
import PDFViewer from "../../components/PDFViewer/PDFViewer";

type Book = {
  id: string;
  name: string;
  file: Blob;
};

function OpenedBookPage() {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    getBook(id).then((res) => {
      setBook(res || null);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (!book) return <div>Book not found</div>;

  return (
    <>
      <h1>read book</h1>
      <h3>{book.name}</h3>
      <PDFViewer file={book.file} />
    </>
  );
}

export default OpenedBookPage;
