import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import Navbar from "../components/Navbar";

type Quiz = {
  id: number;
  title: string;
  passing_score: number;
  questions: {
    id: number;
    text: string;
    choices: { id: number; text: string }[];
  }[];
};

export default function QuizPage() {
  const { id } = useParams(); // course id
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score_percent: number; passed: boolean } | null>(null);
  const [certUrl, setCertUrl] = useState<string>("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  // --- Chargement quiz + gestion 401 (connexion requise) ---
  useEffect(() => {
    client
      .get(`/quizzes/${id}/`)
      .then((r) => setQuiz(r.data))
      .catch((err) => {
        if (err?.response?.status === 401) setNeedsLogin(true);
      });
  }, [id]);

  // --- Métriques d’avancement ---
  const total = quiz?.questions.length ?? 0;
  const answeredCount = useMemo(() => {
    if (!quiz) return 0;
    return quiz.questions.reduce((n, q) => (answers[q.id] ? n + 1 : n), 0);
  }, [quiz, answers]);
  const progress = total ? Math.round((answeredCount / total) * 100) : 0;
  const canSubmit = total > 0 && answeredCount === total && !busy;

  if (needsLogin) {
    return (
      <div className="bg-black min-h-screen text-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-6 pt-28">
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
            <h1 className="text-2xl font-extrabold">Connexion requise</h1>
            <p className="opacity-80 mt-2">
              Connecte-toi pour accéder au quiz et à ton certificat.
            </p>
            <Link
              to="/signin"
              className="inline-block mt-4 px-4 py-2 rounded-md bg-white text-black font-semibold"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!quiz) return;
    setBusy(true);
    try {
      const payload = {
        answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v])),
      };
      const { data } = await client.post(`/quizzes/${id}/submit/`, payload);
      setResult(data);
      if (data.passed) {
        const res = await client.post(`/certificates/${id}/generate/`);
        setCertUrl(res.data.url);
      }
      // Scroll au résultat
      setTimeout(() => {
        document.getElementById("quiz-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } finally {
      setBusy(false);
    }
  };

  if (!quiz) return null;

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 pt-24 pb-32">
        {/* Header titre + badge seuil */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold">{quiz.title}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="inline-flex items-center rounded-full px-3 py-1 bg-white/10 ring-1 ring-white/10">
                Score requis&nbsp;: <span className="ml-1 font-semibold text-red-400">{quiz.passing_score}%</span>
              </span>
              <span className="opacity-70">•</span>
              <span className="opacity-80">{total} question{total > 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Progress compact desktop */}
          <div className="hidden sm:block min-w-[160px]">
            <div className="text-xs opacity-70 text-right mb-1">{progress}% complété</div>
            <div className="h-2 rounded bg-white/10 overflow-hidden">
              <div
                className="h-2 bg-red-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Progress mobile */}
        <div className="sm:hidden mt-4">
          <div className="text-xs opacity-70 mb-1">{progress}% complété</div>
          <div className="h-2 rounded bg-white/10 overflow-hidden">
            <div className="h-2 bg-red-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Liste des questions */}
        <div className="mt-8 space-y-5">
          {quiz.questions.map((q, idx) => {
            const selected = answers[q.id];
            return (
              <section
                key={q.id}
                className="rounded-2xl bg-gradient-to-t from-black/60 to-black/40 ring-1 ring-white/10 p-4 md:p-5"
              >
                {/* En-tête question */}
                <div className="flex items-start gap-3">
                  <div className="shrink-0 grid place-items-center h-8 w-8 rounded-full bg-red-600 text-white text-sm font-bold">
                    {idx + 1}
                  </div>
                  <h2 className="text-base md:text-lg font-semibold leading-snug">{q.text}</h2>
                </div>

                {/* Choix */}
                <div className="mt-4 grid gap-2">
                  {q.choices.map((ch) => {
                    const isActive = selected === ch.id;
                    return (
                      <label
                        key={ch.id}
                        className={`relative group cursor-pointer rounded-xl px-3 py-3 md:px-4 md:py-3
                                    ring-1 transition
                                    ${isActive
                                      ? "bg-white/10 ring-red-500/50 shadow-[0_0_0_2px_rgba(229,9,20,0.25)_inset]"
                                      : "bg-white/5 hover:bg-white/8 ring-white/10 hover:ring-white/20"}`}
                      >
                        <input
                          type="radio"
                          name={`q${q.id}`}
                          checked={isActive}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: ch.id }))}
                          className="peer sr-only"
                        />
                        <div className="flex items-start gap-3">
                          {/* Custom radio */}
                          <span
                            className={`mt-0.5 h-5 w-5 rounded-full border
                                        ${isActive ? "border-red-500" : "border-white/40"}
                                        grid place-items-center flex-none`}
                            aria-hidden="true"
                          >
                            <span
                              className={`h-2.5 w-2.5 rounded-full
                                          ${isActive ? "bg-red-600" : "bg-transparent"}
                                          transition`}
                            />
                          </span>
                          <span className={`text-sm md:text-[15px] ${isActive ? "font-semibold" : ""}`}>
                            {ch.text}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Bouton sticky mobile + bouton desktop */}
        <div className="mt-8 hidden sm:block">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`px-5 h-12 rounded-md font-semibold
                        ${canSubmit ? "bg-white text-black hover:bg-neutral-200" : "bg-white/10 text-white/50 cursor-not-allowed"}`}
          >
            {busy ? "Envoi…" : "Soumettre"}
          </button>
          {answeredCount < total && (
            <div className="text-sm opacity-70 mt-2">
              Réponds à toutes les questions pour activer l’envoi.
            </div>
          )}
        </div>

        {/* Panel résultat */}
        {result && (
          <div id="quiz-result" className="mt-10">
            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-lg md:text-xl font-bold">
                  Score&nbsp;: <span className="text-red-400">{result.score_percent}%</span>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-semibold
                              ${result.passed ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}
                >
                  {result.passed ? "Réussi ✅" : "Échoué ❌"}
                </div>
              </div>

              {certUrl && (
                <a
                  href={certUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={`certificat_${id}.jpg`}
                  className="mt-4 inline-flex items-center gap-2 px-4 h-11 rounded-md bg-white text-black font-semibold"
                >
                  {/* icône certificat */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L19.5 9H15z" />
                  </svg>
                  Télécharger mon certificat
                </a>
              )}
              {!result.passed && (
                <div className="text-sm opacity-80 mt-3">
                  Tu peux revoir tes réponses puis réessayer.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CTA sticky mobile (bas de page) */}
      <div
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/90 to-black/40 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 rounded bg-white/10 overflow-hidden">
              <div className="h-2 bg-red-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[11px] opacity-70 mt-1">{progress}% complété</div>
          </div>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`flex-none px-4 h-11 rounded-md font-semibold
                        ${canSubmit ? "bg-white text-black" : "bg-white/10 text-white/50 cursor-not-allowed"}`}
          >
            {busy ? "Envoi…" : "Soumettre"}
          </button>
        </div>
      </div>
    </div>
  );
}