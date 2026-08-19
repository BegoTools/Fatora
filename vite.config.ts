import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
    // Tauri writes locked .dll/.exe files here while Vite is watching. Watching
    // that build output makes `tauri dev` crash on Windows with EBUSY.
    watch: {
      ignored: ['**/src-tauri/target/**'],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router', 'react-router-dom'],
          'radix-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tooltip'],
          'charts': ['recharts'],
          'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },
});
