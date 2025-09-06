import { create } from "zustand";
import client from "../api/client";

type AuthState = {
  user?: { username: string; email?: string } | null;
  token?: string | null;
  signIn: (username: string, password: string) => Promise<boolean>;
  signUp: (username: string, email: string, password: string) => Promise<boolean>;
  signOut: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("eduflix_token"),
  async signIn(username, password) {
    try {
      const { data } = await client.post("/auth/token/", { username, password });
      localStorage.setItem("eduflix_token", data.access);
      set({ token: data.access, user: { username } });
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
  signOut() {
    localStorage.removeItem("eduflix_token");
    set({ user: null, token: null });
  },
}));