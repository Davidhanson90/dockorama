import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Demo harness. Imports the package by its public name, resolved to the freshly built dist/.
export default defineConfig({
  root: "harness",
  base: "./",
  resolve: {
    alias: [
      { find: /^pazuru\/skins$/, replacement: fileURLToPath(new URL("../dist/skins/index.js", import.meta.url)) },
      { find: /^pazuru\/skins\/([a-z-]+)$/, replacement: fileURLToPath(new URL("../dist/skins/$1/index.js", import.meta.url)) },
      { find: /^pazuru$/, replacement: fileURLToPath(new URL("../dist/index.js", import.meta.url)) },
      { find: /^pazuru\/(react|vue|angular|svelte)$/, replacement: fileURLToPath(new URL("../dist/$1.js", import.meta.url)) }
    ]
  },
  build: {
    outDir: "../harness-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        trading: fileURLToPath(new URL("./trading.html", import.meta.url))
      }
    }
  }
});
