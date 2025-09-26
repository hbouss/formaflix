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
    v.loop = muted; // ✅ boucle seulement quand c’est muet
    if (muted && v.ended) {
      // si on remet muet après la fin, on relance la boucle silencieuse
      try { v.currentTime = 0; } catch {}
      const p = v.play(); if (p && typeof p.then === "function") p.catch(() => {});
    }
    if (!muted) {
      // on lit (sans boucler)
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
      // ❗ plus de loop statique ici — géré dynamiquement via v.loop = muted
      onPlaying={() => setVisible(true)}
      onWaiting={() => setVisible(false)}
      onStalled={() => setVisible(false)}
      onError={() => setFailed(true)}
      onEnded={() => {
        // ✅ si le son est ON, on stoppe et on remet l’image
        const v = vref.current;
        setVisible(false);
        if (v) { try { v.pause(); } catch {} }
      }}
      className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ${
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

  // ✅ hooks toujours appelés
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

  return (
    <div className="relative h-[68vh] w-full">
      <img
        src={bg}
        alt={course.title}
        className="absolute inset-0 w-full h-full object-cover object-center"
        loading="eager"
        fetchPriority="high"
      />

      {teaser ? <TeaserLayer src={teaser} poster={bg} muted={muted} /> : null}

      {/* Bouton sourdine */}
      {teaser ? (
        <button
          type="button"
          onClick={() => setMuted(m => !m)}
          aria-pressed={!muted}
          aria-label={muted ? t("hero.unmute", { defaultValue: "Activer le son" })
                            : t("hero.mute",   { defaultValue: "Couper le son" })}
          className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-20
                     h-10 w-10 md:h-12 md:w-12 grid place-items-center
                     rounded-full bg-black/60 hover:bg-black/80 ring-1 ring-white/20"
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

      {/* Voiles & contenu (inchangés) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] bg-gradient-to-b from-transparent via-black/70 to-black" />

      <div className="relative z-10 max-w-[1500px] mx-auto px-6 pt-[20vh] md:pt-[24vh] lg:pt-[26vh]">
        <h1 className="text-4xl md:text-6xl font-extrabold max-w-3xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
          {course.title}
        </h1>
        <p className="mt-3 max-w-2xl opacity-90 text-sm md:text-base leading-relaxed">
          {course.synopsis}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onBuy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-white text-black font-semibold hover:bg-neutral-200"
            aria-label={t("hero.watchBuy", { price })}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" className="-ml-1" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            {t("hero.watchBuy", { price })}
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
    </div>
  );
}