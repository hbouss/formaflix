import { useEffect, useMemo, useRef, useState } from "react";
import type { CourseLite } from "../api/types";
import { Link, useNavigate } from "react-router-dom";
import Hls from "hls.js";

type ResumeInfo = { percent: number; resume_position_seconds: number };

function useDeviceFlags() {
  const [flags, setFlags] = useState({ isTouch: false, hasHover: false });
  useEffect(() => {
    const isTouch =
      "ontouchstart" in window ||
      (navigator as any).maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0;
    const hasHover = window.matchMedia?.("(hover: hover)")?.matches ?? false;
    setFlags({ isTouch, hasHover });
  }, []);
  return flags;
}

/** Transforme une URL trailer (incluant l’iframe Cloudflare) en src jouable.
 *  - https://iframe.videodelivery.net/<ID> → https://videodelivery.net/<ID>/manifest/video.m3u8
 *  - laisse passer mp4 ou m3u8 directs
 */
function normalizeTeaserSrc(val?: string): string {
  const s = (val || "").trim();
  if (!s) return "";
  const m = s.match(/iframe\.videodelivery\.net\/([a-z0-9]+)/i);
  if (m) return `https://videodelivery.net/${m[1]}/manifest/video.m3u8`;
  return s;
}

export default function CourseCard({
  course,
  owned = false,
  resume,
  onInfo,   // bouton "Infos" (desktop)
  onBuy,    // bouton "Acheter" (desktop)
}: {
  course: CourseLite;
  owned?: boolean;
  resume?: ResumeInfo;
  onInfo?: (c: CourseLite) => void;
  onBuy?: (c: CourseLite) => void;
}) {
  const nav = useNavigate();
  const { isTouch, hasHover } = useDeviceFlags();

  // Aperçu vidéo : desktop uniquement
  const enablePreview = hasHover && !isTouch;

  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [hover, setHover] = useState(false);
  const [inView, setInView] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>("");

  // Détection visibilité (charger la vidéo seulement à l’écran)
  useEffect(() => {
    if (!enablePreview || !cardRef.current) return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { rootMargin: "200px" }
    );
    io.observe(cardRef.current);
    return () => io.disconnect();
  }, [enablePreview]);

  // Teaser brut → normalisé (Cloudflare iframe → m3u8)
  const rawTeaser = useMemo<string>(() => {
    return (
      (course as any).trailer_src ||
      (course as any).trailer_file ||
      (course as any).trailer_url ||
      ""
    );
  }, [course]);

  const teaser = useMemo(() => normalizeTeaserSrc(rawTeaser), [rawTeaser]);

  // Ne pose la src QUE si hover + inView
  useEffect(() => {
    if (!enablePreview || !teaser) {
      setVideoSrc("");
      return;
    }
    setVideoSrc(hover && inView ? teaser : "");
  }, [enablePreview, teaser, hover, inView]);

  // Attache/détache HLS si besoin quand videoSrc change
  useEffect(() => {
    const v = videoRef.current;
    // cleanup ancien HLS
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }
    if (!v) return;

    // retire un éventuel src précédent
    try {
      v.pause();
      v.removeAttribute("src");
      v.load();
    } catch {}

    if (!videoSrc) return;

    const isM3U8 = /\.m3u8($|\?)/i.test(videoSrc);
    const canNativeHls = v.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (isM3U8 && !canNativeHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.attachMedia(v);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(videoSrc);
      });
    } else {
      // Safari (natif) ou MP4
      v.src = videoSrc;
    }

    return () => {
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
    };
  }, [videoSrc]);

  // Lecture/pause quand on montre/masque l’aperçu
  useEffect(() => {
    if (!enablePreview) return;
    const v = videoRef.current;
    if (!v) return;

    if (videoSrc && hover) {
      v.muted = true;
      // @ts-ignore
      v.playsInline = true;
      v.play().catch(() => {});
    } else {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {}
    }
  }, [enablePreview, videoSrc, hover]);

  // ----- Action au tap (mobile)
  const handleTap = () => {
    if (!isTouch) return;
    if (owned) nav(`/player/${course.id}`);
    else nav(`/info/${course.id}`);
  };

  // Visuels
  const thumbnail = (course as any).thumbnail || "";
  const percent = resume?.percent ?? 0;
  const showProgress = owned && percent > 0;

  // Composants d’actions (desktop)
  const Primary = () => {
    if (owned) {
      return (
        <Link
          to={`/player/${course.id}`}
          className="px-2 py-1 text-[12px] rounded bg-white text-black hover:bg-neutral-200 font-semibold"
        >
          Lecture
        </Link>
      );
    }
    return onBuy ? (
      <button
        type="button"
        onClick={() => onBuy(course)}
        className="px-2 py-1 text-[12px] rounded bg-white text-black hover:bg-neutral-200 font-semibold"
      >
        Acheter
      </button>
    ) : (
      <Link
        to={`/course/${course.id}`}
        className="px-2 py-1 text-[12px] rounded bg-white text-black hover:bg-neutral-200 font-semibold"
      >
        Aperçu
      </Link>
    );
  };

  const Secondary = () =>
    !owned ? (
      onInfo ? (
        <button
          type="button"
          onClick={() => onInfo(course)}
          className="px-2 py-1 text-[12px] rounded bg-white/20 hover:bg-white/30"
        >
          Infos
        </button>
      ) : (
        <Link
          to={`/info/${course.id}`}
          className="px-2 py-1 text-[12px] rounded bg-white/20 hover:bg-white/30"
        >
          Infos
        </Link>
      )
    ) : null;

  return (
    <div
      ref={cardRef}
      className="group relative shrink-0 w-[230px] sm:w-[260px] aspect-video rounded-md overflow-hidden bg-black cursor-pointer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleTap}
    >
      {/* Poster */}
      <img src={thumbnail} alt={course.title} loading="lazy" className="w-full h-full object-cover" />

      {/* Aperçu vidéo – desktop only */}
      {enablePreview && (hover || videoSrc) ? (
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10 ${
            hover ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}

      {/* Overlay + actions — cachés sur mobile */}
      <div
        className={`hidden md:flex absolute inset-0 z-20 flex-col justify-end p-3 transition-colors duration-200
        ${hover ? "bg-gradient-to-t from-black/80 to-transparent" : "bg-gradient-to-t from-black/70 to-transparent"}`}
      >
        <div className="font-semibold line-clamp-1">{course.title}</div>
        <div className="text-[12px] opacity-80">
          {owned ? "Accès inclus" : `${(course.price_cents / 100).toFixed(2)} €`}
        </div>

        {showProgress && (
          <div className="mt-1 h-1.5 w-full bg-white/20 rounded">
            <div
              className="h-1.5 bg-white rounded"
              style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
            />
          </div>
        )}

        <div className={`mt-2 flex items-center gap-2 transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}>
          <Primary />
          <Secondary />
        </div>
      </div>

      {/* Liseré décoratif */}
      <div
        className={`absolute inset-0 rounded-md ring-1 ring-white/10 transition-transform duration-200 pointer-events-none z-0
        ${hover ? "scale-[1.06] shadow-2xl" : ""}`}
      />
    </div>
  );
}