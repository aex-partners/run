import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: "src/test/setup.ts",
    globalSetup: "src/test/global-setup.ts",
    include: ["src/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 15000,
  },
});
