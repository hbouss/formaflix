/* eslint-disable @typescript-eslint/no-explicit-any */

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import type { CourseDetail, CourseLite } from "../api/types";
import { useAuth } from "../store/auth";
import MobileTabbar from "../components/MobileTabbar";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";

// --- Helpers Cloudflare Stream (HLS) ---

function normalizeTeaserSrc(val?: string): string {
  const s = (val || "").trim();
  if (!s) return "";
  // Si on colle l'URL d'iframe Cloudflare Stream, on convertit en HLS direct
  const m = s.match(/iframe\.videodelivery\.net\/([a-z0-9]+)/i);
  if (m) return `https://videodelivery.net/${m[1]}/manifest/video.m3u8`;
  return s;
}

const isM3U8 = (s: string) => /\.m3u8($|\?)/i.test(s);

/** Attache HLS seulement si nécessaire (Chrome/Firefox), sinon src direct (Safari gère nativement) */
async function attachHlsIfNeeded(video: HTMLVideoElement, src: string) {
  if (!isM3U8(src)) {
    video.src = src;
    return null;
  }
  if (video.canPlayType("application/vnd.apple.mpegURL")) {
    video.src = src;
    return null;
  }
  const { default: Hls } = await import("hls.js");
  if (Hls.isSupported()) {
    const hls = new Hls({
      capLevelToPlayerSize: true,
      maxBufferLength: 10,
      maxMaxBufferLength: 30,
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return hls as unknown as { destroy(): void };
  }
  video.src = src;
  return null;
}

function isTrueEnd(v: HTMLVideoElement) {
  const d = v.duration;
  if (isFinite(d) && d > 0) {
    const tail = Math.max(0.4, d * 0.03);
    return v.currentTime >= d - tail;
  }
  return false;
}

/** mini teaser muet, limité à un extrait court (previewSeconds) — rejouable via replayTrigger */
// --- Helpers Cloudflare Stream (HLS) ---
// ... (normalizeTeaserSrc, isM3U8, attachHlsIfNeeded, isTrueEnd restent identiques au-dessus)

function TeaserLayer({
  src,
  poster,
  muted,
  onPreviewEnd,
  onError,
  previewSeconds,
  replayTrigger = 0,
}: {
  src: string;
  poster: string;
  muted: boolean;
  onPreviewEnd?: () => void;
  onError?: () => void;
  previewSeconds?: number;   // 0 ou undefined => PAS DE LIMITE, on lit jusqu'au bout
  replayTrigger?: number;
}) {
  const vref = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const hlsRef = useRef<{ destroy(): void } | null>(null);

  // ✅ plus de typeof : soit un nombre > 0, soit null
  const limit = previewSeconds && previewSeconds > 0 ? previewSeconds : null;

  // --- iOS early-end workaround ---
  const startedAtRef = useRef<number>(0);
  const seenPlayingRef = useRef(false);
  const triedMp4Ref = useRef(false);

  const extractCfId = (u: string) => {
    const m = u.match(/videodelivery\.net\/([a-z0-9]+)/i);
    return m ? m[1] : "";
  };
  const mp4FallbackFromHls = (u: string) => {
    const id = extractCfId(u);
    return id ? `https://videodelivery.net/${id}/downloads/default.mp4` : "";
  };

  useEffect(() => {
    const v = vref.current;
    if (!v || !src) return;

    // reset
    try {
      v.pause();
      v.removeAttribute("src");
      v.load();
    } catch (error) {
      void error; // évite no-unused-vars / no-empty
    }
    setVisible(false);
    try {
      hlsRef.current?.destroy();
    } catch (error) {
      void error;
    }
    hlsRef.current = null;
    triedMp4Ref.current = false;
    seenPlayingRef.current = false;
    startedAtRef.current = 0;

    // réglages autoplay mobile
    try {
      v.muted = true;
      v.playsInline = true;
      v.poster = poster;
      v.loop = false;
    } catch (error) {
      void error;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const hls = await attachHlsIfNeeded(v, src);
        if (cancelled) {
          hls?.destroy?.();
          return;
        }
        hlsRef.current = hls;
        const p = v.play();
        if (p && typeof (p as Promise<void>).then === "function") {
          p.catch((error) => {
            void error;
            onError?.();
          });
        }
      } catch (error) {
        void error;
        onError?.();
      }
    };

    const t = setTimeout(start, 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
      try {
        v.pause();
      } catch (error) {
        void error;
      }
      try {
        hlsRef.current?.destroy();
      } catch (error) {
        void error;
      }
      hlsRef.current = null;
    };
  }, [src, replayTrigger, poster, onError]);

  // sync mute
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    v.muted = muted;
    v.loop = false;
    if (!muted) {
      const p = v.play();
      if (p && typeof (p as Promise<void>).then === "function") {
        p.catch((error) => {
          void error;
        });
      }
    }
  }, [muted]);

  const onTimeUpdate = () => {
    if (limit == null) return; // pas de coupe quand illimité
    const v = vref.current;
    if (!v) return;
    const dur = isFinite(v.duration) ? v.duration : Number.POSITIVE_INFINITY;
    const threshold = Math.min(limit, Math.max(0, dur - 0.25));
    if (v.currentTime >= threshold) {
      try {
        v.pause();
      } catch (error) {
        void error;
      }
      setVisible(false);
      onPreviewEnd?.();
    }
  };

  const onPlaying = () => {
    setVisible(true);
    if (!seenPlayingRef.current) {
      seenPlayingRef.current = true;
      startedAtRef.current = performance.now();
    }
  };

  const onEnded = async () => {
    const v = vref.current!;
    // Cas lecture complète (pas de limite) → fin “vraie”
    if (limit == null) {
      if (isTrueEnd(v)) {
        try {
          v.pause();
        } catch (error) {
          void error;
        }
        setVisible(false);
        onPreviewEnd?.();
        return;
      }
      // ended trop tôt → on essaie de reprendre, puis fallback MP4 si besoin
      const elapsed = performance.now() - startedAtRef.current;
      const resumed = v.play();
      if (resumed && typeof (resumed as Promise<void>).then === "function") {
        resumed.catch(async (error) => {
          void error;
          if (!triedMp4Ref.current && elapsed < 3000) {
            const mp4 = mp4FallbackFromHls(src);
            if (mp4) {
              triedMp4Ref.current = true;
              try {
                try {
                  hlsRef.current?.destroy();
                } catch (e2) {
                  void e2;
                }
                hlsRef.current = null;
                v.pause();
                v.removeAttribute("src");
                v.load();
                v.src = mp4;
                await v.play();
              } catch (e3) {
                void e3;
              }
            }
          }
        });
      }
      return;
    }

    // limite active → fin de preview
    try {
      v.pause();
    } catch (error) {
      void error;
    }
    setVisible(false);
    onPreviewEnd?.();
  };

  if (!src) return null;

  return (
    <video
      key={src}
      ref={vref}
      playsInline
      muted
      autoPlay
      preload="auto"
      onPlaying={onPlaying}
      onWaiting={() => undefined}
      onStalled={() => undefined}
      onError={() => onError?.()}
      onEnded={onEnded}
      onTimeUpdate={onTimeUpdate}
      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
      controlsList="nodownload noplaybackrate noremoteplayback"
      disablePictureInPicture
    />
  );
}

type TabKey = "episodes" | "similar" | "trailers";
type DocLite = { id: number; title: string; file: string };

type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
};

export default function MobileCourseInfo() {
  const { t } = useTranslation("common");
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const nav = useNavigate();
  const { token } = useAuth();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [similar, setSimilar] = useState<CourseLite[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());
  const [muted, setMuted] = useState<boolean>(() => {
    const s = localStorage.getItem("hero_muted");
    return s === null ? true : s !== "0";
  });
  const [tab, setTab] = useState<TabKey>("episodes");

  const [inList, setInList] = useState(false);
  const [listBusy, setListBusy] = useState(false);

  const [showRate, setShowRate] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const [rating, setRating] = useState<-1 | 0 | 1 | 2>(0);

  const [replayTrigger, setReplayTrigger] = useState(0);
  const [canReplay, setCanReplay] = useState(false);

  const [openDoc, setOpenDoc] = useState<DocLite | null>(null);

  // feuille de partage fallback
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    localStorage.setItem("hero_muted", muted ? "1" : "0");
  }, [muted]);

  // charger le cours
  useEffect(() => {
    client.get(`/catalog/courses/${courseId}/`).then((r) => {
      setCourse(r.data);
      const ur = (r.data as any).user_rating;
      if (typeof ur === "number") setRating(ur as -1 | 0 | 1 | 2);
    });
  }, [courseId]);

  // achats + similaires + ma liste
  useEffect(() => {
    const run = async () => {
      try {
        const [ownedRes, allRes, myListRes] = await Promise.all([
          token ? client.get("/learning/my-library/") : Promise.resolve({ data: [] }),
          client.get<CourseLite[]>("/catalog/courses/"),
          token ? client.get("/learning/my-list/") : Promise.resolve({ data: [] }),
        ]);
        const own = new Set<number>((ownedRes.data as any[]).map((e: any) => e.course.id));
        setOwnedIds(own);
        setInList((myListRes.data as any[]).some((f: any) => f.course.id === courseId));

        const all = allRes.data;
        const cats = new Set<string>((course?.categories ?? []) as string[]);
        const picks = all
          .filter((c) => c.id !== courseId && !own.has(c.id))
          .map((c) => {
            const cc: string[] = (c as any).categories ?? [];
            const score = cc.reduce((s, k) => (cats.has(k) ? s + 1 : s), 0);
            return { c, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 12)
          .map((x) => x.c);

        setSimilar(picks);
      } catch {
        setSimilar([]);
      }
    };
    void run();
  }, [token, course, courseId]);

  const ownedCurrent = ownedIds.has(courseId);

  // actions principales
  const buy = async () => {
    if (!token) {
      alert(t("alerts.loginToBuy", { defaultValue: "Connecte-toi pour acheter" }));
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: courseId });
    window.location.href = data.checkout_url;
  };
  const play = () => nav(`/player/${courseId}`);

  // Ma liste
  const toggleList = async () => {
    if (!token) {
      nav("/signin");
      return;
    }
    setListBusy(true);
    try {
      if (inList) {
        await client.delete("/learning/my-list/", { data: { course_id: courseId } });
        setInList(false);
      } else {
        await client.post("/learning/my-list/", { course_id: courseId });
        setInList(true);
      }
    } catch {
      setInList((prev) => !prev);
    } finally {
      setListBusy(false);
    }
  };

  // Évaluer
  const sendRating = async (val: -1 | 1 | 2) => {
    if (!token) {
      nav("/signin");
      return;
    }
    setRateBusy(true);
    setRating(val);
    try {
      await client.post("/catalog/rate/", { course_id: courseId, value: val });
    } catch {
      /* noop UI */
    } finally {
      setRateBusy(false);
      setShowRate(false);
    }
  };

  // Partager (natif + fallback feuille)
  const share = () => {
    const url = `${window.location.origin}/info/${courseId}`;
    const title = course?.title || t("brand", { defaultValue: "Beautyflix" });
    const text = course?.synopsis || "";

    const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

    if (canNativeShare) {
      const navWithShare = navigator as ShareNavigator;
      if (!navWithShare.share) {
        setShowShare(true);
        return;
      }
      const p = navWithShare.share({ title, text, url });
      if (p && typeof p.then === "function") {
        p.catch(() => setShowShare(true));
      }
      return;
    }
    setShowShare(true);
  };

  const totalMinutes = useMemo(() => {
    if (!course) return 0;
    return Math.round((course.lessons ?? []).reduce((s, l) => s + (l.duration_seconds || 0), 0) / 60);
  }, [course]);

  if (!course) return null;

  const bg = course.hero_banner || course.thumbnail;

  // ✅ Teaser direct : on privilégie trailer_src (si déjà direct), sinon on dérive HLS depuis trailer_url (iframe)
  const teaser = normalizeTeaserSrc(course.trailer_src || course.trailer_url || "");

  const TabBtn = ({ k, label }: { k: TabKey; label: string }) => (
    <button
      onClick={() => setTab(k)}
      className={`relative px-3 py-3 text-[15px] font-medium transition-opacity ${
        tab === k ? "opacity-100" : "opacity-70"
      }`}
      aria-selected={tab === k}
      role="tab"
    >
      {label}
      {tab === k && <div className="absolute left-2 right-2 -bottom-[1px] h-[3px] rounded bg-red-500" />}
    </button>
  );

  const showReplayBtn = !!teaser && (!ownedCurrent || !token);
  const lovePercent = ((course as any).love_percent ?? 0) as number;
  const ratingsTotal = ((course as any).ratings_total ?? 0) as number;

  const LoveBadge = () =>
    lovePercent > 0 ? (
      <div className="inline-flex items-center gap-2 text-sm mt-2">
        <div className="h-2 w-2 rounded-full bg-green-400" />
        <span className="text-green-400 font-semibold">
          {
            t("course.loveBadge", {
              percent: lovePercent,
              defaultValue: "{{percent}}% ont adoré ce titre",
            }) as string
          }
        </span>
        {ratingsTotal > 0 && (
          <span className="opacity-60">
            {"• "}
            {t("course.reviewsCount", { count: ratingsTotal, defaultValue: "{{count}} avis" }) as string}
          </span>
        )}
      </div>
    ) : null;

  // SEO dynamique avec Helmet
  const canonical = `${window.location.origin}/info/${courseId}`;
  const metaTitle = `${course.title} – Formation esthétique en ligne | SBeautyflix`;
  const metaDescription =
    course.synopsis ||
    (course.description ? course.description.slice(0, 155) : "Formations beauté et esthétique en ligne SBeautyflix.");
  const rawImage = course.hero_banner || course.thumbnail;
  const metaImage = rawImage && rawImage.startsWith("http")
    ? rawImage
    : `${window.location.origin}${rawImage ?? ""}`;

  // ---- UI ----
  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonical} />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={metaImage} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={metaImage} />
      </Helmet>

      <div
        className="relative min-h-dvh bg-black text-white"
        style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* zone video/top */}
        <div className="sticky top-0 z-40">
          <div className="relative w-full aspect-video bg-black">
            <img src={bg} alt={course.title} className="absolute inset-0 w-full h-full object-cover" />
            {teaser ? (
              <TeaserLayer
                src={teaser}
                poster={bg}
                muted={muted}
                previewSeconds={0}
                replayTrigger={replayTrigger}
                onPreviewEnd={() => setCanReplay(true)} // ✅ activé à la vraie fin
              />
            ) : null}

            {/* close + mute */}
            <button
              onClick={() => nav(-1)}
              aria-label={t("courseInfo.topbar.close", { defaultValue: "Fermer" })}
              className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+8px)] h-10 w-10 grid place-items-center rounded-full bg-black/60 ring-1 ring-white/20"
            >
              ✕
            </button>
            {teaser ? (
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={
                  muted
                    ? t("courseInfo.topbar.unmute", { defaultValue: "Activer le son" })
                    : t("courseInfo.topbar.mute", { defaultValue: "Couper le son" })
                }
                className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+56px)] h-10 w-10 grid place-items-center rounded-full bg-black/60 ring-1 ring-white/20"
              >
                {muted ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M5 15v-6h4l5-4v14l-5-4H5zM17.7 8.3l1.4 1.4-1.3 1.3 1.3 1.3-1.4 1.4-1.3-1.3-1.3 1.3-1.4-1.4 1.3-1.3-1.3-1.3 1.4-1.4 1.3 1.3 1.3-1.3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M5 15v-6h4l5-4v14l-5-4H5zM19 12a5 5 0 0 0-2.2-4.1l1.2-1.6A7 7 0 0 1 21 12a7 7 0 0 1-3 5.7l-1.2-1.6A5 5 0 0 0 19 12z" />
                  </svg>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* contenu entête */}
        <div className="px-4 py-4 space-y-4">
          <div>
            <h1 className="text-2xl font-extrabold">{course.title}</h1>
            <div className="mt-1 text-sm opacity-80">
              {course.created_at ? new Date(course.created_at).getFullYear() : ""} •{" "}
              {totalMinutes ? `~${totalMinutes} min` : ""}
            </div>
            <LoveBadge />
          </div>

          {/* CTA principal */}
          <div className="space-y-2">
            {ownedCurrent ? (
              <button
                onClick={play}
                className="w-full h-12 rounded-md bg-white text-black font-semibold grid place-items-center"
              >
                {t("courseInfo.play", { defaultValue: "▶︎ Lecture" })}
              </button>
            ) : (
              <button
                onClick={buy}
                className="w-full h-12 rounded-md bg-white text-black font-semibold grid place-items-center"
              >
                {t("courseInfo.buyFor", {
                  price: (course.price_cents / 100).toFixed(2),
                  defaultValue: "Acheter — {{price}} €",
                }) as string}
              </button>
            )}

            {/* ⟲ Revoir la bande-annonce */}
            {showReplayBtn && (
              <button
                disabled={!canReplay}
                onClick={() => {
                  setCanReplay(false);
                  setReplayTrigger((x) => x + 1);
                }}
                className={`w-full h-12 rounded-md grid place-items-center transition ${
                  canReplay ? "bg-white/10 text-white" : "bg-white/5 text-white/70 cursor-not-allowed"
                }`}
              >
                {t("courseInfo.replayTrailer", { defaultValue: "⟲ Revoir la bande-annonce" })}
              </button>
            )}
          </div>

          {/* description courte */}
          {course.description && (
            <p className="text-[15px] leading-relaxed opacity-90">{course.description}</p>
          )}

          {/* ======== DOCUMENTS ======== */}
          {Array.isArray((course as any).documents) && (course as any).documents.length > 0 && (
            <div className="mt-2">
              <div className="text-sm font-semibold opacity-90 mb-2">
                {t("player.documents", { defaultValue: "Documents" })}
              </div>
              <div className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1">
                {(course as any).documents.map((d: DocLite) => (
                  <button
                    key={d.id}
                    onClick={() => (ownedCurrent ? setOpenDoc(d) : buy())}
                    className={`shrink-0 px-3 py-2 rounded-lg bg-white/10 ring-1 ring-white/10
                              flex items-center gap-2 ${ownedCurrent ? "" : "opacity-60"}`}
                  >
                    {/* icône PDF */}
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="currentColor"
                      className="opacity-90"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L19.5 9H15zM8.5 13h1v-1.5h1c.8 0 1.5-.7 1.5-1.5S11.3 8.5 10.5 8.5h-2v4.5zm1-3V9.5h1c.3 0 .5.2.5.5s-.2.5-.5.5h-1zM13 13h1v-1h1v-1h-1V9.5h1V8.5h-2V13zm3.5 0H18c.8 0 1.5-.7 1.5-1.5S18.8 10 18 10h-1V8.5h-1V13zm1-2c.3 0 .5.2.5.5s-.2.5-.5.5h-1v-1h1z" />
                    </svg>
                    <span className="text-sm max-w-[52vw] truncate">
                      {d.title ||
                        t("player.documents", { defaultValue: "Document" })}
                    </span>
                    {!ownedCurrent && <span className="text-xs ml-1">🔒</span>}
                  </button>
                ))}
              </div>
              <div className="text-xs opacity-60 mt-1">
                {t("courseInfo.pdfHint", { defaultValue: "Livret PDF & ressources" })}
              </div>
            </div>
          )}

          {/* actions rapides */}
          <QuickActions
            rating={rating}
            setShowRate={setShowRate}
            inList={inList}
            listBusy={listBusy}
            toggleList={toggleList}
            share={share}
          />

          {/* Popover Évaluer */}
          {showRate && (
            <RatePopover
              busy={rateBusy}
              rating={rating}
              onPick={sendRating}
              onClose={() => !rateBusy && setShowRate(false)}
            />
          )}
        </div>

        {/* --- ONGLET STICKY --- */}
        <div
          className="sticky z-30 bg-black border-t border-white/10"
          style={{ top: "calc(100vw * 9 / 16)" }}
          role="tablist"
          aria-label={t("courseInfo.tabsLabel", { defaultValue: "Sections du cours" })}
        >
          <div className="flex gap-2 px-2">
            <TabBtn
              k="episodes"
              label={t("courseInfo.tabs.episodes", { defaultValue: "Épisodes" })}
            />
            <TabBtn
              k="similar"
              label={t("courseInfo.tabs.similar", { defaultValue: "Titres similaires" })}
            />
            <TabBtn
              k="trailers"
              label={t("courseInfo.tabs.trailers", { defaultValue: "Bandes-annonces" })}
            />
          </div>
          <div className="h-[1px] bg-white/10" />
        </div>

        {/* --- CONTENU ONGLET --- */}
        <TabsContent
          tab={tab}
          course={course}
          owned={ownedCurrent}
          courseId={courseId}
          similar={similar}
          buy={buy}
          nav={nav}
          bg={bg}
          teaser={teaser}
        />

        {/* ======== BOTTOM-SHEET PDF ======== */}
        {openDoc && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setOpenDoc(null)}
            />
            <div
              className="fixed inset-x-0 bottom-0 z-50 bg-[#0b0b0b] rounded-t-2xl ring-1 ring-white/10 overflow-hidden"
              style={{ maxHeight: "85vh" }}
            >
              <div className="p-3 flex items-center justify-between">
                <div className="h-1.5 w-10 rounded-full bg-white/20 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                <div className="text-sm font-semibold pr-8">
                  {openDoc.title ||
                    t("player.documents", { defaultValue: "Document" })}
                </div>
                <button
                  className="p-2 -mr-1 opacity-80"
                  onClick={() => setOpenDoc(null)}
                  aria-label={t("actions.close", { defaultValue: "Fermer" })}
                >
                  ✕
                </button>
              </div>

              <div className="bg-black/40">
                <iframe
                  title={
                    openDoc.title ||
                    t("player.documents", { defaultValue: "Document" })
                  }
                  src={`${openDoc.file}#view=FitH`}
                  className="w-full"
                  style={{ height: "60vh" }}
                />
              </div>

              <div className="p-3 grid grid-cols-2 gap-2">
                <a
                  href={openDoc.file}
                  target="_blank"
                  rel="noreferrer"
                  className="h-11 rounded-md bg-white text-black font-semibold grid place-items-center"
                  onClick={() =>
                    client
                      .post(`/learning/documents/${openDoc.id}/track/`)
                      .catch(() => {})
                  }
                >
                  {t("courseInfo.open", { defaultValue: "Ouvrir" })}
                </a>
                <a
                  href={openDoc.file}
                  download
                  className="h-11 rounded-md bg白/10 text-white grid place-items-center ring-1 ring-white/10"
                  onClick={() =>
                    client
                      .post(`/learning/documents/${openDoc.id}/track/`)
                      .catch(() => {})
                  }
                >
                  {t("courseInfo.download", { defaultValue: "Télécharger" })}
                </a>
              </div>
            </div>
          </>
        )}

        {/* ======== BOTTOM-SHEET PARTAGE (fallback) ======== */}
        {showShare && (
          <ShareSheet
            url={`${window.location.origin}/info/${courseId}`}
            title={course.title}
            text={course.synopsis || ""}
            onClose={() => setShowShare(false)}
          />
        )}

        <MobileTabbar />
      </div>
    </>
  );
}

/* --- Composants découplés --- */

function QuickActions({
  inList,
  listBusy,
  toggleList,
  rating,
  setShowRate,
  share,
}: {
  inList: boolean;
  listBusy: boolean;
  toggleList: () => void;
  rating: -1 | 0 | 1 | 2;
  setShowRate: (v: boolean | ((p: boolean) => boolean)) => void;
  share: () => void;
}) {
  const { t } = useTranslation("common");

  const label =
    rating === 0
      ? t("courseInfo.quick.rate", { defaultValue: "Évaluer" })
      : rating === -1
      ? t("courseInfo.quick.notForMe", { defaultValue: "Pas pour moi" })
      : rating === 1
      ? t("courseInfo.quick.iLikeIt", { defaultValue: "J’aime bien" })
      : t("courseInfo.quick.loveIt", { defaultValue: "J’adore !" });

  const color =
    rating === 0 ? "" : rating === -1 ? "text-red-400" : rating === 1 ? "text-green-400" : "text-yellow-300";

  const IconThumbDown = (props: React.ComponentProps<"svg">) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...props}>
      <path d="M2 10h4v10H2zM22 11c0-1.1-.9-2-2-2h-6l1-4c.1-.3 0-.6-.2-.9-.3-.5-.8-.8-1.4-.8H13c-.5 0-1-.2-1.3-.6L7 8v10h10c.7 0 1.3-.4 1.7-1l3-5c.2-.3.3-.7.3-1z" />
    </svg>
  );
  const IconThumbUp = (props: React.ComponentProps<"svg">) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...props}>
      <path d="M2 14h4V4H2zM22 13c0 1.1-.9 2-2 2h-6l1 4c.1.3 0 .6-.2.9-.3.5-.8.8-1.4.8H13c-.5 0-1-.2-1.3-.6L7 16V6h10c.7 0 1.3.4 1.7 1l3 5c.2.3.3.7.3 1z" />
    </svg>
  );
  const IconTwoThumbs = (props: React.ComponentProps<"svg">) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...props}>
      <path d="M1 14h4V4H1v10zm6-8v10l4 4 2-8h6l-3-5c-.4-.6-1-.9-1.7-.9H9zm12 4v10h4V10h-4zM7 10h4l1-4-5 4z" />
    </svg>
  );

  const EvalIcon = () =>
    rating === 0 ? (
      <span className="inline-block scale-110">👍</span>
    ) : rating === -1 ? (
      <IconThumbDown className="scale-110" />
    ) : rating === 1 ? (
      <IconThumbUp className="scale-110" />
    ) : (
      <IconTwoThumbs className="scale-110" />
    );

  return (
    <div className="grid grid-cols-3 gap-4 text-center text-sm py-2">
      {/* Ma liste */}
      <button
        onClick={toggleList}
        className={`opacity-90 ${listBusy ? "pointer-events-none opacity-50" : ""}`}
        aria-pressed={inList}
      >
        {inList ? "✓" : "➕"}
        <div className="mt-1 opacity-80">
          {inList
            ? t("course.removeFromList", { defaultValue: "Retirer de ma liste" })
            : t("course.addFromList", { defaultValue: "Ajouter à ma liste" })}
        </div>
      </button>

      {/* Évaluer */}
      <button onClick={() => setShowRate((v) => !v)} className={`opacity-90 ${color}`}>
        <EvalIcon />
        <div className="mt-1 opacity-80">{label}</div>
      </button>

      {/* Partager */}
      <button onClick={share} className="opacity-90">
        ✈︎
        <div className="mt-1 opacity-80">
          {t("courseInfo.quick.share", { defaultValue: "Partager" })}
        </div>
      </button>
    </div>
  );
}

function RatePopover({
  busy,
  rating,
  onPick,
  onClose,
}: {
  busy: boolean;
  rating: -1 | 0 | 1 | 2;
  onPick: (val: -1 | 1 | 2) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");

  const IconThumbDown = (props: React.ComponentProps<"svg">) => (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" {...props}>
      <path d="M2 10h4v10H2zM22 11c0-1.1-.9-2-2-2h-6l1-4c.1-.3 0-.6-.2-.9-.3-.5-.8-.8-1.4-.8H13c-.5 0-1-.2-1.3-.6L7 8v10h10c.7 0 1.3-.4 1.7-1l3-5c.2-.3.3-.7.3-1z" />
    </svg>
  );
  const IconThumbUp = (props: React.ComponentProps<"svg">) => (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" {...props}>
      <path d="M2 14h4V4H2zM22 13c0 1.1-.9 2-2 2h-6l1 4c.1.3 0 .6-.2.9-.3.5-.8.8-1.4.8H13c-.5 0-1-.2-1.3-.6L7 16V6h10c.7 0 1.3.4 1.7 1l3 5c.2.3.3.7.3 1z" />
    </svg>
  );
  const IconTwoThumbs = (props: React.ComponentProps<"svg">) => (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" {...props}>
      <path d="M1 14h4V4H1v10zm6-8v10l4 4 2-8h6l-3-5c-.4-.6-1-.9-1.7-.9H9zm12 4v10h4V10h-4zM7 10h4l1-4-5 4z" />
    </svg>
  );

  const Btn = ({
    active,
    color,
    onClick,
    children,
    label,
  }: {
    active: boolean;
    color: "red" | "green" | "yellow";
    onClick: () => void;
    children: React.ReactNode;
    label: string;
  }) => {
    const ring =
      color === "red"
        ? "ring-red-400/30 hover:ring-red-400/60"
        : color === "green"
        ? "ring-green-400/30 hover:ring-green-400/60"
        : "ring-yellow-300/30 hover:ring-yellow-300/60";
    const glow =
      color === "red"
        ? "hover:shadow-[0_0_24px_rgba(248,113,113,.35)]"
        : color === "green"
        ? "hover:shadow-[0_0_24px_rgba(74,222,128,.35)]"
        : "hover:shadow-[0_0_24px_rgba(253,224,71,.35)]";
    const tint =
      color === "red"
        ? active
          ? "text-red-400 bg-white/10"
          : "text-red-300/80"
        : color === "green"
        ? active
          ? "text-green-400 bg-white/10"
          : "text-green-300/80"
        : active
        ? "text-yellow-300 bg-white/10"
        : "text-yellow-200/80";

    return (
      <button
        disabled={busy}
        onClick={onClick}
        className={`flex flex-col items-center justify-center w-[92px] h-[92px] rounded-2xl
                    ring-1 ${ring} ${tint} ${glow}
                    transition-transform duration-150 active:scale-95`}
      >
        {children}
        <span className="text-[12px] mt-1">{label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Le conteneur du popover passe au-dessus de tout */}
      <div className="relative z-50">
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 -top-1
                     bg-white/10 text-white rounded-3xl px-5 py-4
                     shadow-2xl ring-1 ring-white/15 backdrop-blur-md
                     animate-[pop_.18s_ease-out]"
          style={{ transformOrigin: "bottom center" }}
        >
          <div className="text-center text-sm mb-3 opacity-90">
            {t("courseInfo.ratePopover.title", { defaultValue: "Votre avis" })}
          </div>
          <div className="flex items-center gap-4">
            <Btn
              active={rating === -1}
              color="red"
              onClick={() => onPick(-1)}
              label={t("courseInfo.ratePopover.notForMe", { defaultValue: "Pas pour moi" })}
            >
              <IconThumbDown />
            </Btn>
            <Btn
              active={rating === 1}
              color="green"
              onClick={() => onPick(1)}
              label={t("courseInfo.ratePopover.iLikeIt", { defaultValue: "J’aime bien" })}
            >
              <IconThumbUp />
            </Btn>
            <Btn
              active={rating === 2}
              color="yellow"
              onClick={() => onPick(2)}
              label={t("courseInfo.ratePopover.loveIt", { defaultValue: "J’adore !" })}
            >
              <IconTwoThumbs />
            </Btn>
          </div>
        </div>
      </div>

      {/* Voile clic-away sous le popover mais au-dessus du reste */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
    </>
  );
}

function TabsContent({
  tab,
  course,
  owned,
  courseId,
  similar,
  buy,
  nav,
  bg,
  teaser,
}: {
  tab: "episodes" | "similar" | "trailers";
  course: CourseDetail;
  owned: boolean;
  courseId: number;
  similar: CourseLite[];
  buy: () => Promise<void>;
  nav: ReturnType<typeof useNavigate>;
  bg: string;
  teaser: string;
}) {
  const { t } = useTranslation("common");

  return (
    <div className="px-4 py-4 space-y-4">
      {tab === "episodes" && (
        <>
          {course.lessons?.length ? (
            <div className="space-y-2">
              {course.lessons.map((l) => {
                const fmt2 = (n: number) => String(n ?? 0).padStart(2, "0"); // 01, 02, 10…
                const mins = l.duration_seconds ? Math.round(l.duration_seconds / 60) : 0;
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 bg-white/5 rounded-lg p-3"
                  >
                    {/* vignette */}
                    <div className="w-[112px] aspect-video bg-black/30 rounded overflow-hidden shrink-0" />

                    {/* infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        {/* numéro à largeur fixe + chiffres tabulaires */}
                        <span className="w-8 shrink-0 text-right font-semibold opacity-80 tabular-nums">
                          {fmt2(l.order)}.
                        </span>

                        {/* titre sur 2 lignes max, même style partout */}
                        <h3 className="text-[15px] leading-[1.2] font-medium line-clamp-2 break-words">
                          {l.title}
                        </h3>
                      </div>

                      {/* durée alignée, chiffres tabulaires */}
                      <div className="mt-1 text-xs opacity-70 tabular-nums pl-8">
                        {mins ? `${String(mins).padStart(2, "0")} min` : ""}
                      </div>
                    </div>

                    {/* CTA largeur fixe pour aligner la colonne droite */}
                    <button
                      onClick={() => (owned ? nav(`/player/${courseId}?l=${l.id}`) : buy())}
                      className="text-sm px-3 py-1 rounded bg-white text-black shrink-0 w-24 text-center"
                    >
                      {owned
                        ? t("card.play", { defaultValue: "Lecture" })
                        : t("course.buyNow", { defaultValue: "Acheter" })}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="opacity-80">
              {t("courseInfo.empty.episodes", {
                defaultValue: "Aucun épisode disponible.",
              })}
            </p>
          )}
        </>
      )}

      {tab === "similar" && (
        <>
          {similar.length ? (
            <div className="grid grid-cols-2 gap-3">
              {similar.map((c) => (
                <button
                  key={c.id}
                  className="text-left rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10"
                  onClick={() => nav(`/info/${c.id}`)}
                >
                  <img
                    src={(c as any).thumbnail}
                    alt={c.title}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="p-2">
                    <div className="text-sm font-medium line-clamp-1">
                      {c.title}
                    </div>
                    <div className="text-xs opacity-80 mt-1">
                      {(c.price_cents / 100).toFixed(2)} €
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="opacity-80">
              {t("courseInfo.empty.similar", {
                defaultValue: "Aucune recommandation pour le moment.",
              })}
            </p>
          )}
        </>
      )}

      {tab === "trailers" && (
        <>
          {teaser ? (
            <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-black/40">
              {/* lecteur contrôlé, HLS pris en charge via Safari natif ou hls.js */}
              <video
                controls
                playsInline
                className="w-full"
                poster={bg}
                src={teaser}
              />
            </div>
          ) : (
            <p className="opacity-80">
              {t("courseInfo.empty.trailers", {
                defaultValue: "Pas de bande-annonce disponible.",
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Feuille de partage (fallback) ---------- */
function ShareSheet({
  url,
  title,
  text,
  onClose,
}: {
  url: string;
  title: string;
  text: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  // Copy robuste (HTTPS → Clipboard API ; sinon → execCommand)
  const copyRobust = async (value: string) => {
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    return ok;
  };

  const copy = async () => {
    const ok = await copyRobust(url);
    setCopied(ok);
    if (!ok) prompt(t("share.copyPrompt", { defaultValue: "Copiez ce lien :" }), url);
    if (ok) onClose();
    setTimeout(() => setCopied(false), 1600);
  };

  const doShare = async () => {
    try {
      if (canShare) {
        const navWithShare = navigator as ShareNavigator;
        if (navWithShare.share) {
          await navWithShare.share({ title, text, url });
        }
      }
      onClose();
    } catch {
      // annulé → reste ouvert
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-[#0b0b0b] rounded-t-2xl ring-1 ring-white/10 overflow-hidden">
        <div className="p-4">
          <div className="h-1.5 w-10 rounded-full bg-white/20 mx-auto mb-3" />
          <div className="text-center text-sm opacity-90 mb-2">
            {t("share.sheetTitle", { defaultValue: "Partager ce titre" })}
          </div>

          {/* champ lisible + sélection au tap */}
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
            className="w-full text-xs bg-white/5 rounded-lg px-3 py-2 text-center break-all opacity-90"
          />

                    <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              onClick={doShare}
              disabled={!canShare}
              className={`h-11 rounded-md font-semibold grid place-items-center ${
                canShare ? "bg-white text-black" : "bg-white/10 text-white/60"
              }`}
            >
              {t("share.shareVia", { defaultValue: "📤 Partager via…" })}
            </button>

            <button
              onClick={copy}
              className="h-11 rounded-md grid place-items-center ring-1 ring-white/20 bg-white/10"
            >
              {copied
                ? t("share.linkCopied", { defaultValue: "✅ Lien copié" })
                : t("share.copyLink", { defaultValue: "🔗 Copier le lien" })}
            </button>

            <button
              onClick={onClose}
              className="h-11 rounded-md grid place-items-center bg-white/0 text-white/80"
            >
              {t("share.cancel", { defaultValue: "Annuler" })}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* Ajoute dans ton CSS global si tu veux :
@keyframes pop {
  from { transform: translate(-50%, 0) scale(.95); opacity: 0 }
  to   { transform: translate(-50%, 0) scale(1);   opacity: 1 }
}
*/