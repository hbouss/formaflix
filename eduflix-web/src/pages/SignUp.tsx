// SignUp.tsx
import { type FormEvent, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const [username, setU] = useState("");
  const [email, setE] = useState("");
  const [password, setP] = useState("");
  const [firstName, setFN] = useState("");
  const [lastName, setLN] = useState("");

  const { signUp } = useAuth();
  const nav = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await signUp(username, email, password, firstName, lastName); // ⬅️ on passe les 5 champs
    ok ? nav("/signin") : alert("Inscription échouée");
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <form onSubmit={submit} className="max-w-sm mx-auto p-6 mt-16 bg-white/5 rounded-xl">
        <h1 className="text-xl font-bold mb-4">Créer un compte</h1>

        <input
          className="w-full mb-3 px-3 py-2 rounded bg-white/10"
          placeholder="Prénom"
          value={firstName}
          onChange={e => setFN(e.target.value)}
          autoComplete="given-name"
          required
        />
        <input
          className="w-full mb-3 px-3 py-2 rounded bg-white/10"
          placeholder="Nom"
          value={lastName}
          onChange={e => setLN(e.target.value)}
          autoComplete="family-name"
          required
        />

        <input
          className="w-full mb-3 px-3 py-2 rounded bg-white/10"
          placeholder="Username"
          value={username}
          onChange={e => setU(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          className="w-full mb-3 px-3 py-2 rounded bg-white/10"
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setE(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="w-full mb-3 px-3 py-2 rounded bg-white/10"
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setP(e.target.value)}
          autoComplete="new-password"
          required
        />

        <button className="w-full bg-white text-black py-2 rounded">Créer</button>
      </form>
    </div>
  );
}