// src/components/CourseCard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { CourseLite } from "../api/types";
import { Link, useNavigate } from "react-router-dom";

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

export default function CourseCard({
  course,
  owned = false,
  resume,
  onInfo, // affiché seulement si NON possédé
}: {
  course: CourseLite;
  owned?: boolean;
  resume?: ResumeInfo;
  onInfo?: (c: CourseLite) => void;
}) {
  const nav = useNavigate();
  const { isTouch, hasHover } = useDeviceFlags();

  // ----- Aperçu vidéo desktop seulement
  const enablePreview = hasHover && !isTouch;
  const [hover, setHover] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>("");

  // Détection visibilité (pour ne charger la vidéo qu'à l'écran)
  useEffect(() => {
    if (!enablePreview || !cardRef.current) return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { rootMargin: "200px" }
    );
    io.observe(cardRef.current);
    return () => io.disconnect();
  }, [enablePreview]);

  // Ne pose la src vidéo QUE si hover + inView
  const teaser = useMemo<string>(() => {
    return (
      (course as any).trailer_src ||
      (course as any).trailer_file ||
      (course as any).trailer_url ||
      ""
    );
  }, [course]);

  useEffect(() => {
    if (!enablePreview || !teaser) {
      setVideoSrc("");
      return;
    }
    if (hover && inView) setVideoSrc(teaser);
    else setVideoSrc("");
  }, [enablePreview, teaser, hover, inView]);

  // Lecture/pause (desktop) quand le src est posé
  useEffect(() => {
    if (!enablePreview) return;
    const v = videoRef.current;
    if (!v) return;
    if (videoSrc && hover) v.play().catch(() => {});
    else {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {}
    }
  }, [enablePreview, videoSrc, hover]);

  // ----- Action au tap (mobile)
  const handleTap = () => {
    if (!isTouch) return; // on laisse desktop gérer via boutons
    if (owned) nav(`/player/${course.id}`);
    else if (onInfo) onInfo(course);
    else nav(`/course/${course.id}`);
  };

  // Données visuelles
  const thumbnail = (course as any).thumbnail || "";
  const percent = resume?.percent ?? 0;
  const showProgress = owned && percent > 0;

  // Composants d’actions (desktop uniquement)
  const Primary = () => (
    <Link
      to={owned ? `/player/${course.id}` : `/course/${course.id}`}
      className="px-2 py-1 text-[12px] rounded bg-white text-black hover:bg-neutral-200 font-semibold"
    >
      {owned ? "Lecture" : "Aperçu"}
    </Link>
  );

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
          to={`/course/${course.id}`}
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
      onClick={handleTap} // 👉 mobile: toute la carte est cliquable
    >
      {/* Poster — toujours visible */}
      <img
        src={thumbnail}
        alt={course.title}
        loading="lazy"
        className="w-full h-full object-cover"
      />

      {/* Aperçu vidéo – desktop only, jamais sur mobile */}
      {enablePreview && videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
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

        <div
          className={`mt-2 flex items-center gap-2 transition-opacity ${
            hover ? "opacity-100" : "opacity-0"
          }`}
        >
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