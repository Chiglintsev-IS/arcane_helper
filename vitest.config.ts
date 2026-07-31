import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/rules/**", "src/data/schemas/**"],
      // Движок правил покрывается полностью: ошибка здесь не выглядит как сбой,
      // а проявляется как неверно проведённая игра. См. docs/quality.md.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
