import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts: unit tests run pure TS in a node env and don't need
// the React plugin, which avoids the vite/vitest duplicate-types clash.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
