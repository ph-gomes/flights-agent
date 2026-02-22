import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Whenever Vite sees a request starting with /api, it proxies it to NestJS
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
