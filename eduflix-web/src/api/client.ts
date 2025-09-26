import axios from "axios";
import i18n from "../i18n";

export const API_BASE = "http://127.0.0.1:8000/api";

const client = axios.create({
  baseURL: API_BASE,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("eduflix_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.defaults.headers.common["Accept-Language"] = i18n.language;

i18n.on("languageChanged", (lng) => {
  client.defaults.headers.common["Accept-Language"] = lng;
});

export default client;