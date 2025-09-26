// src/components/CourseModal.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import client from "../api/client";
import type { CourseDetail, CourseLite } from "../api/types";
import { useAuth } from "../store/auth";

/** Teaser vidéo : s’affiche seulement après la première frame + bouton muet/son */
function TeaserLayer({
  src,
  poster,
  muted,
  onPlaying,
  onError,
}: { src: string; poster: string; muted: boolean; onPlaying?: () => void; onError?: () => void }) {
  const vref = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);

  // Autoplay (toujours muet au départ pour passer sur iOS/Safari)
  useEffect(() => {
    const v = vref.current;
    if (!v || !src) return;
    try {
      v.muted = true;
      // @ts-ignore - WebKit
      v.defaultMuted = true;
      v.playsInline = true;
    } catch {}
    const t = setTimeout(() => {
      const p = v.play();
      if (p && typeof p.then === "function") p.catch(() => onError?.());
    }, 80);
    return () => clearTimeout(t);
  }, [src, onError]);

  // Sync muet ↔ bouton
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    v.muted = muted;
    if (!muted) {
      const p = v.play();
      if (p && typeof p.then === "function") p.catch(() => {});
    }
  }, [muted]);

  if (!src) return null;

  return (
    <video
      key={src}
      ref={vref}
      src={src}
      poster={poster}
      playsInline
      loop
      autoPlay
      preload="auto"
      onPlaying={() => { setVisible(true); onPlaying?.(); }}
      onWaiting={() => setVisible(false)}
      onStalled={() => setVisible(false)}
      onError={() => onError?.()}
      className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ pointerEvents: "none", visibility: visible ? "visible" : "hidden" }}
      aria-hidden="true"
    />
  );
}

export default function CourseModal({
  courseId,
  onClose,
}: { courseId: number; onClose: () => void }) {
  const { token } = useAuth();

  // --- états principaux (déclarés avant tout return pour garder l’ordre des hooks stable)
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);

  // muet/son (persistance locale, même logique que le Hero)
  const [muted, setMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem("hero_muted");
    return saved === null ? true : saved !== "0";
  });
  useEffect(() => { localStorage.setItem("hero_muted", muted ? "1" : "0"); }, [muted]);

  // similaires (simple heuristique par catégories)
  const [similar, setSimilar] = useState<CourseLite[]>([]);

  // Bloquer le scroll du body pendant l’ouverture
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Charger le cours
  useEffect(() => {
    client.get(`/catalog/courses/${courseId}/`).then((r) => setCourse(r.data));
  }, [courseId]);

  // Savoir si déjà dans "Ma liste"
  useEffect(() => {
    if (!token) return;
    client.get("/learning/my-list/").then((r) => {
      const ids = (r.data as any[]).map((f: any) => f.course.id);
      setInList(ids.includes(courseId));
    }).catch(() => {});
  }, [token, courseId]);

  // Titres similaires (par catégories communes) – fallback si aucune catégorie
  useEffect(() => {
    client.get("/catalog/courses/").then((r) => {
      const all: CourseLite[] = r.data;
      const cats = new Set((course?.categories ?? []) as string[]);
      const out = all
        .filter(c => c.id !== courseId)
        .filter(c => (c as any).categories?.some((x: string) => cats.has(x)))
        .slice(0, 12);
      setSimilar(out);
    }).catch(() => setSimilar([]));
  }, [courseId, course?.categories]);

  // Actions
  const buy = async () => {
    if (!token) {
      alert("Connecte-toi pour acheter");
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: courseId });
    window.location.href = data.checkout_url;
  };

  const toggleList = async () => {
    if (!token) {
      alert("Connecte-toi pour utiliser Ma liste");
      return;
    }
    setBusy(true);
    try {
      if (inList) {
        await client.delete("/learning/my-list/", { data: { course_id: courseId } });
        setInList(false);
      } else {
        await client.post("/learning/my-list/", { course_id: courseId });
        setInList(true);
      }
    } finally {
      setBusy(false);
    }
  };

  // Helpers
  const totalDurationMin = useMemo(() => {
    if (!course) return 0;
    return Math.round(
      (course.lessons ?? []).reduce((s, l) => s + (l.duration_seconds || 0), 0) / 60
    );
  }, [course]);

  if (!course) return null;

  const bg = course.hero_banner || course.thumbnail;
  const teaser = course.trailer_src || course.trailer_url || "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-auto my-8 w-[96%] max-w-5xl rounded-2xl overflow-hidden ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ====== Header (teaser + actions) ====== */}
        <div className="relative w-full aspect-video bg-black">
          {/* image de base */}
          <img
            src={bg}
            alt={course.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          {/* teaser au-dessus (affiché après première frame) */}
          {teaser ? (
            <TeaserLayer
              src={teaser}
              poster={bg}
              muted={muted}
              onError={() => {/* on garde l’image */}}
            />
          ) : null}

          {/* gradients Netflix */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 grid place-items-center"
          >
            ✕
          </button>

          {/* Bouton muet/son (à droite, centré) */}
          {teaser ? (
            <button
              type="button"
              onClick={() => setMuted(m => !m)}
              aria-pressed={!muted}
              aria-label={muted ? "Activer le son" : "Couper le son"}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20
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

          {/* Titre + actions */}
          <div className="absolute bottom-5 left-5 right-5">
            <h1 className="text-3xl md:text-5xl font-extrabold drop-shadow">
              {course.title}
            </h1>
            {course.synopsis ? (
              <p className="mt-2 max-w-3xl text-sm md:text-base opacity-90">{course.synopsis}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={buy}
                className="px-5 py-2 rounded bg-white text-black hover:bg-neutral-200 font-semibold"
              >
                Acheter maintenant — {(course.price_cents / 100).toFixed(2)} €
              </button>
              <button
                onClick={toggleList}
                disabled={busy}
                className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50"
              >
                {inList ? "Retirer de Ma liste" : "Ajouter à Ma liste"}
              </button>
            </div>
            {course.categories?.length ? (
              <div className="mt-2 text-sm opacity-80">
                Genres : {course.categories.join(", ")}
              </div>
            ) : null}
          </div>
        </div>

        {/* ====== Corps scrollable ====== */}
        <div className="bg-[#141414] max-h-[75vh] overflow-y-auto">
          {/* bloc infos rapides */}
          <div className="px-5 md:px-6 py-5 grid md:grid-cols-[2fr,1fr] gap-6">
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <h3 className="text-lg font-semibold">À propos</h3>
              <p className="opacity-90 mt-2">{course.description}</p>

              <h4 className="mt-5 text-sm font-semibold opacity-90">Épisodes</h4>
              <ul className="mt-2 space-y-1 text-sm opacity-90">
                {course.lessons.map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-md px-3 py-2 bg-white/5">
                    <div className="truncate">
                      <span className="opacity-70 mr-2">{l.order}.</span>
                      {l.title}
                      {l.is_free_preview && (
                        <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-white/10">Preview</span>
                      )}
                    </div>
                    {l.duration_seconds > 0 && (
                      <span className="text-xs opacity-60 shrink-0 ml-3">
                        {Math.floor(l.duration_seconds / 60)} min
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 h-max">
              <div className="text-lg font-semibold">Documents inclus</div>
              <ul className="text-sm opacity-90 mt-2 space-y-1">
                {course.documents.map((d) => (
                  <li key={d.id}>• {d.title}</li>
                ))}
              </ul>

              <div className="mt-4 text-sm opacity-80 space-y-1">
                {totalDurationMin > 0 && <div>Durée totale : ~{totalDurationMin} min</div>}
                {course.created_at && (
                  <div>Ajouté le : {new Date(course.created_at).toLocaleDateString()}</div>
                )}
              </div>
            </div>
          </div>

          {/* Bande-annonce et plus (si tu veux l’afficher à nouveau) */}
          {teaser ? (
            <div className="px-5 md:px-6 pb-4">
              <h3 className="text-lg font-semibold mb-3">Bandes-annonces et plus</h3>
              <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-black/40">
                <video src={teaser} controls playsInline className="w-full" poster={bg} />
              </div>
            </div>
          ) : null}

          {/* Titres similaires */}
          {similar.length ? (
            <div className="px-5 md:px-6 pb-6">
              <h3 className="text-lg font-semibold mb-3">Titres similaires</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {similar.map((c) => (
                  <a
                    key={c.id}
                    href={`/course/${c.id}`}
                    className="block rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <img src={(c as any).thumbnail} alt={c.title} className="w-full aspect-video object-cover" />
                    <div className="px-3 py-2 text-sm">{c.title}</div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}