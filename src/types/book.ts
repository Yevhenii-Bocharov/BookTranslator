// src/types/book.ts
export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  gutenberg_id: number | null;
  file_type: "epub" | "pdf" | "gutenberg_text";
  file_url: string | null;
  file_data: string | null;
  current_page: number;
  total_pages: number;
  created_at: string;
}
