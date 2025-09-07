import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

const NavLink = ({ to, label }: { to: string; label: string }) => {
  const loc = useLocation();
  const active = loc.pathname === to;
  return (
    <Link to={to} className={`text-sm ${active ? "font-semibold" : "opacity-80 hover:opacity-100"}`}>
      {label}
    </Link>
  );
};

export default function Navbar() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
      <div className="mx-auto max-w-[1500px] px-6 py-3 flex items-center gap-8">
        <Link to="/" className="text-2xl font-extrabold text-red-600 tracking-tight">Eduflix</Link>
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" label="Accueil" />
          <NavLink to="/library" label="Ma bibliothèque" />
          <NavLink to="/my-list" label="Ma liste" />   {/* 👈 ajoute cette ligne */}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden sm:block text-sm opacity-80">Bonjour, {user.username}</span>
              <button
                onClick={() => { signOut(); nav("/"); }}
                className="text-sm px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              >Se déconnecter</button>
            </>
          ) : (
            <>
              <Link to="/signin" className="text-sm px-3 py-1 rounded bg-white/10 hover:bg-white/20">Connexion</Link>
              <Link to="/signup" className="text-sm px-3 py-1 rounded bg-white text-black">Créer un compte</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}