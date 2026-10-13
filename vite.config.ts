/// <reference types="vitest" />
import { mergeConfig } from "vite";
import { defineConfig, loadEnv } from "vite";
import { defineConfig as dc } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/

const testConfig = dc({
  test: {
    api: 5173,
    environment: "happy-dom",
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  // Plugin to enable replacing %VITE_ENV_VAR% syntax with the VITE_ENV_VAR variable in html
  const htmlEnvVariables = () => {
    return {
      name: "html-env-variables",
      transformIndexHtml(html: string) {
        return html.replace(/%(.*?)%/g, function (match, p1) {
          if (env[p1]) {
            return env[p1].replace(/$[\"\']|[\"\']^/, "");
          } else {
            throw new Error(
              `Vite htmlEnvVariables Error: the environment variable ${p1} is not defined. Check if the variable name is misspelled in your HTML, or if the variable is not defined in your ${mode} environment.`,
            );
          }
        });
      },
    };
  };

  return mergeConfig(testConfig, {
    plugins: [htmlEnvVariables(), react()],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  });
});
