// src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// import des JSON
import fr from "./locales/fr/common.json";
import en from "./locales/en/common.json";
import es from "./locales/es/common.json";
import ar from "./locales/ar/common.json";
import ru from "./locales/ru/common.json";
import uk from "./locales/uk/common.json";
import zh from "./locales/zh/common.json";

const resources = {
  fr: { common: fr },
  en: { common: en },
  es: { common: es },
  ar: { common: ar },
  ru: { common: ru },
  uk: { common: uk },
  zh: { common: zh }
} as const;

i18n
  .use(LanguageDetector) // détecte navigateur + localStorage
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    supportedLngs: ["fr", "en", "es", "ar", "ru", "uk", "zh"],
    ns: ["common"],
    defaultNS: "common",
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"]
    },
    interpolation: { escapeValue: false }
  });

// ⚠️ gérer les langues RTL (arabe)
const applyDir = (lng: string) => {
  const rtl = ["ar"].includes(lng);
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  document.documentElement.lang = lng;
};
applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export default i18n;