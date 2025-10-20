// src/store/auth.ts
import { create } from "zustand";
import client from "../api/client";

type JwtPayload = { exp: number; username?: string; email?: string };

// Décode base64url sans utiliser `escape` (évite l’erreur TS)
function base64UrlDecode(str: string): string {
  try {
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
    return atob(s + pad);
  } catch {
    return "";
  }
}
function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

let refreshTimeout: number | null = null;
function clearRefreshTimer() {
  if (refreshTimeout !== null) {
    window.clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
}
function planRefresh(access: string, cb: () => void) {
  clearRefreshTimer();
  const payload = decodeJwt(access);
  if (!payload?.exp) return;
  const expMs = payload.exp * 1000;
  // Rafraîchit ~2 min avant l’expiration (min 30s)
  const delay = Math.max(30_000, expMs - Date.now() - 120_000);
  refreshTimeout = window.setTimeout(cb, delay);
}

type UserShape = { username: string; email?: string };

type AuthState = {
  user?: UserShape | null;
  token?: string | null;
  signIn: (username: string, password: string) => Promise<boolean>;
  signUp: (username: string, email: string, password: string) => Promise<boolean>;
  refresh: () => Promise<boolean>;
  signOut: () => void;
};

// Réhydratation depuis localStorage
const savedAccess = localStorage.getItem("eduflix_token");
const savedUserStr = localStorage.getItem("eduflix_user");
const savedUser: UserShape | null = savedUserStr ? JSON.parse(savedUserStr) : null;

export const useAuth = create<AuthState>((set, get) => ({
  user: savedUser,                              // ✅ on restaure le user
  token: savedAccess,                           // ✅ on restaure le token

  async signIn(username, password) {
    try {
      const { data } = await client.post("/auth/token/", { username, password });
      // SimpleJWT renvoie { access, refresh } si configuré
      localStorage.setItem("eduflix_token", data.access);
      if (data.refresh) localStorage.setItem("eduflix_refresh", data.refresh);

      // On calcule/complète l’utilisateur
      const payload = decodeJwt(data.access);
      const user: UserShape = {
        username: payload?.username || username,
        email: payload?.email,
      };
      // ✅ on le persiste pour l’UI
      localStorage.setItem("eduflix_user", JSON.stringify(user));

      // Planifier le prochain refresh
      planRefresh(data.access, () => void get().refresh());

      set({ token: data.access, user });
      return true;
    } catch {
      return false;
    }
  },

  async signUp(username, email, password) {
    try {
      await client.post("/auth/register/", { username, email, password });
      return true;
    } catch {
      return false;
    }
  },

  async refresh() {
    try {
      const refresh = localStorage.getItem("eduflix_refresh");
      if (!refresh) throw new Error("no-refresh");

      const { data } = await client.post("/auth/token/refresh/", { refresh });
      const access: string = data.access;
      if (data.refresh) localStorage.setItem("eduflix_refresh", data.refresh);

      localStorage.setItem("eduflix_token", access);

      // Si jamais le store a perdu le user, on le reprend du localStorage
      const persistedStr = localStorage.getItem("eduflix_user");
      const persistedUser: UserShape | null = persistedStr ? JSON.parse(persistedStr) : null;

      // On peut aussi compléter depuis le nouveau JWT
      const payload = decodeJwt(access);
      const completedUser: UserShape | null =
        persistedUser || (payload?.username ? { username: payload.username, email: payload.email } : null);

      // Replanifier
      planRefresh(access, () => void get().refresh());

      set({ token: access, user: completedUser ?? get().user ?? null });
      return true;
    } catch {
      // Échec: on déconnecte proprement
      get().signOut();
      return false;
    }
  },

  signOut() {
    clearRefreshTimer();
    localStorage.removeItem("eduflix_token");
    localStorage.removeItem("eduflix_refresh");
    localStorage.removeItem("eduflix_user");    // ✅ on nettoie aussi le user persistant
    set({ user: null, token: null });
  },
}));

// Bootstrap: si un token existe déjà, on programme le refresh
(() => {
  if (savedAccess) {
    planRefresh(savedAccess, () => void useAuth.getState().refresh());
  }
})();