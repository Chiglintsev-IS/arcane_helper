import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    // Окружение по умолчанию — node: движку правил и состоянию браузер не нужен.
    // Компонентные тесты просят jsdom построчной директивой `@vitest-environment jsdom`.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: [
        "src/rules/**",
        "src/data/schemas/**",
        "src/store/**",
        "src/data/content/**",
        // Геометрия и таблицы штрихов — вычисления, а не разметка: ошибка здесь выглядит как
        // испорченная схема, по которой игрок будет рисовать.
        "src/diagram/**",
      ],
      // Движок правил покрывается полностью: ошибка здесь не выглядит как сбой,
      // а проявляется как неверно проведённая игра. См. docs/quality.md.
      // Компоненты в список не входят: они проверяются поведением, а не покрытием строк.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
