// src/components/CourseModal.tsx
import { useEffect, useState } from "react";
import client from "../api/client";
import type { CourseDetail } from "../api/types";
import { useAuth } from "../store/auth";

export default function CourseModal({
  courseId,
  onClose,
}: {
  courseId: number;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);

  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);

  // charger le cours
  useEffect(() => {
    client.get(`/catalog/courses/${courseId}/`).then((r) => setCourse(r.data));
  }, [courseId]);

  // savoir si déjà dans "Ma liste"
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

  // ESC pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!course) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-auto my-8 w-[95%] max-w-6xl rounded-2xl overflow-hidden ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero vidéo/image + gradients */}
        <div className="relative w-full aspect-video bg-black">
          {course.trailer_src ? (
            <video
              src={course.trailer_src}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img
              src={course.hero_banner || course.thumbnail}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 grid place-items-center"
          >
            ✕
          </button>

          <div className="absolute bottom-5 left-5 right-5">
            <h1 className="text-3xl md:text-5xl font-extrabold drop-shadow">
              {course.title}
            </h1>
            {course.synopsis && (
              <p className="mt-2 max-w-3xl text-sm md:text-base opacity-90">
                {course.synopsis}
              </p>
            )}
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
            {course.categories?.length > 0 && (
              <div className="mt-2 text-sm opacity-80">
                Genres : {course.categories.join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* Corps façon fiche Netflix */}
        <div className="bg-[#141414] p-5 md:p-6">
          <div className="grid md:grid-cols-[2fr,1fr] gap-6">
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <h3 className="text-lg font-semibold">À propos</h3>
              <p className="opacity-90 mt-2">{course.description}</p>

              <h3 className="mt-6 text-lg font-semibold">Épisodes</h3>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}