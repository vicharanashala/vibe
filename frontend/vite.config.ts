import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { comlink } from "vite-plugin-comlink";

// https://vitejs.dev/config/
export default defineConfig({
  worker: {
    format: 'es',
    plugins: () => [comlink()],
    rollupOptions: {
      output: {
        entryFileNames: 'worker/[name]-[hash].js',
        chunkFileNames: 'worker/[name]-[hash].js',
        assetFileNames: 'worker/[name]-[hash][ext]',
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    // Allows a Cloudflare quick-tunnel's Host header through — Vite rejects
    // unrecognized hosts by default. Opt-in only (VITE_ALLOW_ALL_HOSTS=true)
    // for that throwaway-tunnel workflow; `true` unconditionally here would
    // leave every `pnpm dev` open to DNS-rebinding regardless of whether
    // anyone's actually tunneling it.
    allowedHosts: process.env.VITE_ALLOW_ALL_HOSTS === 'true' ? true : undefined,
    proxy: {
      // Proxy API requests to staging backend to avoid CORS issues
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    // Off by default: generating sourcemaps for this bundle (onnxruntime-web's
    // multi-MB minified ort-web.min.js, plus mediapipe) spikes Rollup's
    // chunk-rendering memory well past 4GB and OOM-kills memory-constrained
    // build environments (observed on Render's static-site build machine).
    // Opt in locally with `VITE_SOURCEMAP=true pnpm build` when debugging a
    // production bundle.
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
