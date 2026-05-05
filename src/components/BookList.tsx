import React from "react";
import Book, { type Book as BookType } from "./Book/Book";

interface BookListProps {
  books: BookType[];
  onDelete?: (id: string) => void;
}

function BookList({ books, onDelete }: BookListProps) {
  return (
    <div className="book-list">
      {books.map((book) => (
        <Book key={book.id} book={book} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default BookList;
