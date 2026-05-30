import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget =
    env.VITE_BACKEND_TARGET ||
    env.VITE_SOCKET_URL ||
    env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') ||
    "http://127.0.0.1:5000";

  return {
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 8088,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/backend": {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ""),
      },
      "/uploads": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET' || err.code === 'EPIPE') return
            console.error('[socket.io proxy]', err.message)
          })
        },
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 8088,
  },
  }
});
