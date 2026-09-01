import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://sleeper-draft-night-dashboard.vercel.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: { target: "es2022", sourcemap: true },
});
