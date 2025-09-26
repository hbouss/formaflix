// src/pages/Course.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import type { CourseDetail } from "../api/types";
import Navbar from "../components/Navbar";
import { useAuth } from "../store/auth";
import { useTranslation } from "react-i18next";

export default function Course() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const { token } = useAuth();

  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    client.get(`/catalog/courses/${id}/`).then((res) => setCourse(res.data));
  }, [id]);

  useEffect(() => {
    if (!id || !token) return;
    client
      .get("/learning/my-list/")
      .then((r) => {
        const ids = (r.data as any[]).map((f: any) => f.course.id);
        setInList(ids.includes(Number(id)));
      })
      .catch(() => {});
  }, [id, token]);

  const buy = async () => {
    if (!token) {
      alert(t("alerts.loginToBuy"));
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", {
      course_id: Number(id),
    });
    window.location.href = data.checkout_url;
  };

  const toggleList = async () => {
    if (!token) {
      alert(t("alerts.loginToUseList"));
      return;
    }
    setBusy(true);
    try {
      if (inList) {
        await client.delete("/learning/my-list/", { data: { course_id: Number(id) } });
        setInList(false);
      } else {
        await client.post("/learning/my-list/", { course_id: Number(id) });
        setInList(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!course) return null;

  const price = new Intl.NumberFormat(i18n.language, {
    style: "currency",
    currency: (course.currency || "EUR").toUpperCase(),
  }).format(course.price_cents / 100);

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />

      {/* Hero */}
      <div className="relative w-full aspect-video bg-black">
        {course.trailer_src ? (
          <video src={course.trailer_src} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <img src={course.hero_banner || course.thumbnail} className="absolute inset-0 w-full h-full object-cover" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

        <button
          onClick={() => nav(-1)}
          aria-label={t("buttons.close")}
          className="absolute right-4 top-4 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 grid place-items-center"
        >
          ✕
        </button>

        <div className="absolute bottom-6 left-6 right-6 max-w-5xl">
          <h1 className="text-3xl md:text-5xl font-extrabold drop-shadow">{course.title}</h1>

          {course.synopsis && (
            <p className="mt-2 max-w-3xl text-sm md:text-base opacity-90">{course.synopsis}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={buy} className="px-5 py-2 rounded bg-white text-black hover:bg-neutral-200 font-semibold">
              {t("course.buyNow")} — {price}
            </button>
            <button
              onClick={toggleList}
              disabled={busy}
              className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50"
            >
              {inList ? t("course.removeFromList") : t("course.addToList")}
            </button>
          </div>

          {course.categories?.length > 0 && (
            <div className="mt-3 text-sm opacity-80">
              {t("course.genres")}: {course.categories.join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Détails */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="mt-6 grid md:grid-cols-[2fr,1fr] gap-6">
          <div className="rounded-2xl bg-[#141414] p-5 ring-1 ring-white/10">
            <h3 className="text-lg font-semibold">{t("course.about")}</h3>
            <p className="opacity-90 mt-2">{course.description}</p>

            <h3 className="mt-6 text-lg font-semibold">{t("course.episodes")}</h3>
            <ul className="mt-2 space-y-1 text-sm opacity-90">
              {course.lessons.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-md px-3 py-2 bg-white/5">
                  <div className="truncate">
                    <span className="opacity-70 mr-2">{l.order}.</span>
                    {l.title}
                    {l.is_free_preview && (
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-white/10">
                        {t("course.preview")}
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

          <div className="rounded-2xl bg-[#141414] p-5 ring-1 ring-white/10 h-max">
            <div className="text-sm opacity-80 mb-2">{t("course.preview")}</div>
            <div className="rounded-xl overflow-hidden">
              <video src={course.trailer_src} muted controls className="w-full" />
            </div>

            <div className="mt-6">
              <div className="text-lg font-semibold">{t("course.documentsIncluded")}</div>
              <ul className="text-sm opacity-90 mt-2 space-y-1">
                {course.documents.map((d) => (
                  <li key={d.id}>• {d.title}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="h-10" />
    </div>
  );
}