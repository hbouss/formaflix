// SignUp.tsx
import {type FormEvent, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const [username, setU] = useState(""); const [email, setE] = useState("");
  const [password, setP] = useState(""); const { signUp } = useAuth(); const nav = useNavigate();
  const submit = async (e:FormEvent)=>{ e.preventDefault(); (await signUp(username,email,password)) ? nav("/signin") : alert("Inscription échouée"); };
  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <form onSubmit={submit} className="max-w-sm mx-auto p-6 mt-16 bg-white/5 rounded-xl">
        <h1 className="text-xl font-bold mb-4">Créer un compte</h1>
        <input className="w-full mb-3 px-3 py-2 rounded bg-white/10" placeholder="Username" value={username} onChange={e=>setU(e.target.value)} />
        <input className="w-full mb-3 px-3 py-2 rounded bg-white/10" placeholder="Email" value={email} onChange={e=>setE(e.target.value)} />
        <input className="w-full mb-3 px-3 py-2 rounded bg-white/10" placeholder="Password" type="password" value={password} onChange={e=>setP(e.target.value)} />
        <button className="w-full bg-white text-black py-2 rounded">Créer</button>
      </form>
    </div>
  );
}