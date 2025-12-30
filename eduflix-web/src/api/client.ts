// src/api/client.ts
import axios, { AxiosError } from "axios";
import i18n from "../i18n";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "https://sbeautyflix.com/api";

console.log("API_BASE =", API_BASE);   // 🔍 TEMPORAIRE

const client = axios.create({
  baseURL: API_BASE,
});

// --- Request: ajoute le Bearer si présent ---
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("eduflix_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Langue
client.defaults.headers.common["Accept-Language"] = i18n.language;
i18n.on("languageChanged", (lng) => {
  client.defaults.headers.common["Accept-Language"] = lng;
});

// --- Response: refresh auto sur 401 ---
let refreshingPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    const refresh = localStorage.getItem("eduflix_refresh");
    if (!refresh) throw new Error("no-refresh-token");

    const res = await axios.post(
      `${API_BASE}/auth/token/refresh/`,
      { refresh },
      { headers: { "Accept-Language": i18n.language } }
    );

    const { access, refresh: newRefresh } = res.data;
    localStorage.setItem("eduflix_token", access);
    if (newRefresh) {
      // si ROTATE_REFRESH_TOKENS=True, on reçoit un nouveau refresh
      localStorage.setItem("eduflix_refresh", newRefresh);
    }
    refreshingPromise = null;
    return access;
  })().catch((e) => {
    refreshingPromise = null;
    // échec -> on nettoie
    localStorage.removeItem("eduflix_token");
    localStorage.removeItem("eduflix_refresh");
    throw e;
  });

  return refreshingPromise;
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original: any = error.config || {};

    if (status === 401 && !original._retry) {
      original._retry = true;
      try {
        const newAccess = await refreshAccessToken();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
        return client(original); // rejoue la requête
      } catch {
        // Optionnel: rediriger vers /signin si nécessaire
      }
    }
    return Promise.reject(error);
  }
);

export default client;