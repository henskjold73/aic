import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const hash: string = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    __BUILD_HASH__: JSON.stringify(hash),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __CURRENT_SCRIPT_VERSION__: JSON.stringify("1.2.0"),
  },
});
