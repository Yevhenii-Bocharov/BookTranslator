import type { GutenbergBook } from "../../lib/gutendex";
import { authorNames, coverUrl } from "../../lib/gutendex";
import "./GutenbergBookCard.css";

type Props = {
  book: GutenbergBook;
  onClick: () => void;
};

export default function GutenbergBookCard({ book, onClick }: Props) {
  const cover = coverUrl(book);

  return (
    <button className="gb-card" onClick={onClick}>
      <div className="gb-card-cover">
        {cover ? <img src={cover} alt={book.title} loading="lazy" /> : <span>No cover</span>}
      </div>
      <div className="gb-card-title">{book.title}</div>
      <div className="gb-card-author">{authorNames(book)}</div>
    </button>
  );
}
