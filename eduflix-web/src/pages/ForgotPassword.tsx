import {type FormEvent, useState } from "react";
import Navbar from "../components/Navbar";
import client from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await client.post("/auth/password/forgot/", { email });
      setSent(true); // toujours true, même si email inconnu
    } catch {
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <form onSubmit={submit} className="max-w-sm mx-auto p-6 mt-16 bg-white/5 rounded-xl">
        <h1 className="text-xl font-bold mb-4">Mot de passe oublié</h1>

        {sent ? (
          <p className="opacity-90">
            Si un compte existe pour <b>{email}</b>, un email avec un lien de réinitialisation a été envoyé.
            Vérifie ta boîte de réception (et les spams).
          </p>
        ) : (
          <>
            <p className="opacity-80 text-sm mb-3">
              Saisis ton email. Nous t’enverrons un lien pour définir un nouveau mot de passe.
            </p>
            <input
              className="w-full mb-3 px-3 py-2 rounded bg-white/10"
              placeholder="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <button disabled={busy} className="w-full bg-white text-black py-2 rounded">
              {busy ? "Envoi..." : "Envoyer le lien"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}