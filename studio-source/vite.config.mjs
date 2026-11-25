import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "compiled",
    emptyOutDir: true,
    cssCodeSplit: false,
    reportCompressedSize: false,
    lib: {
      entry: "Board.tsx",
      name: "StateWeaverStudio",
      formats: ["iife"],
      fileName: () => "board.js",
      cssFileName: "board",
    },
  },
  esbuild: { jsx: "automatic" },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
