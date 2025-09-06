import { useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import client from "../api/client";

export default function Success() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const sessionId = params.get("session_id") || "";
  const courseIdFromUrl = params.get("course_id");

  useEffect(() => {
    let cancelled = false;

    async function go() {
      let courseId = courseIdFromUrl;

      // On poll le backend quelques secondes pour laisser le webhook marquer la commande "paid"
      for (let i = 0; i < 8; i++) { // ~8 * 1s = 8s
        try {
          const { data } = await client.get("/payments/session-status/", {
            params: { session_id: sessionId },
          });
          courseId = courseId || String(data.course_id || "");
          if (data.status === "paid" && courseId && !cancelled) {
            nav(`/player/${courseId}`, { replace: true });
            return;
          }
        } catch { /* ignore et ré-essaie */ }
        await new Promise(r => setTimeout(r, 1000));
      }
      // Fallback : si pas prêt, on envoie vers la bibliothèque
      if (!cancelled) nav("/library", { replace: true });
    }

    if (sessionId) go();
    else nav("/library", { replace: true });

    return () => { cancelled = true; };
  }, [sessionId, courseIdFromUrl, nav]);

  return (
    <div className="bg-[#141414] min-h-screen text-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 pt-28">
        <h1 className="text-2xl font-bold">Finalisation de l’accès…</h1>
        <p className="opacity-80 text-sm mt-2">
          On te redirige vers ton cours. Si ça prend trop de temps, va sur <Link to="/library" className="underline">Ma bibliothèque</Link>.
        </p>
      </div>
    </div>
  );
}