// src/components/LanguageMenu.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "zh", label: "中文", flag: "🇨🇳" }
];

export default function LanguageMenu() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const select = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-1 rounded hover:bg-white/10"
        aria-label="Change language"
        title="Change language"
      >
        🌐
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg bg-black/95 ring-1 ring-white/10 shadow-xl p-1">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => select(l.code)}
              className={`w-full text-left px-3 py-2 rounded hover:bg-white/10
                ${i18n.language.startsWith(l.code) ? "bg-white/10" : ""}`}
            >
              <span className="mr-2">{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}