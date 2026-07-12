import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import "./ProfileSettingsPage.css";

const APP_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "uk", label: "Українська" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
];

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const { profile, setTheme, setAppLanguage, updateProfile } = useSettings();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await updateProfile({ display_name: displayName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-page">
      <h1>Profile settings</h1>
      <p className="settings-email">{user?.email}</p>

      <form onSubmit={handleSubmit} className="settings-section">
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <button type="submit" className="save-btn">
          {saved ? "Saved ✓" : "Save"}
        </button>
      </form>

      <div className="settings-section">
        <span className="settings-label">Theme</span>
        <div className="segmented">
          <button
            className={profile?.theme === "light" ? "active" : ""}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            className={profile?.theme === "dark" ? "active" : ""}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="settings-section">
        <span className="settings-label">App language</span>
        <select
          value={profile?.app_language ?? "en"}
          onChange={(e) => setAppLanguage(e.target.value)}
        >
          {APP_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
