// src/pages/MobileCourseInfo.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import type { CourseDetail, CourseLite } from "../api/types";
import { useAuth } from "../store/auth";
import MobileTabbar from "../components/MobileTabbar";

/** mini teaser muet, rendu après la 1ʳᵉ frame */
function TeaserLayer({
  src,
  poster,
  muted,
  onError,
}: { src: string; poster: string; muted: boolean; onError?: () => void }) {
  const vref = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const v = vref.current;
    if (!v || !src) return;
    try {
      v.muted = true; // autoplay iOS
      // @ts-ignore
      v.defaultMuted = true;
      v.playsInline = true;
    } catch {}
    const t = setTimeout(() => {
      const p = v.play();
      if (p && typeof p.then === "function") p.catch(() => onError?.());
    }, 80);
    return () => clearTimeout(t);
  }, [src, onError]);

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
      autoPlay
      loop
      preload="auto"
      onPlaying={() => setVisible(true)}
      onWaiting={() => setVisible(false)}
      onStalled={() => setVisible(false)}
      onError={() => onError?.()}
      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ pointerEvents: "none", visibility: visible ? "visible" : "hidden" }}
      aria-hidden="true"
    />
  );
}

type TabKey = "episodes" | "similar" | "trailers";

export default function MobileCourseInfo() {
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

  // --- états pour actions rapides
  const [inList, setInList] = useState(false);
  const [listBusy, setListBusy] = useState(false);

  const [showRate, setShowRate] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const [rating, setRating] = useState<-1 | 0 | 1 | 2>(0); // 0 = pas encore noté

  useEffect(() => localStorage.setItem("hero_muted", muted ? "1" : "0"), [muted]);

  // charger le cours
  useEffect(() => {
    client.get(`/catalog/courses/${courseId}/`).then(r => setCourse(r.data));
  }, [courseId]);

  // statut achats + similaires + ma liste
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
          .filter(c => c.id !== courseId && !own.has(c.id))
          .map(c => {
            const cc: string[] = (c as any).categories ?? [];
            const score = cc.reduce((s, k) => (cats.has(k) ? s + 1 : s), 0);
            return { c, score };
          })
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 12)
          .map(x => x.c);

        setSimilar(picks);
      } catch {
        setSimilar([]);
      }
    };
    run();
  }, [token, course, courseId]);

  const ownedCurrent = ownedIds.has(courseId);

  // actions
  const buy = async () => {
    if (!token) { alert("Connecte-toi pour acheter"); return; }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: courseId });
    window.location.href = data.checkout_url;
  };
  const play = () => nav(`/player/${courseId}`);

  // ---- Ma liste (toggle)
  const toggleList = async () => {
    if (!token) { nav("/signin"); return; }
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
      // on revient à l'état précédent en cas d'erreur
      setInList(prev => !prev);
    } finally {
      setListBusy(false);
    }
  };

  // ---- Évaluer
  const sendRating = async (val: -1 | 1 | 2) => {
    if (!token) { nav("/signin"); return; }
    setRateBusy(true);
    setRating(val); // optimiste
    try {
      // adapte si ton API est ailleurs (ex: /learning/rate/)
      await client.post("/catalog/rate/", { course_id: courseId, value: val });
    } catch {
      // ignore erreur côté UI
    } finally {
      setRateBusy(false);
      setShowRate(false);
    }
  };

  // ---- Partager
  const share = async () => {
    const url = `${window.location.origin}/info/${courseId}`;
    const title = course?.title || "Eduflix";
    const text = course?.synopsis || "";
    try {
      // @ts-ignore
      if (navigator.share) {
        // @ts-ignore
        await navigator.share({ title, text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert("Lien copié dans le presse-papiers");
      } else {
        prompt("Copiez ce lien :", url);
      }
    } catch {}
  };

  // helpers
  const totalMinutes = useMemo(() => {
    if (!course) return 0;
    return Math.round((course.lessons ?? []).reduce((s, l) => s + (l.duration_seconds || 0), 0) / 60);
  }, [course]);

  if (!course) return null;

  const bg = course.hero_banner || course.thumbnail;
  const teaser = course.trailer_src || course.trailer_url || "";

  // composant onglet "bouton"
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

  // petites icônes
  const IconThumbDown = (p: any) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...p}>
      <path d="M2 10h4v10H2zM22 11c0-1.1-.9-2-2-2h-6l1-4c.1-.3 0-.6-.2-.9-.3-.5-.8-.8-1.4-.8H13c-.5 0-1 .2-1.3.6L7 8v10h10c.7 0 1.3-.4 1.7-1l3-5c.2-.3.3-.7.3-1z"/>
    </svg>
  );
  const IconThumbUp = (p: any) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...p}>
      <path d="M2 14h4V4H2zM22 13c0 1.1-.9 2-2 2h-6l1 4c.1.3 0 .6-.2.9-.3.5-.8.8-1.4.8H13c-.5 0-1-.2-1.3-.6L7 16V6h10c.7 0 1.3.4 1.7 1l3 5c.2.3.3.7.3 1z"/>
    </svg>
  );
  const IconTwoThumbs = (p: any) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" {...p}>
      <path d="M1 14h4V4H1v10zm6-8v10l4 4 2-8h6l-3-5c-.4-.6-1-.9-1.7-.9H9zm12 4v10h4V10h-4zM7 10h4l1-4-5 4z"/>
    </svg>
  );

  return (
    <div
      className="relative min-h-dvh bg-black text-white"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* zone video/top */}
      <div className="relative w-full aspect-video bg-black">
        <img src={bg} alt={course.title} className="absolute inset-0 w-full h-full object-cover" />
        {teaser ? <TeaserLayer src={teaser} poster={bg} muted={muted} /> : null}

        {/* close + mute */}
        <button
          onClick={() => nav(-1)}
          aria-label="Fermer"
          className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+8px)] h-10 w-10 grid place-items-center rounded-full bg-black/60 ring-1 ring-white/20"
        >
          ✕
        </button>
        {teaser ? (
          <button
            onClick={() => setMuted(m => !m)}
            aria-label={muted ? "Activer le son" : "Couper le son"}
            className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+56px)] h-10 w-10 grid place-items-center rounded-full bg-black/60 ring-1 ring-white/20"
          >
            {muted ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M5 15v-6h4l5-4v14l-5-4H5zM17.7 8.3l1.4 1.4-1.3 1.3 1.3 1.3-1.4 1.4-1.3-1.3-1.3 1.3-1.4-1.4 1.3-1.3-1.3-1.3 1.4-1.4 1.3 1.3 1.3-1.3z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M5 15v-6h4l5-4v14l-5-4H5zM19 12a5 5 0 0 0-2.2-4.1l1.2-1.6A7 7 0 0 1 21 12a7 7 0 0 1-3 5.7l-1.2-1.6A5 5 0 0 0 19 12z"/></svg>
            )}
          </button>
        ) : null}
      </div>

      {/* contenu entête */}
      <div className="px-4 py-4 space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">{course.title}</h1>
          <div className="mt-1 text-sm opacity-80">
            {course.created_at ? new Date(course.created_at).getFullYear() : ""} • {totalMinutes ? `~${totalMinutes} min` : ""}
          </div>
        </div>

        {/* CTA principal */}
        <div className="space-y-2">
          {ownedCurrent ? (
            <button
              onClick={play}
              className="w-full h-12 rounded-md bg-white text-black font-semibold grid place-items-center"
            >
              ▶︎ Lecture
            </button>
          ) : (
            <button
              onClick={buy}
              className="w-full h-12 rounded-md bg-white text-black font-semibold grid place-items-center"
            >
              Acheter — {(course.price_cents / 100).toFixed(2)} €
            </button>
          )}
          <button
            onClick={() => alert("Fonction ‘Télécharger’ à implémenter si besoin")}
            className="w-full h-12 rounded-md bg-white/10 text-white grid place-items-center"
          >
            ⤓ Télécharger {course.lessons?.length ? `S1:E1` : ""}
          </button>
        </div>

        {/* description courte */}
        {course.description && (
          <p className="text-[15px] leading-relaxed opacity-90">{course.description}</p>
        )}

        {/* actions rapides */}
        <div className="relative">
          <div className="grid grid-cols-3 gap-4 text-center text-sm py-2">
            {/* Ma liste */}
            <button
              onClick={toggleList}
              className={`opacity-90 ${listBusy ? "pointer-events-none opacity-50" : ""}`}
              aria-pressed={inList}
            >
              {inList ? "✓" : "➕"}
              <div className="mt-1 opacity-80">{inList ? "Dans ma liste" : "Ma liste"}</div>
            </button>

            {/* Évaluer (ouvre le popover) */}
            <button onClick={() => setShowRate(v => !v)} className="opacity-90">
              👍
              <div className="mt-1 opacity-80">{rating === 0 ? "Évaluer" : rating === -1 ? "Pas pour moi" : rating === 1 ? "J’aime bien" : "J’adore !"}</div>
            </button>

            {/* Partager */}
            <button onClick={share} className="opacity-90">
              ✈︎
              <div className="mt-1 opacity-80">Partager</div>
            </button>
          </div>

          {/* Popover Évaluer */}
          {showRate && (
            <>
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-1 bg-white/10 text-white rounded-3xl px-4 py-3
                           shadow-2xl ring-1 ring-white/15 backdrop-blur-md
                           animate-[pop_.18s_ease-out]"
                style={{ transformOrigin: "bottom center" }}
              >
                <div className="flex items-center gap-6">
                  <button
                    disabled={rateBusy}
                    onClick={() => sendRating(-1)}
                    className={`flex flex-col items-center ${rating === -1 ? "text-red-400" : ""}`}
                  >
                    <IconThumbDown />
                    <span className="text-[12px] mt-1">Pas pour moi</span>
                  </button>
                  <button
                    disabled={rateBusy}
                    onClick={() => sendRating(1)}
                    className={`flex flex-col items-center ${rating === 1 ? "text-green-400" : ""}`}
                  >
                    <IconThumbUp />
                    <span className="text-[12px] mt-1">J'aime bien</span>
                  </button>
                  <button
                    disabled={rateBusy}
                    onClick={() => sendRating(2)}
                    className={`flex flex-col items-center ${rating === 2 ? "text-yellow-300" : ""}`}
                  >
                    <IconTwoThumbs />
                    <span className="text-[12px] mt-1">J'adore !</span>
                  </button>
                </div>
              </div>
              {/* click-away */}
              <div className="fixed inset-0 z-10" onClick={() => !rateBusy && setShowRate(false)} />
            </>
          )}
        </div>
      </div>

      {/* --- ONGLET STICKY --- */}
      <div
        className="sticky z-30 bg-black border-t border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
        role="tablist"
        aria-label="Sections du cours"
      >
        <div className="flex gap-2 px-2">
          <TabBtn k="episodes" label="Épisodes" />
          <TabBtn k="similar" label="Titres similaires" />
          <TabBtn k="trailers" label="Bandes-annonces" />
        </div>
        <div className="h-[1px] bg-white/10" />
      </div>

      {/* --- CONTENU ONGLET --- */}
      <div className="px-4 py-4 space-y-4">
        {tab === "episodes" && (
          <>
            {course.lessons?.length ? (
              <div className="space-y-2">
                {course.lessons.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                    <div className="w-[112px] aspect-video bg-black/30 rounded overflow-hidden" />
                    <div className="flex-1">
                      <div className="font-medium">
                        {l.order}. {l.title}
                      </div>
                      <div className="text-xs opacity-70">
                        {l.duration_seconds ? `${Math.floor(l.duration_seconds / 60)} min` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => ownedCurrent ? nav(`/player/${courseId}?l=${l.id}`) : buy()}
                      className="text-sm px-3 py-1 rounded bg-white text-black"
                    >
                      {ownedCurrent ? "Lecture" : "Acheter"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="opacity-80">Aucun épisode disponible.</p>
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
                    <img src={(c as any).thumbnail} alt={c.title} className="w-full aspect-video object-cover" />
                    <div className="p-2">
                      <div className="text-sm font-medium line-clamp-1">{c.title}</div>
                      <div className="text-xs opacity-80 mt-1">{(c.price_cents / 100).toFixed(2)} €</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="opacity-80">Aucune recommandation pour le moment.</p>
            )}
          </>
        )}

        {tab === "trailers" && (
          <>
            {teaser ? (
              <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-black/40">
                <video src={teaser} controls playsInline className="w-full" poster={bg} />
              </div>
            ) : (
              <p className="opacity-80">Pas de bande-annonce disponible.</p>
            )}
          </>
        )}
      </div>

      <MobileTabbar />
    </div>
  );
}

/* petite anim pour le popover */
declare global {
  interface CSSStyleDeclaration {
    // nothing, just to avoid TS warning in some setups
  }
}
// Ajoute dans ton CSS global si tu veux (ou garde ici en CSS-in-JS via Tailwind utilities)
// @keyframes pop { from { transform: translate(-50%, 0) scale(.95); opacity:.0 } to { transform: translate(-50%, 0) scale(1); opacity:1 } }