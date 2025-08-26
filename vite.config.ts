import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        background: path.resolve(__dirname, "src/background.ts"),
        "content-script": path.resolve(__dirname, "src/content-script.ts"),
        "runtime-api": path.resolve(__dirname, "src/runtime-api.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") {
            return "background.js";
          } else if (chunk.name === "content-script") {
            return "content-script.js";
          } else if (chunk.name === "runtime-api") {
            return "runtime-api.js";
          }
          else {
            return "scripts/[name].js";
          }
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    }
  }
})
