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
        // Логика: покрывается полностью.
        "src/core/**",
        // Язык: морфологию зовут обе стороны, и ошибка в ней видна за столом как ошибка приложения.
        "src/shared/**",
        // Сторы интерфейса: это состояние, а не разметка.
        "src/ui/**/model/**",
      ],
      exclude: [
        // Не тесты, а набор проверок, который тесты реализаций вызывают у себя.
        "src/core/infrastructure/persistence/repositoryContract.ts",
      ],
      // Ядро покрывается полностью: ошибка здесь не выглядит как сбой, а проявляется как неверно
      // проведённая игра. Интерфейс в список не входит — он проверяется поведением.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
