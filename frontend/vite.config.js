import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In local dev (`npm run dev`) /api calls are proxied to the Django backend.
// In Docker, nginx does the same job (see nginx.conf.template).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": process.env.VITE_BACKEND_URL || "http://localhost:8000",
    },
  },
});
