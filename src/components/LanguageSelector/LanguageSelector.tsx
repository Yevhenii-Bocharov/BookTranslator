import { useState } from "react";
import "./LanguageSelector.css";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "uk", label: "Ukrainian" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "pl", label: "Polish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
];

type Props = {
  fromLang: string;
  toLang: string;
  onChange: (from: string, to: string) => void;
};

export default function LanguageSelector({ fromLang, toLang, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const swap = () => onChange(toLang, fromLang);

  return (
    <div className="lang-selector">
      <button className="lang-toggle" onClick={() => setIsOpen((o) => !o)}>
        <span className="lang-pill">{LANGUAGES.find(l => l.code === fromLang)?.label ?? fromLang}</span>
        <span className="lang-arrow">→</span>
        <span className="lang-pill">{LANGUAGES.find(l => l.code === toLang)?.label ?? toLang}</span>
        <span className="lang-chevron">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="lang-panel">
          <div className="lang-row">
            <div className="lang-col">
              <label>From</label>
              <select
                value={fromLang}
                onChange={(e) => onChange(e.target.value, toLang)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} disabled={l.code === toLang}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button className="swap-btn" onClick={swap} title="Swap languages">
              ⇄
            </button>

            <div className="lang-col">
              <label>To</label>
              <select
                value={toLang}
                onChange={(e) => onChange(fromLang, e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} disabled={l.code === fromLang}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}