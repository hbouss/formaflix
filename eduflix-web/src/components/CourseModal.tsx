// src/components/CourseModal.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import client from "../api/client";
import type { CourseDetail, CourseLite, HomeRails } from "../api/types";
import { useAuth } from "../store/auth";

/** Teaser vidéo : rendu seulement après la 1ʳᵉ frame + contrôle muet/son */
function TeaserLayer({
  src,
  poster,
  muted,
  onError,
}: {
  src: string;
  poster: string;
  muted: boolean;
  onError?: () => void;
}) {
  const vref = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);

  // Autoplay (toujours muet au départ pour iOS/Safari)
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
      onPlaying={() => setVisible(true)}
      onWaiting={() => setVisible(false)}
      onStalled={() => setVisible(false)}
      onError={() => onError?.()}
      className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ pointerEvents: "none", visibility: visible ? "visible" : "hidden" }}
      aria-hidden="true"
    />
  );
}

export default function CourseModal({
  courseId,
  onClose,
}: {
  courseId: number;
  onClose: () => void;
}) {
  const { token } = useAuth();

  // --- états principaux (ordre des hooks stable)
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);

  // muet/son (persistance locale)
  const [muted, setMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem("hero_muted");
    return saved === null ? true : saved !== "0";
  });
  useEffect(() => {
    localStorage.setItem("hero_muted", muted ? "1" : "0");
  }, [muted]);

  // ▶️ carte vidéo active dans « Bandes-annonces et plus »
  const [playingId, setPlayingId] = useState<string | null>(null);

  // IDs des cours achetés (pour filtrer)
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());

  // “similaires” (alimentés via catégories → rails → fallback global)
  const [similar, setSimilar] = useState<CourseLite[]>([]);

  // Bloquer le scroll du body pendant l’ouverture
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
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

  // "Ma liste"
  useEffect(() => {
    if (!token) return;
    client
      .get("/learning/my-list/")
      .then((r) => {
        const ids = (r.data as any[]).map((f: any) => f.course.id);
        setInList(ids.includes(courseId));
      })
      .catch(() => {});
  }, [token, courseId]);

  // Bibliothèque (achats)
  useEffect(() => {
    if (!token) {
      setOwnedIds(new Set());
      return;
    }
    client
      .get("/learning/my-library/")
      .then((r) => {
        const ids = new Set<number>((r.data as any[]).map((e: any) => e.course.id));
        setOwnedIds(ids);
      })
      .catch(() => setOwnedIds(new Set()));
  }, [token]);

  // Suggestions robustes (catégories → rails → global)
  useEffect(() => {
    if (!course) {
      setSimilar([]);
      return;
    }

    const notOwnedNotSelf = (c: CourseLite) => c.id !== courseId && !ownedIds.has(c.id);
    const uniqById = (arr: CourseLite[]) => {
      const seen = new Set<number>();
      return arr.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    };

    const run = async () => {
      try {
        const [coursesRes, railsRes] = await Promise.allSettled([
          client.get<CourseLite[]>("/catalog/courses/"),
          client.get<HomeRails>("/catalog/home-rails/"),
        ]);

        const all = coursesRes.status === "fulfilled" ? coursesRes.value.data : ([] as CourseLite[]);
        const rails = railsRes.status === "fulfilled" ? railsRes.value.data : ({} as Partial<HomeRails>);

        // 1) similarité par catégories (pool = tous les cours)
        const cats = new Set<string>((course.categories ?? []) as string[]);
        let picks: CourseLite[] = [];

        if (cats.size > 0) {
          picks = all
            .filter(notOwnedNotSelf)
            .map((c) => {
              const cc: string[] = (c as any).categories ?? [];
              const score = cc.reduce((s, x) => (cats.has(x) ? s + 1 : s), 0);
              return { c, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .map(({ c }) => c)
            .slice(0, 12);
        }

        // 2) compléter via rails éditoriales si pas assez d’items
        const railsPool = uniqById(
          [
            ...(rails.editor_picks ?? []),
            ...(rails.top10 ?? []),
            ...(rails.bestsellers ?? []),
            ...(rails.packs ?? []),
          ].filter(Boolean) as CourseLite[]
        ).filter(notOwnedNotSelf);

        if (picks.length < 8) {
          picks = uniqById([...picks, ...railsPool]).slice(0, 12);
        }

        // 3) fallback global (autres cours non achetés)
        if (picks.length < 8) {
          const extra = all.filter(notOwnedNotSelf);
          picks = uniqById([...picks, ...extra]).slice(0, 12);
        }

        setSimilar(uniqById(picks));
      } catch {
        setSimilar([]);
      }
    };

    run();
  }, [courseId, course, ownedIds]);

  // Actions
  const buy = async () => {
    if (!token) {
      alert("Connecte-toi pour acheter");
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", {
      course_id: courseId,
    });
    window.location.href = data.checkout_url;
  };

  const buyOther = async (id: number) => {
    if (!token) {
      alert("Connecte-toi pour acheter");
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", {
      course_id: id,
    });
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

  // Cartes « Bandes-annonces et plus » : bande-annonce + leçons en aperçu
  const extras = useMemo(
    () =>
      !course
        ? []
        : ([
            ...(course.trailer_src || course.trailer_url
              ? [
                  {
                    id: "trailer",
                    title: "Bande-annonce",
                    src: (course.trailer_src || course.trailer_url) as string,
                    poster: course.hero_banner || course.thumbnail,
                    meta: undefined as string | undefined,
                  },
                ]
              : []),
            ...(course.lessons || [])
              .filter((l) => l.is_free_preview && !!l.video_src)
              .map((l) => ({
                id: `preview_${l.id}`,
                title: `Aperçu : ${l.title}`,
                src: l.video_src,
                poster: course.hero_banner || course.thumbnail,
                meta: l.duration_seconds ? `${Math.floor(l.duration_seconds / 60)} min` : undefined,
              })),
          ] as Array<{ id: string; title: string; src: string; poster: string; meta?: string }>),
    [course]
  );

  if (!course) return null;

  const bg = course.hero_banner || course.thumbnail;
  const teaser = course.trailer_src || course.trailer_url || "";
  const ownedCurrent = ownedIds.has(courseId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel scrollable ENTIER (comme Netflix) */}
      <div
        className="relative mx-auto my-8 w-[96%] max-w-5xl rounded-2xl overflow-hidden ring-1 ring-white/10 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ====== Header (teaser + actions) ====== */}
        <div className="relative w-full aspect-video bg-black">
          {/* image base */}
          <img
            src={bg}
            alt={course.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
          {/* teaser au-dessus */}
          {teaser ? <TeaserLayer src={teaser} poster={bg} muted={muted} /> : null}

          {/* gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

          {/* fermer */}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 grid place-items-center"
          >
            ✕
          </button>

          {/* mute/unmute */}
          {teaser ? (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-pressed={!muted}
              aria-label={muted ? "Activer le son" : "Couper le son"}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20
                         h-10 w-10 md:h-12 md:w-12 grid place-items-center
                         rounded-full bg-black/60 hover:bg-black/80 ring-1 ring-white/20"
            >
              {muted ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M5 15v-6h4l5-4v14l-5-4H5zM17.7 8.3l1.4 1.4-1.3 1.3 1.3 1.3-1.4 1.4-1.3-1.3-1.3 1.3-1.4-1.4 1.3-1.3-1.3-1.3 1.4-1.4 1.3 1.3 1.3-1.3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M5 15v-6h4l5-4v14l-5-4H5zM19 12a5 5 0 0 0-2.2-4.1l1.2-1.6A7 7 0 0 1 21 12a7 7 0 0 1-3 5.7l-1.2-1.6A5 5 0 0 0 19 12z" />
                </svg>
              )}
            </button>
          ) : null}

          {/* Titre + actions */}
          <div className="absolute bottom-5 left-5 right-5">
            <h1 className="text-3xl md:text-5xl font-extrabold drop-shadow">{course.title}</h1>
            {course.synopsis ? (
              <p className="mt-2 max-w-3xl text-sm md:text-base opacity-90">{course.synopsis}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {!ownedCurrent && (
                <button
                  onClick={buy}
                  className="px-5 py-2 rounded bg-white text-black hover:bg-neutral-200 font-semibold"
                >
                  Acheter maintenant — {(course.price_cents / 100).toFixed(2)} €
                </button>
              )}
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

        {/* ====== Corps (déroulant) ====== */}
        <div className="bg-[#141414]">
          {/* bloc infos */}
          <div className="px-5 md:px-6 py-5 grid md:grid-cols-[2fr,1fr] gap-6">
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <h3 className="text-lg font-semibold">À propos</h3>
              <p className="opacity-90 mt-2">{course.description}</p>

              <h4 className="mt-5 text-sm font-semibold opacity-90">Épisodes</h4>
              <ul className="mt-2 space-y-1 text-sm opacity-90">
                {course.lessons.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 bg-white/5"
                  >
                    <div className="truncate">
                      <span className="opacity-70 mr-2">{l.order}.</span>
                      {l.title}
                      {l.is_free_preview && (
                        <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-white/10">
                          Preview
                        </span>
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

          {/* Bandes-annonces et plus — EN CARTES */}
          {extras.length ? (
            <div className="px-5 md:px-6 pb-6">
              <h3 className="text-lg font-semibold mb-3">Bandes-annonces et plus</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {extras.map((it) => (
                  <div key={it.id} className="rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10">
                    {playingId === it.id ? (
                      <video
                        src={it.src}
                        controls
                        playsInline
                        autoPlay
                        className="w-full aspect-video object-cover"
                        onEnded={() => setPlayingId(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPlayingId(it.id)}
                        className="relative w-full text-left"
                        aria-label={`Lire ${it.title}`}
                      >
                        <img src={it.poster} alt={it.title} className="w-full aspect-video object-cover" />
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="h-12 w-12 rounded-full bg-white/90 text-black grid place-items-center">
                            ▶
                          </span>
                        </span>
                      </button>
                    )}
                    <div className="p-3">
                      <div className="text-sm font-medium">{it.title}</div>
                      {it.meta && <div className="text-xs opacity-80 mt-1">{it.meta}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Titres similaires — toujours remplis via fallback */}
          {similar.length ? (
            <div className="px-5 md:px-6 pb-6">
              <h3 className="text-lg font-semibold mb-3">Titres similaires</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {similar.map((c) => (
                  <a
                    key={c.id}
                    href={`/course/${c.id}`}
                    className="group block rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition"
                  >
                    <div className="relative">
                      <img
                        src={(c as any).thumbnail}
                        alt={c.title}
                        className="w-full aspect-video object-cover"
                      />
                      {/* CTA acheter au survol (si non acheté) */}
                      <div className="absolute inset-x-3 bottom-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (ownedIds.has(c.id)) return;
                            void buyOther(c.id);
                          }}
                          className="text-xs px-2 py-1 rounded bg-white text-black hover:bg-neutral-200"
                        >
                          Acheter
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-medium truncate">{c.title}</div>
                      {c.synopsis ? (
                        <p className="text-xs opacity-80 mt-1 line-clamp-3 overflow-hidden">
                          {c.synopsis}
                        </p>
                      ) : null}
                      <div className="text-xs opacity-80 mt-2">
                        {(c.price_cents / 100).toFixed(2)} €
                      </div>
                    </div>
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