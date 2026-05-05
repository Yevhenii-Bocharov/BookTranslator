import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../Book/Book.css";

export interface Book {
  id: string;
  name: string;
  file: File;
  thumbnail?: string; // base64 or data URL of PDF thumbnail
}

interface BookProps {
  book: Book;
  onDelete?: (id: string) => void;
}

function Book({ book, onDelete }: BookProps) {
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const truncatedTitle =
    book.name.length > 35 ? book.name.substring(0, 35) + "..." : book.name;

  const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(book.id);
    }
    setShowMenu(false);
  };

  const handleSettingsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setShowMenu((visible) => !visible);
  };

  return (
    <div className="book-card" onClick={() => navigate(`/book/${book.id}`)}>
      <div className="book-card-header">
        <img
          src={
            book.thumbnail ||
            "https://images.unsplash.com/photo-1776675456831-95ccdaa8c907?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          }
          alt="Book cover"
          className="book-image"
        />
        <div className="book-menu">
          <button
            className="book-settings-btn"
            onClick={handleSettingsClick}
            aria-label="Settings"
          >
            ⋮
          </button>
          {showMenu && (
            <div
              className="book-dropdown-menu"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="book-menu-item delete" onClick={handleDelete}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <h3 className="book-title">{truncatedTitle}</h3>
    </div>
  );
}

export default Book;
