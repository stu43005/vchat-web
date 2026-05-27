import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DATA_PROXY;
  if (!proxyTarget) {
    console.warn(
      "[vite] VITE_DATA_PROXY is not set; /data dev proxy disabled. Requests to /data/* will 404 unless the bucket is mounted locally.",
    );
  }
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
      proxy: proxyTarget
        ? {
            "/data": {
              target: proxyTarget,
              changeOrigin: true,
            },
            "^/UC[^/]+/": {
              target: proxyTarget,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  };
});
