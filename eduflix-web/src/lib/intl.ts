// src/lib/intl.ts
import i18n from "../i18n";

export const fmtCurrency = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat(i18n.language, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format((amountCents || 0) / 100);

export const fmtNumber = (n: number) =>
  new Intl.NumberFormat(i18n.language).format(n);

export const fmtPercent = (p: number, digits = 0) =>
  new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(p); // p doit être 0..1

export const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...opts,
  }).format(new Date(iso));

export const fmtRelative = (isoOrDate: string | Date) => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const diffMs = d.getTime() - Date.now();
  const sec = Math.round(diffMs / 1000);
  const abs = Math.abs(sec);

  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
  if (abs < 60) return rtf.format(sec, "second");
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  const d2 = Math.round(h / 24);
  return rtf.format(d2, "day");
};