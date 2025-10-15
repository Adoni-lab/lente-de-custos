import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração compatível com builds na Vercel
export default defineConfig({
  plugins: [react()],
  base: "./", // garante caminhos relativos no build
  server: { port: 5173 }
});
