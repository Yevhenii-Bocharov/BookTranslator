import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { GutenbergBook } from "../../lib/gutendex";
import { authorNames, coverUrl, downloadableFormats } from "../../lib/gutendex";
import { useReadingList } from "../../hooks/useReadingList";
import { useAuth } from "../../context/AuthContext";
import "./GutenbergBookModal.css";

type Props = {
  book: GutenbergBook;
  onClose: () => void;
};

export default function GutenbergBookModal({ book, onClose }: Props) {
  const cover = coverUrl(book);
  const { isInList, add, remove } = useReadingList();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const inList = isInList(book.id);
  const description = book.summaries?.[0] ?? book.subjects.slice(0, 5).join(" · ") ?? null;
  const downloads = downloadableFormats(book);

  const toggleList = async () => {
    setError(null);
    setBusy(true);
    const result = inList ? await remove(book.id) : await add(book);
    setBusy(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="gb-modal-backdrop" onClick={onClose}>
      <div className="gb-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gb-modal-close" onClick={onClose}>
          ✕
        </button>

        <div className="gb-modal-body">
          <div className="gb-modal-cover">
            {cover ? <img src={cover} alt={book.title} /> : <span>No cover</span>}
          </div>

          <div className="gb-modal-info">
            <h2>{book.title}</h2>
            <p className="gb-modal-author">{authorNames(book)}</p>
            <p className="gb-modal-meta">
              {book.languages.join(", ").toUpperCase()} · {book.download_count.toLocaleString()}{" "}
              downloads
            </p>

            {description && <p className="gb-modal-description">{description}</p>}

            {error && <p className="gb-modal-error">{error}</p>}

            <div className="gb-modal-actions">
              <button
                className={`gb-btn ${inList ? "gb-btn-outline" : "gb-btn-solid"}`}
                onClick={toggleList}
                disabled={busy || !user}
                title={!user ? "Log in to save books" : undefined}
              >
                {inList ? "Remove from Reading List" : "Add to Reading List"}
              </button>
              <button
                className="gb-btn gb-btn-solid"
                onClick={() => navigate(`/read/${book.id}`)}
              >
                Read
              </button>
            </div>

            {downloads.length > 0 && (
              <div className="gb-modal-downloads">
                <span className="gb-modal-downloads-label">Download:</span>
                {downloads.map((d) => (
                  <a
                    key={d.label}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gb-download-link"
                  >
                    {d.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
