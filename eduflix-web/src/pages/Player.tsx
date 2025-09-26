// src/pages/Player.tsx
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import type { CourseDetail, Lesson } from "../api/types";
import Navbar from "../components/Navbar";
import { useTranslation } from "react-i18next";

export default function Player() {
  const { t } = useTranslation();
  const { id } = useParams();

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

  const handleDocDownload = async (docId: number, url: string) => {
    try { await client.post(`/learning/documents/${docId}/track/`); } catch {}
    window.open(url, "_blank");
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
    client.get("/learning/my-library/")
      .then((r) => {
        const ok = (r.data as any[]).some((e: any) => e.course.id === Number(id));
        setEnrolled(ok);
      })
      .catch(() => setEnrolled(false));
  }, [id]);

  useEffect(() => {
    if (!id || !enrolled) { setCertUrl(""); return; }
    client.get(`/certificates/${id}/mine/`)
      .then((r) => setCertUrl(r.data.url))
      .catch(() => setCertUrl(""));
  }, [id, enrolled]);

  useEffect(() => {
    if (!id || !enrolled) { setHasQuiz(false); return; }
    client.get(`/quizzes/${id}/`)
      .then(() => setHasQuiz(true))
      .catch(() => setHasQuiz(false));
  }, [id, enrolled]);

  useEffect(() => {
    if (!id) return;
    client.get("/learning/continue-watching/")
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
      try { if (!v.paused) v.pause(); } catch {}
      v.currentTime = target;
      const p = v.play();
      if (p && typeof p.then === "function") { p.catch(() => {}); }
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

    const onMeta = () => { if (!resumeAppliedRef.current) applyResumeIfReady(); };
    const onCanPlay = () => { if (!resumeAppliedRef.current) applyResumeIfReady(); };

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
    const onVisibility = () => { if (document.hidden) sendNow(); };
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
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
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

  if (!course || !current) return null;

  const selectLesson = (l: Lesson) => {
    setCurrent(l);
    if (resumeLessonId && l.id === resumeLessonId) {
      resumeAppliedRef.current = false;
    }
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <div className="grid md:grid-cols-[2fr,1fr] gap-6 max-w-7xl mx-auto px-4 pt-[88px] pb-6">
        <div>
          <video
            key={current.id}
            ref={videoRef}
            src={current.video_src}
            controls
            autoPlay
            muted
            playsInline
            preload="metadata"
            className="w-full rounded-xl"
          />
        </div>

        <div>
          <h2 className="font-semibold mb-3">{course.title}</h2>

          <div className="space-y-2">
            {course.lessons.map((l) => (
              <button
                key={l.id}
                onClick={() => selectLesson(l)}
                className={`w-full text-left px-3 py-2 rounded ${
                  current.id === l.id ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {l.order}. {l.title}
                {resumeLessonId === l.id && resumePos > 0 && (
                  <span className="ml-2 text-xs opacity-80">
                    · {t("player.resumeAt", { time: formatTime(resumePos) })}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <div className="font-semibold">{t("player.documents")}</div>
            <ul className="text-sm opacity-90 mt-2 space-y-1">
              {course.documents.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => handleDocDownload(d.id, d.file)}
                    className="underline hover:opacity-80"
                  >
                    • {d.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {enrolled && hasQuiz && (
            <div className="mt-6">
              <div className="font-semibold">{t("player.quizCert")}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to={`/quiz/${id}`} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20">
                  {t("player.takeQuiz")}
                </Link>

                {certUrl ? (
                  <a href={certUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded bg-white/10 hover:bg-white/20">
                    {t("player.viewCertificate")}
                  </a>
                ) : (
                  <button
                    onClick={generateCert}
                    disabled={certBusy}
                    className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50"
                  >
                    {t("player.getCertificate")}
                  </button>
                )}
              </div>
              {certMsg && <p className="text-sm opacity-80 mt-2">{certMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}