import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://35.188.205.219:8080",
        changeOrigin: true,
        secure: false,
        // IMPORTANT: strip the /api prefix so Spring sees /jobs, not /api/jobs
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
