import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
    ],
    base: "/",
    build: {
      target: "es2022",
      outDir: "dist",
    },
    server: {
      proxy: {
        "/data": {
          target: env.VITE_DATA_PROXY ?? "https://archive.example.com",
          changeOrigin: true,
        },
      },
    },
  };
});
