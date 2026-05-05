import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import "./Header.css";

function Header() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down and past 100px
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  return (
    <header className={`app-header ${!isVisible ? "hidden" : ""}`}>
      <div className="header-container">
        <h1 className="app-title">Book Translator</h1>
        <nav className="app-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Home
          </NavLink>
          <NavLink
            to="/books"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Book List
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
