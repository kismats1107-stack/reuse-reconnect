import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the production build also opens from a sub-folder.
  base: "./",
  server: { port: 5180 },
  preview: { port: 5181 },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
