import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// GitHub Pages serves the project under /<repo>/. Override with VITE_BASE if the repo
// name differs.
const base = process.env.VITE_BASE ?? "/MLBB-Build-Analyser/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { "@data": resolve(repoRoot, "data") },
  },
  server: {
    // Allow Vite to read the data/ files that live above the web/ root.
    fs: { allow: [repoRoot] },
  },
});
