import {type FormEvent, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import client from "../api/client";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPassword() {
  const q = useQuery();
  const uid = q.get("uid") || "";
  const token = q.get("token") || "";
  const nav = useNavigate();

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const same = p1.length > 0 && p1 === p2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!same) return;
    setBusy(true);
    try {
      await client.post("/auth/password/reset/", { uid, token, password: p1 });
      setDone(true);
      setTimeout(() => nav("/signin"), 1200);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Lien invalide ou expiré.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <form onSubmit={submit} className="max-w-sm mx-auto p-6 mt-16 bg-white/5 rounded-xl">
        <h1 className="text-xl font-bold mb-4">Nouveau mot de passe</h1>

        {done ? (
          <p className="opacity-90">Mot de passe mis à jour. Redirection…</p>
        ) : (
          <>
            <input
              className="w-full mb-3 px-3 py-2 rounded bg-white/10"
              placeholder="Nouveau mot de passe"
              type="password"
              value={p1}
              onChange={e => setP1(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            <input
              className="w-full mb-4 px-3 py-2 rounded bg-white/10"
              placeholder="Confirmer le mot de passe"
              type="password"
              value={p2}
              onChange={e => setP2(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            {!same && p2.length > 0 && (
              <div className="text-sm text-red-300 mb-2">Les mots de passe ne correspondent pas.</div>
            )}
            <button disabled={!same || busy} className="w-full bg-white text-black py-2 rounded">
              {busy ? "En cours..." : "Valider"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}