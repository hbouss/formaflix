import { type FormEvent, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../store/auth";
import { useNavigate, Link } from "react-router-dom";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setP] = useState("");
  const { signIn } = useAuth();
  const nav = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    (await signIn(email, password)) ? nav("/") : alert("Identifiants invalides");
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <form onSubmit={submit} className="max-w-sm mx-auto p-6 mt-16 bg-white/5 rounded-xl">
        <h1 className="text-xl font-bold mb-4">Connexion</h1>
        <input
          className="w-full mb-3 px-3 py-2 rounded bg-white/10"
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="w-full mb-2 px-3 py-2 rounded bg-white/10"
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={e => setP(e.target.value)}
          autoComplete="current-password"
          required
        />

        <div className="mb-4 text-right">
          <Link to="/forgot" className="text-sm opacity-80 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>

        <button className="w-full bg-white text-black py-2 rounded">Se connecter</button>
      </form>
    </div>
  );
}