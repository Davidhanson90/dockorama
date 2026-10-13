import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Demo harness. Imports the package by its public name, resolved to the freshly built dist/.
export default defineConfig({
  root: "harness",
  base: "./",
  resolve: {
    alias: [
      { find: /^flexdock$/, replacement: fileURLToPath(new URL("../dist/index.js", import.meta.url)) },
      { find: /^flexdock\/(react|vue|angular|svelte)$/, replacement: fileURLToPath(new URL("../dist/$1.js", import.meta.url)) }
    ]
  },
  build: { outDir: "../harness-dist", emptyOutDir: true }
});
