import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import "./Header.css";

const APP_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "uk", label: "Українська" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
];

function Header() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, signOut } = useAuth();
  const { profile, setTheme, setAppLanguage } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = (profile?.display_name || user?.email || "?").charAt(0).toUpperCase();

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <header className={`app-header ${!isVisible ? "hidden" : ""}`}>
      <div className="header-container">
        <NavLink to="/" className="app-logo">
          📖 Book Translator
        </NavLink>

        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Home
          </NavLink>
          <NavLink to="/reading" className={({ isActive }) => (isActive ? "active" : "")}>
            Reading
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
        </nav>

        <div className="account-area" ref={menuRef}>
          {user ? (
            <>
              <button className="account-avatar" onClick={() => setMenuOpen((o) => !o)}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" />
                ) : (
                  <span>{initials}</span>
                )}
              </button>

              {menuOpen && (
                <div className="account-menu">
                  <NavLink
                    to="/profile/settings"
                    className="account-menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile settings
                  </NavLink>

                  <div className="account-menu-item static">
                    <span>Theme</span>
                    <div className="segmented small">
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

                  <div className="account-menu-item static">
                    <span>Language</span>
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

                  <button className="account-menu-item logout" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              )}
            </>
          ) : (
            <NavLink to="/login" className="login-link">
              Log in
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
