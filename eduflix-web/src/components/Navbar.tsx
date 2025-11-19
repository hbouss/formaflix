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
  const { user, token, signOut } = useAuth();
  const nav = useNavigate();

  const savedUser = (() => {
    try {
      const s = localStorage.getItem("eduflix_user");
      return s ? (JSON.parse(s) as { username?: string }) : null;
    } catch {
      return null;
    }
  })();
  const displayName = user?.username ?? savedUser?.username ?? "";
  const isAuthed = !!(token || user);

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
      <div className="mx-auto max-w-[1500px] h-full px-3 sm:px-6 flex items-center gap-3 md:gap-8">
        {/* Logo */}
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

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" labelKey="nav.home" />
          <NavLink to="/library" labelKey="nav.library" />
          <NavLink to="/my-list" labelKey="nav.myList" />
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {/* Langue – toujours visible */}
          <LanguageMenu />

          {isAuthed ? (
            <>
              {/* Desktop */}
              <span className="hidden sm:block text-sm opacity-80" style={{ fontFamily: NAV_FONT }}>
                {t("nav.helloUser", { username: displayName || t("nav.signIn") })}
              </span>
              <button
                onClick={() => {
                  signOut();
                  nav("/");
                }}
                className="hidden md:inline-flex text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20"
                style={{ fontFamily: NAV_FONT }}
              >
                {t("nav.signOut")}
              </button>

              {/* Mobile */}
              <button
                onClick={() => {
                  signOut();
                  nav("/");
                }}
                className="md:hidden inline-flex items-center justify-center h-9 px-3 rounded-full bg-white/10 hover:bg-white/15 text-[12px] leading-none font-semibold tracking-wide active:scale-[.98] whitespace-nowrap text-center"
                style={{ fontFamily: NAV_FONT }}
              >
                {t("nav.signOut")}
              </button>
            </>
          ) : (
            <>
              {/* Desktop (>= md) */}
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to="/signin"
                  className="text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20"
                  style={{ fontFamily: NAV_FONT }}
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  to="/signup"
                  className="text-sm px-3 py-1.5 rounded bg-white text-black"
                  style={{ fontFamily: NAV_FONT }}
                >
                  {t("nav.signUp")}
                </Link>
              </div>

              {/* Mobile (< md) */}
              <div className="md:hidden flex items-center gap-1.5">
                <Link
                  to="/signin"
                  className="inline-flex items-center justify-center h-9 px-3 rounded-full ring-1 ring-white/20 bg-white/5 hover:bg-white/10 text-white/95 text-[12px] leading-none font-semibold tracking-wide active:scale-[.98] whitespace-nowrap text-center"
                  style={{ fontFamily: NAV_FONT }}
                >
                  {t("nav.signInShort", { defaultValue: "Connexion" })}
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center h-9 px-3 rounded-full bg-[#E50914] hover:bg-[#f6121d] text-white text-[12px] leading-none font-semibold tracking-wide shadow-[0_6px_12px_rgba(229,9,20,0.35)] active:scale-[.98] whitespace-nowrap text-center"
                  style={{ fontFamily: NAV_FONT }}
                >
                  {t("nav.signUpShort", { defaultValue: "S’inscrire" })}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}