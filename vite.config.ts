/// <reference types="vitest" />
import { defineConfig, mergeConfig } from "vite";
import { defineConfig as dc } from "vitest/config";
import react from "@vitejs/plugin-react";

const testConfig = dc({
  test: {
    api: 5173,
    environment: "happy-dom",
  },
});

// Vite fills `%VITE_*%` placeholders in index.html from the env files.
export default defineConfig(
  mergeConfig(testConfig, {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  }),
);
