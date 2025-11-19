// src/pages/Player.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import type { CourseDetail, Lesson } from "../api/types";
import Navbar from "../components/Navbar";
import { useTranslation } from "react-i18next";
import CourseModal from "../components/CourseModal";
import { useAuth } from "../store/auth";
import MobileTabbar from "../components/MobileTabbar"; // ✅ NEW

type DocLite = { id: number; title: string; file: string };

// Recommandations (lite)
type RecCourse = {
  id: number;
  title: string;
  cover?: string;
  thumbnail?: string;
  image?: string;
  slug?: string | number;
  price?: number;
  ribbon?: string;
  level?: string;
  duration?: string;
};

export default function Player() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [current, setCurrent] = useState<Lesson | null>(null);

  const [resumeLessonId, setResumeLessonId] = useState<number | null>(null);
  const [resumePos, setResumePos] = useState<number>(0);

  const [enrolled, setEnrolled] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [certUrl, setCertUrl] = useState("");
  const [certBusy, setCertBusy] = useState(false);
  const [certMsg, setCertMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSentRef = useRef<number>(0);
  const resumeAppliedRef = useRef<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  // --- Viewer PDF mobile ---
  const [docViewer, setDocViewer] = useState<DocLite | null>(null);

  // --- Recommandations ---
  const [recsRaw, setRecsRaw] = useState<RecCourse[]>([]);
  const [recOpen, setRecOpen] = useState(true);
  const [recLoading, setRecLoading] = useState(true);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());

  // --- Modal d’info (même logique que Home) ---
  const [modalCourseId, setModalCourseId] = useState<number | null>(null);

  // Helpers
  const isMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width: 767px)").matches;

  const clickNewTab = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sanitizeFilename = (name: string) =>
    name
      .trim()
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 80);

  const filenameFromCD = (cd: string | null, fallback: string) => {
    if (!cd) return fallback;
    const star = /filename\*=(?:UTF-8''|)([^;]+)/i.exec(cd);
    if (star?.[1]) return decodeURIComponent(star[1].replace(/['"]/g, ""));
    const simple = /filename="?([^";]+)"?/i.exec(cd);
    if (simple?.[1]) return simple[1];
    return fallback;
  };

  const openDoc = (doc: DocLite) => {
    client.post(`/learning/documents/${doc.id}/track/`).catch(() => {});
    if (isMobile()) setDocViewer(doc);
    else clickNewTab(doc.file);
  };

  const downloadDoc = async (doc: DocLite) => {
    client.post(`/learning/documents/${doc.id}/track/`).catch(() => {});
    const safeName = sanitizeFilename(doc.title || "document") + ".pdf";
    try {
      const res = await fetch(doc.file, { credentials: "include" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromCD(res.headers.get("content-disposition"), safeName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      const a = document.createElement("a");
      a.href = doc.file;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  useEffect(() => {
    if (!id) return;
    client.get(`/catalog/courses/${id}/`).then((res) => {
      const c: CourseDetail = res.data;
      setCourse(c);
      setCurrent(c.lessons[0] ?? null);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    client
      .get("/learning/my-library/")
      .then((r) => {
        const arr = (r.data as any[]) || [];
        const owned = new Set<number>(
          arr
            .map((e: any) => Number(e?.course?.id ?? e?.id))
            .filter((n: any) => Number.isFinite(n))
        );
        setOwnedIds(owned);
        const ok = arr.some((e: any) => Number(e?.course?.id) === Number(id));
        setEnrolled(ok);
      })
      .catch(() => {
        setEnrolled(false);
        setOwnedIds(new Set());
      });
  }, [id]);

  useEffect(() => {
    if (!id || !enrolled) {
      setCertUrl("");
      return;
    }
    client
      .get(`/certificates/${id}/mine/`)
      .then((r) => setCertUrl(r.data.url))
      .catch(() => setCertUrl(""));
  }, [id, enrolled]);

  useEffect(() => {
    if (!id || !enrolled) {
      setHasQuiz(false);
      return;
    }
    client
      .get(`/quizzes/${id}/`)
      .then(() => setHasQuiz(true))
      .catch(() => setHasQuiz(false));
  }, [id, enrolled]);

  useEffect(() => {
    if (!id) return;
    client
      .get("/learning/continue-watching/")
      .then((r) => {
        const entry = (r.data as any[]).find((x) => x.course.id === Number(id));
        if (entry) {
          setResumeLessonId(entry.resume_lesson_id ?? null);
          setResumePos(entry.resume_position_seconds ?? 0);
          resumeAppliedRef.current = false;
        }
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!course || !resumeLessonId) return;
    const found = course.lessons.find((l) => l.id === resumeLessonId);
    if (found) setCurrent(found);
  }, [course, resumeLessonId]);

  const applyResumeIfReady = () => {
    const v = videoRef.current;
    if (!v || !current) return false;
    if (!resumeLessonId || current.id !== resumeLessonId || resumePos <= 0) return false;

    const haveMeta = v.readyState >= 1;
    const dur = Math.floor(v.duration || 0);
    const target = dur > 0 ? Math.min(Math.max(resumePos, 0), dur) : resumePos;

    if (haveMeta) {
      try {
        if (!v.paused) v.pause();
      } catch {}
      v.currentTime = target;
      const p = v.play();
      if (p && typeof p.then === "function") p.catch(() => {});
      resumeAppliedRef.current = true;
      return true;
    }
    return false;
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current) return;

    if (!resumeAppliedRef.current) {
      const ok = applyResumeIfReady();
      if (ok) return;
    }

    const onMeta = () => {
      if (!resumeAppliedRef.current) applyResumeIfReady();
    };
    const onCanPlay = () => {
      if (!resumeAppliedRef.current) applyResumeIfReady();
    };

    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("canplay", onCanPlay);

    let tries = 0;
    const tick = () => {
      if (resumeAppliedRef.current) return;
      const ok = applyResumeIfReady();
      if (ok || tries++ > 10) return;
      setTimeout(tick, 200);
    };
    setTimeout(tick, 200);

    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("canplay", onCanPlay);
    };
  }, [current, resumeLessonId, resumePos]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current || !id) return;

    const sendProgress = async (payload: {
      position_seconds: number;
      duration_seconds: number;
      completed?: boolean;
    }) => {
      try {
        await client.patch("/learning/progress/", {
          course_id: Number(id),
          lesson_id: current.id,
          ...payload,
        });
      } catch {}
    };

    const sendNow = () => {
      const vv = videoRef.current;
      if (!vv) return;
      const pos = Math.max(0, Math.floor(vv.currentTime || 0));
      const rawDur = Number.isFinite(vv.duration) ? Math.floor(vv.duration) : 0;
      const dur = Math.max(rawDur, pos, 1);
      void sendProgress({ position_seconds: pos, duration_seconds: dur });
    };

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSentRef.current < 5000) return;
      lastSentRef.current = now;
      sendNow();
    };

    const onEnded = () => {
      const dur = Math.floor(v.duration || 0);
      void sendProgress({ position_seconds: dur, duration_seconds: dur, completed: true });
    };

    const onPause = () => sendNow();
    const onVisibility = () => {
      if (document.hidden) sendNow();
    };
    const onBeforeUnload = () => sendNow();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      if (now - lastSentRef.current >= 4900) {
        lastSentRef.current = now;
        sendNow();
      }
    }, 5000);

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    v.addEventListener("pause", onPause);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [current, id]);

  const generateCert = async () => {
    setCertMsg("");
    setCertBusy(true);
    try {
      const { data } = await client.post(`/certificates/${id}/generate/`);
      setCertUrl(data.url);
      window.open(data.url, "_blank");
    } catch {
      setCertMsg(t("cert.needQuizSuccess"));
    } finally {
      setCertBusy(false);
    }
  };

  // Charger des recommandations
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setRecLoading(true);
      try {
        const endpoints = [
          `/catalog/courses/${id}/related/`,
          `/catalog/courses/recommended/?for=${id}`,
          `/catalog/courses/?recommended_for=${id}`,
          `/catalog/courses/popular/`,
          `/catalog/courses/?ordering=-rating&limit=12`,
        ];
        let items: any[] = [];
        for (const url of endpoints) {
          try {
            const { data } = await client.get(url);
            const arr = Array.isArray(data?.results)
              ? data.results
              : Array.isArray(data)
              ? data
              : Array.isArray(data?.items)
              ? data.items
              : [];
            if (arr.length) {
              items = arr;
              break;
            }
          } catch {}
        }
        if (!items.length) {
          try {
            const { data } = await client.get(`/catalog/courses/`);
            items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
          } catch {}
        }
        const normalized: RecCourse[] = (items || [])
          .filter((x: any) => Number(x?.id) !== Number(id))
          .slice(0, 12)
          .map((x: any) => ({
            id: Number(x?.id),
            title: String(x?.title ?? x?.name ?? "Formation"),
            cover: x?.cover ?? x?.thumbnail ?? x?.image ?? x?.poster ?? "",
            slug: x?.slug ?? x?.id,
            price: typeof x?.price === "number" ? x.price : Number(x?.price ?? 0) || undefined,
            level: x?.level ?? x?.category ?? "",
            duration: x?.duration ?? x?.total_duration ?? "",
            ribbon: x?.ribbon ?? (x?.is_new ? "Nouveau" : x?.bestseller ? "Best-Seller" : ""),
          }));
        if (!cancelled) setRecsRaw(normalized);
      } finally {
        if (!cancelled) setRecLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Recs visibles = recsRaw – cours actuel – possédés
  const visibleRecs = useMemo(
    () => recsRaw.filter((r) => r.id !== Number(id) && !ownedIds.has(r.id)),
    [recsRaw, ownedIds, id]
  );

  if (!course || !current) return null;

  const selectLesson = (l: Lesson) => {
    setCurrent(l);
    if (resumeLessonId && l.id === resumeLessonId) {
      resumeAppliedRef.current = false;
    }
  };

  // Icônes
  const PdfIcon = ({ className = "h-6 w-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L19.5 9H15z" />
    </svg>
  );
  const ExternalIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M14 3h7v7h-2V6.4l-7.6 7.6-1.4-1.4L17.6 5H14V3zM5 5h7v2H7v10h10v-5h2v7H5V5z"/>
    </svg>
  );
  const DownloadIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5 20h14v-2H5v2zM11 4h2v7h3l-4 4-4-4h3V4z"/>
    </svg>
  );

  /*** === Fonctions IDENTIQUES à Home pour les mini-cards === ***/
  const buyCourse = async (courseId: number) => {
    if (!token) {
      alert(t("alerts.loginToBuy"));
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: courseId });
    window.location.href = data.checkout_url;
  };

  const openInfoIfNotOwned = (c: { id: number }) => {
    if (ownedIds.has(c.id)) return;
    if (isMobile()) {
      navigate(`/info/${c.id}`);
    } else {
      setModalCourseId(c.id);
    }
  };
  /*** ======================================================== ***/

  return (
    <div
      className="bg-black min-h-screen text-white relative overflow-x-hidden"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }} // ✅ espace pour la MobileTabbar
    >
      <Navbar />

      {/* BACKDROP */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0b0b0b] to-black" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-[80vw] max-w-5xl rounded-full blur-3xl opacity-30 bg-red-600/20" />
      </div>

      {/* Barre méta — masquée en mobile */}
      <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 lg:px-6 pt-[88px]">
        <div className="hidden md:flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-white/60">
              {t("player.nowPlaying", { defaultValue: "Lecture en cours" })}
            </div>
            <h1 className="text-lg sm:text-2xl font-bold truncate">{course.title}</h1>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {Array.isArray(course.lessons) && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                {course.lessons.length} {t("player.lessons", { defaultValue: "leçons" })}
              </span>
            )}
            {hasQuiz && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 ring-1 ring-white/10">Quiz</span>
            )}
            {certUrl && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                {t("player.certificate", { defaultValue: "Certificat" })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* GRID PRINCIPALE */}
      <div className="grid md:grid-cols-[4fr,1fr] xl:grid-cols-[5fr,1fr] 2xl:grid-cols-[6fr,1fr] gap-4 md:gap-6 max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 lg:px-6 pb-6 md:pb-10">
        {/* VIDEO */}
        <div className="relative md:mx-0 w-full min-w-0">
          <div
            className="mx-auto w-full md:px-0 px-3 box-border"
            style={{
              paddingLeft: "max(env(safe-area-inset-left), 12px)",
              paddingRight: "max(env(safe-area-inset-right), 12px)",
            }}
          >
            <div className="relative w-full max-w-full aspect-[16/9] md:aspect-auto rounded-xl overflow-hidden bg-black">
              <video
                key={current.id}
                ref={videoRef}
                src={current.video_src}
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-contain md:static md:w-full md:h-auto md:rounded-xl"
              />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent hidden md:block rounded-t-xl" />
        </div>

        {/* SIDEBAR */}
        <div>
          <div className="space-y-4 md:space-y-6 md:sticky md:top-[96px]">
            {/* LEÇONS */}
            <section className="bg-white/5 rounded-2xl ring-1 ring-white/10 p-3 md:p-3">
              <div className="px-1 py-1.5">
                <h3 className="font-semibold">{t("player.lessons", { defaultValue: "Leçons" })}</h3>
              </div>
              <div className="mt-2 max-h-none md:max-h-[56vh] overflow-visible md:overflow-auto pr-0 md:pr-1">
                <div className="space-y-1.5">
                  {course.lessons.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => selectLesson(l)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-start gap-2 ${
                        current.id === l.id ? "bg-white/20" : "bg-white/0 hover:bg-white/10"
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                          current.id === l.id ? "bg-white text-black" : "bg-white/10 ring-1 ring-white/20"
                        }`}
                      >
                        {l.order}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{l.title}</span>
                        {resumeLessonId === l.id && resumePos > 0 && (
                          <span className="mt-0.5 inline-block text-[11px] opacity-80">
                            {t("player.resumeAt", { time: formatTime(resumePos) })}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* DOCUMENTS */}
            <section className="bg-white/5 rounded-2xl ring-1 ring-white/10 p-3 md:p-4">
              <div className="font-semibold flex items-center gap-2">
                {t("player.documents")}
                {Array.isArray(course.documents) && course.documents.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/10">
                    {course.documents.length} PDF
                  </span>
                )}
              </div>

              {(!course.documents || course.documents.length === 0) ? (
                <p className="text-sm opacity-70 mt-2">
                  {t("player.noDocuments", { defaultValue: "Aucun document disponible." })}
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {course.documents.map((d) => (
                    <div
                      key={d.id}
                      className="group flex items-center gap-3 rounded-xl bg-white/5 ring-1 ring-white/10 p-3 hover:bg-white/8 hover:ring-white/20 transition overflow-hidden"
                    >
                      <div className="shrink-0 h-10 w-8 rounded-md bg-red-600/90 text-white grid place-items-center shadow">
                        <PdfIcon className="h-5 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate break-all" title={d.title}>
                          {d.title || t("player.documents", { defaultValue: "Document" })}
                        </div>
                        <div className="text-xs opacity-60 mt-0.5">PDF • Ressource du cours</div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openDoc(d as unknown as DocLite)}
                          className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-white text-black font-semibold hover:bg-neutral-200 transition"
                          aria-label={t("courseInfo.open", { defaultValue: "Ouvrir" })}
                          title={t("courseInfo.open", { defaultValue: "Ouvrir" }) as string}
                        >
                          <ExternalIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">
                            {t("courseInfo.open", { defaultValue: "Ouvrir" })}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDoc(d as unknown as DocLite)}
                          className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15 transition"
                          aria-label={t("courseInfo.download", { defaultValue: "Télécharger" })}
                          title={t("courseInfo.download", { defaultValue: "Télécharger" }) as string}
                        >
                          <DownloadIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">
                            {t("courseInfo.download", { defaultValue: "Télécharger" })}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* QUIZ & CERTIFICAT */}
            {enrolled && hasQuiz && (
              <section className="bg-white/5 rounded-2xl ring-1 ring-white/10 p-3 md:p-4">
                <div className="font-semibold">{t("player.quizCert")}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/quiz/${id}`}
                    className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 ring-1 ring-white/10"
                  >
                    {t("player.takeQuiz")}
                  </Link>

                  {certUrl ? (
                    <a
                      href={certUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-md bg_WHITE/10 hover:bg_WHITE/20 ring-1 ring_WHITE/10"
                    >
                      {t("player.viewCertificate")}
                    </a>
                  ) : (
                    <button
                      onClick={generateCert}
                      disabled={certBusy}
                      className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 ring-1 ring-white/10 disabled:opacity-50"
                    >
                      {t("player.getCertificate")}
                    </button>
                  )}
                </div>
                {certMsg && <p className="text-sm opacity-80 mt-2">{certMsg}</p>}
              </section>
            )}
          </div>
        </div>
      </div>

      {/* --- RECOMMANDATIONS (déplié/repliable) --- */}
      <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 lg:px-6 pb-10">
        <div className="bg-white/5 rounded-2xl ring-1 ring-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setRecOpen((v) => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {t("player.recommended", { defaultValue: "Formations qui pourraient vous plaire" })}
              </span>
              {visibleRecs.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/10">
                  {visibleRecs.length}
                </span>
              )}
            </div>
            <span
              aria-hidden
              className={`ml-2 inline-block transition-transform ${recOpen ? "rotate-180" : ""}`}
            >
              ⌃
            </span>
          </button>

          {recOpen && (
            <div className="px-3 pb-4">
              {recLoading ? (
                <div className="p-4 text-sm opacity-70">{t("common.loading", { defaultValue: "Chargement..." })}</div>
              ) : visibleRecs.length === 0 ? (
                <div className="p-4 text-sm opacity-70">
                  {t("player.noRecs", { defaultValue: "Aucune recommandation pour le moment." })}
                </div>
              ) : (
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                  <ul className="flex gap-3 md:gap-4 pr-2 snap-x snap-mandatory">
                    {visibleRecs.map((r) => (
                      <li key={r.id} className="snap-start shrink-0 w-[56%] sm:w-[220px]">
                        {/* Carte */}
                        <div className="group relative rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10">
                          {/* Media */}
                          <div className="relative aspect-[16/9]">
                            {r.cover ? (
                              <img
                                src={r.cover}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                            ) : (
                              <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                                SBeauty
                              </div>
                            )}
                            {r.ribbon && (
                              <div className="absolute left-2 top-2 text-[10px] px-1.5 py-0.5 rounded bg-red-600">
                                {r.ribbon}
                              </div>
                            )}

                            {/* Overlay actions (desktop) — mêmes fonctions que Home */}
                            <div className="hidden md:flex absolute inset-0 items-end justify-center p-2 bg-black/0 group-hover:bg-black/40 transition">
                              <div className="opacity-0 group-hover:opacity-100 transition pointer-events-auto flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => buyCourse(r.id)}
                                  className="px-3 py-1.5 rounded-md bg-white text-black text-sm font-semibold"
                                >
                                  {t("actions.buy", { defaultValue: "Acheter" })}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openInfoIfNotOwned({ id: r.id })}
                                  className="px-3 py-1.5 rounded-md bg-white/10 ring-1 ring-white/20 text-sm"
                                >
                                  {t("actions.info", { defaultValue: "Info" })}
                                </button>
                              </div>
                            </div>

                            {/* Mobile : tap = même règle que Home → /info/:id */}
                            <button
                              type="button"
                              onClick={() => openInfoIfNotOwned({ id: r.id })}
                              className="md:hidden absolute inset-0"
                              aria-label={`Voir ${r.title}`}
                            />
                          </div>

                          {/* Infos */}
                          <div className="p-2">
                            <div className="text-sm font-medium truncate break-all">{r.title}</div>
                            <div className="text-[11px] opacity-70">
                              {[r.level, r.duration].filter(Boolean).join(" • ")}
                              {typeof r.price === "number" ? ` • ${r.price}€` : ""}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Bottom-sheet PDF (mobile) ---------- */}
      {docViewer && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setDocViewer(null)} />
          <div
            className="fixed inset-x-0 bottom-0 z-50 bg-[#0b0b0b] rounded-t-2xl ring-1 ring-white/10 overflow-hidden"
            style={{ maxHeight: "90vh" }}
          >
            {/* Titre + close */}
            <div className="p-3 flex items-center justify-between relative">
              <div className="h-1.5 w-10 rounded-full bg-white/20 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
              <div className="flex items-center gap-2 pr-8 min-w-0">
                <div className="h-7 w-6 rounded bg-red-600/90 grid place-items-center text-white">
                  <PdfIcon className="h-4 w-3" />
                </div>
                <div className="text-sm font-semibold truncate">
                  {docViewer.title || "Document PDF"}
                </div>
              </div>
              <button
                className="p-2 -mr-1 opacity-80"
                onClick={() => setDocViewer(null)}
                aria-label={t("actions.close", { defaultValue: "Fermer" })}
                title={t("actions.close", { defaultValue: "Fermer" }) as string}
              >
                ✕
              </button>
            </div>

            {/* Aperçu */}
            <div className="bg-black/40">
              <object
                data={`${docViewer.file}#toolbar=1&navpanes=0&zoom=page-width`}
                type="application/pdf"
                className="w-full"
                style={{ height: "65vh" }}
              >
                <embed
                  src={`${docViewer.file}#toolbar=1&navpanes=0&zoom=page-width`}
                  type="application/pdf"
                  className="w-full"
                  style={{ height: "65vh" }}
                />
                <div className="p-4 text-center text-sm opacity-80">
                  {t("player.pdfPreviewUnavailable", {
                    defaultValue:
                      "Aperçu indisponible sur cet appareil.\nUtilisez « Ouvrir dans le navigateur » ou « Télécharger le PDF ».",
                  })}
                </div>
              </object>
            </div>

            {/* Actions */}
            <div className="p-3 grid grid-cols-2 gap-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              <button
                onClick={() => clickNewTab(docViewer.file)}
                className="h-12 rounded-md bg-white text-black font-semibold grid place-items-center"
              >
                🔗 {t("courseInfo.open", { defaultValue: "Ouvrir" })}
              </button>
              <button
                onClick={() => downloadDoc(docViewer)}
                className="h-12 rounded-md bg-white/10 text-white grid place-items-center ring-1 ring-white/20"
              >
                ⬇️ {t("courseInfo.download", { defaultValue: "Télécharger" })}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ---------- Modal info (desktop) comme Home ---------- */}
      {modalCourseId !== null && (
        <CourseModal courseId={modalCourseId} onClose={() => setModalCourseId(null)} />
      )}

      {/* ✅ MobileTabbar, comme sur Home */}
      <MobileTabbar />
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}