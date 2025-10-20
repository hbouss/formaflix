// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // = 0.0.0.0
    port: 5173,
    // HMR plus stable sur mobile (optionnel)
    hmr: { host: '192.168.1.12' } // ← remplace par l’IP de ton ordi
  }
})