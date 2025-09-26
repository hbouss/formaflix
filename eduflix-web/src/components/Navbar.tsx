// src/components/Navbar.tsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useTranslation } from "react-i18next";
import LanguageMenu from "./LanguageMenu";

const NAV_FONT =
  '"Netflix Sans", "Helvetica Neue", "Segoe UI", Roboto, Ubuntu, system-ui, -apple-system, Arial, sans-serif';
const NETFLIX_RED = "#E50914";

const NavLink = ({ to, labelKey }: { to: string; labelKey: string }) => {
  const { t } = useTranslation();
  const loc = useLocation();
  const active = loc.pathname === to;
  return (
    <Link
      to={to}
      className={`text-[15px] font-medium tracking-[.02em] transition-opacity ${
        active ? "opacity-100" : "opacity-80 hover:opacity-100"
      }`}
      style={{ fontFamily: NAV_FONT }}
    >
      {t(labelKey)}
    </Link>
  );
};

export default function Navbar() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-black/95 backdrop-blur-sm shadow-[0_1px_0_0_rgba(255,255,255,0.08)]" : "bg-transparent"
      }`}
      style={{ height: 72 }}
    >
      <div className="mx-auto max-w-[1500px] h-full px-6 flex items-center gap-8">
        {/* Logo traduit si tu veux (ou garde "Eduflix") */}
        <Link
          to="/"
          className="select-none"
          style={{
            color: NETFLIX_RED,
            fontFamily: NAV_FONT,
            fontWeight: 900,
            letterSpacing: "-.02em",
            fontSize: 30,
            lineHeight: "1",
          }}
        >
          {t("brand")}
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" labelKey="nav.home" />
          <NavLink to="/library" labelKey="nav.library" />
          <NavLink to="/my-list" labelKey="nav.myList" />
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <LanguageMenu />   {/* <<< ici, avant/à côté du bloc user */}
          {user ? (
            <>
              <span className="hidden sm:block text-sm opacity-80" style={{ fontFamily: NAV_FONT }}>
                {t("nav.helloUser", { username: user.username })}
              </span>
              <button
                onClick={() => {
                  signOut();
                  nav("/");
                }}
                className="text-sm px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                style={{ fontFamily: NAV_FONT }}
              >
                {t("nav.signOut")}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className="text-sm px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                style={{ fontFamily: NAV_FONT }}
              >
                {t("nav.signIn")}
              </Link>
              <Link
                to="/signup"
                className="text-sm px-3 py-1 rounded bg-white text-black"
                style={{ fontFamily: NAV_FONT }}
              >
                {t("nav.signUp")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}