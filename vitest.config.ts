import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "openclaw/plugin-sdk/plugin-entry",
        replacement: path.join(extensionRoot, "test-shims", "plugin-entry.ts"),
      },
      {
        find: "openclaw/plugin-sdk/secret-input",
        replacement: path.join(extensionRoot, "test-shims", "secret-input.ts"),
      },
      {
        find: "openclaw/plugin-sdk/speech",
        replacement: path.join(extensionRoot, "test-shims", "speech.ts"),
      },
    ],
  },
  test: {
    testTimeout: 120_000,
    hookTimeout: 120_000,
    unstubEnvs: true,
    unstubGlobals: true,
    include: ["*.test.ts"],
  },
});
