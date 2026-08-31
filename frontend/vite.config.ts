import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev-only proxy: forwards /api/* to the local backend
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  define: {
    // Expose VITE_API_URL at build time; falls back to /api for local dev
    __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? "/api"),
  },
});
