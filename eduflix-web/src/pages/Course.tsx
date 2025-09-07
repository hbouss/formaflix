// src/pages/Course.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client";
import type { CourseDetail } from "../api/types";
import Navbar from "../components/Navbar";
import { useAuth } from "../store/auth";

export default function Course() {
  const { id } = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const { token } = useAuth();

  // --- Ma liste (favoris)
  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);

  // Charger le cours
  useEffect(() => {
    if (!id) return;
    client.get(`/catalog/courses/${id}/`).then((res) => setCourse(res.data));
  }, [id]);

  // Vérifier si le cours est déjà dans "Ma liste" (seulement si connecté)
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

  // Achat (Stripe)
  const buy = async () => {
    if (!token) {
      alert("Connecte-toi pour acheter");
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", {
      course_id: Number(id),
    });
    window.location.href = data.checkout_url;
  };

  // Ajouter/retirer de "Ma liste"
  const toggleList = async () => {
    if (!token) {
      alert("Connecte-toi pour utiliser Ma liste");
      return;
    }
    setBusy(true);
    try {
      if (inList) {
        await client.delete("/learning/my-list/", {
          data: { course_id: Number(id) },
        });
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

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[2fr,1fr] gap-6">
          <div>
            <img
              src={course.hero_banner || course.thumbnail}
              className="w-full rounded-xl"
            />
            <h1 className="text-3xl font-bold mt-4">{course.title}</h1>
            <p className="opacity-90 mt-2">{course.description}</p>

            <h3 className="mt-6 font-semibold">Contenu</h3>
            <ul className="mt-2 space-y-1 text-sm opacity-90">
              {course.lessons.map((l) => (
                <li key={l.id}>
                  {l.order}. {l.title}{" "}
                  {l.is_free_preview && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white/10">
                      Preview
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl p-4 bg-white/5 h-max">
            <div className="text-2xl font-bold">
              {(course.price_cents / 100).toFixed(2)} €
            </div>

            <button
              onClick={buy}
              className="mt-4 w-full px-4 py-2 rounded bg-white text-black hover:bg-neutral-200"
            >
              Acheter maintenant
            </button>

            {/* Bouton Ma liste */}
            <button
              onClick={toggleList}
              disabled={busy}
              className="mt-2 w-full px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50"
            >
              {inList ? "Retirer de Ma liste" : "Ajouter à Ma liste"}
            </button>

            <video
              src={course.trailer_src}
              muted
              controls
              className="mt-4 w-full rounded"
            />

            <div className="mt-4">
              <div className="text-sm opacity-80">Documents inclus:</div>
              <ul className="text-sm">
                {course.documents.map((d) => (
                  <li key={d.id}>{d.title}</li>
                ))}
              </ul>
              {/* ❌ plus aucun lien Quiz/Certificat ici — accessible seulement depuis le Player */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}