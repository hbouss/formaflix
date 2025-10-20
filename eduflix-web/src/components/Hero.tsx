// src/components/Hero.tsx
import { useTranslation } from "react-i18next";
import { fmtCurrency } from "../lib/intl";
import type { CourseLite } from "../api/types";
import { useEffect, useRef, useState } from "react";

/** Sous-couche vidéo : visible seulement après la 1ʳᵉ frame */
function TeaserLayer({
  src,
  poster,
  muted,
}: { src: string; poster: string; muted: boolean }) {
  const vref = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  // Autoplay fiable (toujours muet au démarrage)
  useEffect(() => {
    const v = vref.current;
    if (!v || !src) return;
    try {
      v.muted = true;
      // @ts-ignore
      v.defaultMuted = true;
      v.playsInline = true;
    } catch {}
    const t = setTimeout(() => {
      const p = v.play();
      if (p && typeof p.then === "function") p.catch(() => setFailed(true));
    }, 80);
    return () => clearTimeout(t);
  }, [src]);

  // Sync muet ↔ bouton + gestion de la boucle
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    v.muted = muted;
    v.loop = muted; // boucle seulement quand c’est muet
    if (muted && v.ended) {
      try { v.currentTime = 0; } catch {}
      const p = v.play(); if (p && typeof p.then === "function") p.catch(() => {});
    }
    if (!muted) {
      const p = v.play(); if (p && typeof p.then === "function") p.catch(() => {});
    }
  }, [muted]);

  if (!src || failed) return null;

  return (
    <video
      key={src}
      ref={vref}
      src={src}
      poster={poster}
      playsInline
      autoPlay
      preload="auto"
      onPlaying={() => setVisible(true)}
      onWaiting={() => setVisible(false)}
      onStalled={() => setVisible(false)}
      onError={() => setFailed(true)}
      onEnded={() => {
        const v = vref.current;
        setVisible(false);
        if (v) { try { v.pause(); } catch {} }
      }}
      className={`absolute inset-0 w-full h-full bg-black object-contain sm:object-cover object-center transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ pointerEvents: "none", visibility: visible ? "visible" : "hidden" }}
      aria-hidden="true"
    />
  );
}

export default function Hero({
  course,
  onBuy,
}: { course?: CourseLite; onBuy?: () => void }) {
  const { t } = useTranslation();

  // hooks toujours appelés
  const [muted, setMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem("hero_muted");
    return saved === null ? true : saved !== "0";
  });
  useEffect(() => {
    localStorage.setItem("hero_muted", muted ? "1" : "0");
  }, [muted]);

  // données dérivées
  const bg =
    (course as any)?.hero_banner?.length ? (course as any).hero_banner : course?.thumbnail || "";
  const teaser =
    (course as any)?.trailer_src ||
    (course as any)?.trailer_file ||
    (course as any)?.trailer_url ||
    "";
  const price = course ? fmtCurrency(course.price_cents, (course as any).currency || "EUR") : "";

  if (!course) return <div className="h-[35vh]" />;

  // libellés
  const ctaDesktop = t("hero.watchBuy", { price });               // ex: "Lecture / Acheter — 12,00 €"
  const ctaMobile  = t("hero.playOrBuy", { defaultValue: "Lecture / Acheter" });

  return (
    <div className="relative h-[60vh] sm:h-[68vh] w-full">
      <img
        src={bg}
        alt={course.title}
        className="absolute inset-0 w-full h-full bg-black object-contain sm:object-cover object-center"
        loading="eager"
        fetchPriority="high"
      />

      {teaser ? <TeaserLayer src={teaser} poster={bg} muted={muted} /> : null}

      {/* Bouton sourdine : en haut sur mobile, centré verticalement sur desktop */}
      {teaser ? (
        <button
          type="button"
          onClick={() => setMuted(m => !m)}
          aria-pressed={!muted}
          aria-label={muted ? t("hero.unmute", { defaultValue: "Activer le son" })
                            : t("hero.mute",   { defaultValue: "Couper le son" })}
          className="absolute right-3 md:right-6 z-20 h-10 w-10 md:h-12 md:w-12 grid place-items-center
                     rounded-full bg-black/60 hover:bg-black/80 ring-1 ring-white/20
                     md:top-1/2 md:-translate-y-1/2"
          style={{ top: "calc(64px + var(--sat, 0px))" }}   // safe-area iOS
        >
          {muted ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M5 15v-6h4l5-4v14l-5-4H5zM17.7 8.3l1.4 1.4-1.3 1.3 1.3 1.3-1.4 1.4-1.3-1.3-1.3 1.3-1.4-1.4 1.3-1.3-1.3-1.3 1.4-1.4 1.3 1.3 1.3-1.3z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M5 15v-6h4l5-4v14l-5-4H5zM19 12a5 5 0 0 0-2.2-4.1l1.2-1.6A7 7 0 0 1 21 12a7 7 0 0 1-3 5.7l-1.2-1.6A5 5 0 0 0 19 12z"/>
            </svg>
          )}
        </button>
      ) : null}

      {/* Voiles */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[32vh] sm:h-[34vh] bg-gradient-to-b from-transparent via-black/70 to-black" />

      {/* Contenu (titre + synopsis) */}
      <div className="relative z-10 max-w-[1500px] mx-auto px-4 sm:px-6 pt-[18vh] sm:pt-[24vh]">
        <h1 className="text-[34px] leading-tight sm:text-6xl font-extrabold max-w-[90%] sm:max-w-3xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
          {course.title}
        </h1>

        <p className="mt-2 sm:mt-3 max-w-xl sm:max-w-2xl opacity-90 text-sm sm:text-base leading-relaxed">
          {course.synopsis}
        </p>

        {/* Actions DESKTOP/TABLET : inchangées */}
        <div className="hidden sm:flex items-center gap-3 mt-5">
          <button
            onClick={onBuy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-white text-black font-semibold hover:bg-neutral-200"
            aria-label={ctaDesktop}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" className="-ml-1" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            {ctaDesktop}
          </button>

          <a
            href={`/course/${course.id}`}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-white/20 hover:bg-white/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 7v5l4 2" />
            </svg>
            {t("hero.moreInfo")}
          </a>
        </div>
      </div>

      {/* Actions MOBILE : compactes, **remontées** pour ne pas chevaucher le titre suivant */}
      <div
        className="sm:hidden absolute left-4 right-4 z-20 flex items-center gap-2"
        style={{ bottom: "calc(14vh + env(safe-area-inset-bottom, 0px))" }}  // ← remonté
      >
        <button
          onClick={onBuy}
          className="flex-1 h-10 inline-flex items-center justify-center gap-2 rounded-full
                     bg-white/90 text-black font-semibold backdrop-blur-sm shadow-lg ring-1 ring-black/10
                     active:scale-[0.98] transition"
          aria-label={ctaMobile}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          <span className="text-[13px]">{ctaMobile}</span>
        </button>

        <a
          href={`/course/${course.id}`}
          aria-label={t("hero.moreInfo")}
          className="h-10 w-10 grid place-items-center rounded-full
                     bg-black/45 text-white backdrop-blur-sm ring-1 ring-white/20 shadow-md
                     active:scale-[0.98] transition"
        >
          {/* icône “i” */}
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}