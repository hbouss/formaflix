import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client";
import type {CourseDetail} from "../api/types";
import Navbar from "../components/Navbar";
import { useAuth } from "../store/auth";

export default function Course() {
  const { id } = useParams();
  const [course, setCourse] = useState<CourseDetail>();
  const { token } = useAuth();

  useEffect(() => {
    client.get(`/catalog/courses/${id}/`).then(res => setCourse(res.data));
  }, [id]);

  const buy = async () => {
    if (!token) { alert("Connecte-toi pour acheter"); return; }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: Number(id) });
    window.location.href = data.checkout_url;
  };

  if (!course) return null;

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[2fr,1fr] gap-6">
          <div>
            <img src={course.hero_banner || course.thumbnail} className="w-full rounded-xl" />
            <h1 className="text-3xl font-bold mt-4">{course.title}</h1>
            <p className="opacity-90 mt-2">{course.description}</p>
            <h3 className="mt-6 font-semibold">Contenu</h3>
            <ul className="mt-2 space-y-1 text-sm opacity-90">
              {course.lessons.map(l => (
                <li key={l.id}>{l.order}. {l.title} {l.is_free_preview && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white/10">Preview</span>}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-4 bg-white/5 h-max">
            <div className="text-2xl font-bold">{(course.price_cents/100).toFixed(2)} €</div>
            <button onClick={buy} className="mt-4 w-full px-4 py-2 rounded bg-white text-black hover:bg-neutral-200">
              Acheter maintenant
            </button>
            <video src={course.trailer_src} muted controls className="mt-4 w-full rounded" />
            <div className="mt-4">
              <div className="text-sm opacity-80">Documents inclus:</div>
              <ul className="text-sm">
                {course.documents.map(d => <li key={d.id}>{d.title}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}