import React from "react";
import "./WordTranslationPopup.css";

type Props = {
  word: string;
  translation: string | null;
  loading: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onToggleSave?: () => void;
  saved?: boolean;
  saveDisabled?: boolean;
};

function WordTranslationPopup({
  word,
  translation,
  loading,
  position,
  onClose,
  onToggleSave,
  saved = false,
  saveDisabled = false,
}: Props) {
  if (!position) return null;

  return (
    <>
      <div className="popup-backdrop" onClick={onClose} />
      <div className="popup" style={{ left: position.x, top: position.y }}>
        <div className="popup-word-row">
          <div className="popup-word">{word}</div>
          {onToggleSave && (
            <button
              className={`popup-star ${saved ? "saved" : ""}`}
              onClick={onToggleSave}
              disabled={saveDisabled}
              title={saved ? "Remove from saved words" : "Save this word"}
            >
              {saved ? "★" : "☆"}
            </button>
          )}
        </div>
        <div className="popup-divider" />
        {loading ? (
          <div className="popup-loading">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="popup-translation">{translation ?? "—"}</div>
        )}
        <button className="popup-close" onClick={onClose}>
          ✕
        </button>
      </div>
    </>
  );
}

export default WordTranslationPopup;
