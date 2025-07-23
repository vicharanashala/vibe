import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { comlink } from "vite-plugin-comlink";

// https://vitejs.dev/config/
export default defineConfig({
  worker: {
    plugins: () => [comlink()]
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Proxy API requests to staging backend to avoid CORS issues
      '/api': {
        target: 'https://vibe-backend-staging-239934307367.asia-south1.run.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          const rewrittenPath = path.replace(/^\/api/, '');
          console.log(`Proxy rewrite: ${path} -> ${rewrittenPath}`);
          return rewrittenPath;
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
            console.log('Target URL:', `${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
});
