import React from "react";
import "./WordTranslationPopup.css";

type Props = {
  word: string;
  translation: string | null;
  loading: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
};

function WordTranslationPopup({
  word,
  translation,
  loading,
  position,
  onClose,
}: Props) {
  if (!position) return null;

  return (
    <>
      <div className="popup-backdrop" onClick={onClose} />
      <div className="popup" style={{ left: position.x, top: position.y }}>
        <div className="popup-word">{word}</div>
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
