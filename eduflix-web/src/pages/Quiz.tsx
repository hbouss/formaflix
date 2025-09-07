import { useEffect, useState } from "react";
import {Link, useParams} from "react-router-dom";
import client from "../api/client";
import Navbar from "../components/Navbar";

type Quiz = { id:number; title:string; passing_score:number; questions:{id:number;text:string;choices:{id:number;text:string}[]}[] };

export default function QuizPage() {
  const { id } = useParams(); // course id
  const [quiz, setQuiz] = useState<Quiz|null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{score_percent:number; passed:boolean}|null>(null);
  const [certUrl, setCertUrl] = useState<string>("");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    client.get(`/quizzes/${id}/`).then(r => setQuiz(r.data));
  }, [id]);

  useEffect(() => {
  client.get(`/quizzes/${id}/`)
    .then(r => setQuiz(r.data))
    .catch(err => {
      if (err?.response?.status === 401) setNeedsLogin(true);
    });
}, [id]);

if (needsLogin) {
  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 pt-28">
        <h1 className="text-2xl font-bold">Connexion requise</h1>
        <p className="opacity-80 mt-2">Connecte-toi pour accéder au quiz et au certificat.</p>
        <Link to="/signin" className="inline-block mt-4 px-4 py-2 rounded bg-white text-black">Se connecter</Link>
      </div>
    </div>
  );
}

  const submit = async () => {
    const payload = { answers: Object.fromEntries(Object.entries(answers).map(([k,v])=>[k, v])) };
    const { data } = await client.post(`/quizzes/${id}/submit/`, payload);
    setResult(data);
    if (data.passed) {
      const res = await client.post(`/certificates/${id}/generate/`);
      setCertUrl(res.data.url);
    }
  };

  if (!quiz) return null;

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold">{quiz.title}</h1>
        <p className="opacity-80 text-sm">Score requis : {quiz.passing_score}%</p>

        <div className="mt-6 space-y-6">
          {quiz.questions.map(q => (
            <div key={q.id} className="bg-white/5 rounded p-4">
              <div className="font-semibold mb-2">{q.text}</div>
              <div className="space-y-2">
                {q.choices.map(ch => (
                  <label key={ch.id} className="flex items-center gap-2">
                    <input type="radio" name={`q${q.id}`} onChange={()=>setAnswers(a=>({...a,[q.id]: ch.id}))}/>
                    <span>{ch.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button onClick={submit} className="mt-6 px-4 py-2 rounded bg-white text-black">Soumettre</button>

        {result && (
          <div className="mt-4">
            <div>Score : {result.score_percent}% — {result.passed ? "Réussi ✅" : "Échoué ❌"}</div>
            {certUrl && <a href={certUrl} target="_blank" className="underline">Télécharger mon certificat</a>}
          </div>
        )}
      </div>
    </div>
  );
}