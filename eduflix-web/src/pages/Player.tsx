// src/pages/Player.tsx
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import type { CourseDetail, Lesson } from "../api/types";
import Navbar from "../components/Navbar";

export default function Player() {
  const { id } = useParams(); // course id
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [current, setCurrent] = useState<Lesson | null>(null);

  // reprise (provenant du backend /learning/continue-watching/)
  const [resumeLessonId, setResumeLessonId] = useState<number | null>(null);
  const [resumePos, setResumePos] = useState<number>(0);

  // droits & quiz
  const [enrolled, setEnrolled] = useState<boolean>(false);
  const [hasQuiz, setHasQuiz] = useState<boolean>(false);
  const [certBusy, setCertBusy] = useState(false);
  const [certMsg, setCertMsg] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSentRef = useRef<number>(0); // anti-spam (throttle) pour PATCH

  // 1) Charger le cours
  useEffect(() => {
    if (!id) return;
    client.get(`/catalog/courses/${id}/`).then((res) => {
      setCourse(res.data);
      setCurrent(res.data.lessons[0] ?? null);
    });
  }, [id]);

  // 2) Vérifier l’inscription (droits)
  useEffect(() => {
    if (!id) return;
    client
      .get("/learning/my-library/")
      .then((r) => {
        const ok = (r.data as any[]).some((e: any) => e.course.id === Number(id));
        setEnrolled(ok);
      })
      .catch(() => setEnrolled(false));
  }, [id]);

  // 3) Si inscrit, vérifier s’il y a un quiz rattaché (et y accéder seulement si inscrit)
  useEffect(() => {
    if (!id || !enrolled) { setHasQuiz(false); return; }
    client
      .get(`/quizzes/${id}/`)
      .then(() => setHasQuiz(true))
      .catch(() => setHasQuiz(false));
  }, [id, enrolled]);

  // 4) Charger l'info "continue watching" et choisir la bonne leçon si dispo
  useEffect(() => {
    if (!id) return;
    client
      .get("/learning/continue-watching/")
      .then((r) => {
        const entry = (r.data as any[]).find((x) => x.course.id === Number(id));
        if (entry) {
          setResumeLessonId(entry.resume_lesson_id ?? null);
          setResumePos(entry.resume_position_seconds ?? 0);
        }
      })
      .catch(() => {});
  }, [id]);

  // 5) Quand le cours est chargé et qu'on a une leçon à reprendre, sélectionne-la
  useEffect(() => {
    if (!course) return;
    if (resumeLessonId) {
      const found = course.lessons.find((l) => l.id === resumeLessonId);
      if (found) setCurrent(found);
    }
  }, [course, resumeLessonId]);

  // 6) Seek à la position de reprise
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current) return;
    const onLoaded = () => {
      if (resumeLessonId && current.id === resumeLessonId && resumePos > 0) {
        const target = Math.min(Math.max(resumePos, 0), Math.floor(v.duration || resumePos));
        v.currentTime = target;
      }
    };
    v.addEventListener("loadedmetadata", onLoaded);
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [current, resumeLessonId, resumePos]);

  // 7) Envoi de la progression (5s) + fin
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

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSentRef.current < 5000) return;
      lastSentRef.current = now;
      const pos = Math.floor(v.currentTime || 0);
      const dur = Math.floor(v.duration || 0);
      if (dur > 0) sendProgress({ position_seconds: pos, duration_seconds: dur });
    };

    const onEnded = () => {
      const dur = Math.floor(v.duration || 0);
      sendProgress({ position_seconds: dur, duration_seconds: dur, completed: true });
    };

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, [current, id]);

  // Générer certificat à la demande (seulement si quiz réussi)
  const generateCert = async () => {
    setCertMsg("");
    setCertBusy(true);
    try {
      const { data } = await client.post(`/certificates/${id}/generate/`);
      window.open(data.url, "_blank");
    } catch (e: any) {
      // backend renvoie 400 si pas de submission réussie
      setCertMsg("Tu dois d’abord réussir le quiz pour générer ton certificat.");
    } finally {
      setCertBusy(false);
    }
  };

  if (!course || !current) return null;

  const selectLesson = (l: Lesson) => {
    setCurrent(l);
    if (l.id !== resumeLessonId) setResumePos(0);
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <div className="grid md:grid-cols-[2fr,1fr] gap-6 max-w-7xl mx-auto px-4 py-6">
        <div>
          <video
            ref={videoRef}
            src={current.video_src}
            controls
            autoPlay
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
                    · Reprendre à {formatTime(resumePos)}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <div className="font-semibold">Documents</div>
            <ul className="text-sm opacity-90 mt-2 space-y-1">
              {course.documents.map((d) => (
                <li key={d.id}>
                  <a href={d.file} target="_blank" className="underline" rel="noreferrer">
                    • {d.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ✅ Accès Quiz & Certificat — seulement si inscrit, et affiché ICI sous les documents */}
          {enrolled && hasQuiz && (
            <div className="mt-6">
              <div className="font-semibold">Quiz & Certificat</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  to={`/quiz/${id}`}
                  className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
                >
                  Passer le quiz
                </Link>
                <button
                  onClick={generateCert}
                  disabled={certBusy}
                  className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50"
                >
                  Obtenir mon certificat
                </button>
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