import type { NextConfig } from "next";

/**
 * Статический экспорт: сервера нет, данные локальные, сетевых запросов в рантайме нет.
 * См. ADR-0002 в docs/decisions.md — серверные возможности фреймворка не используются намеренно.
 */
/**
 * Подкаталог, если приложение лежит не в корне домена: GitHub Pages отдаёт проект по адресу вида
 * `/arcane_helper/`, и абсолютные пути к файлам сборки там ведут в пустоту. Локальные прогоны и
 * хостинг в корне переменную не задают и работают как раньше.
 *
 *     BASE_PATH=/arcane_helper npm run build
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  ...(basePath === "" ? {} : { basePath, assetPrefix: basePath }),
  reactStrictMode: true,
  images: { unoptimized: true },
  experimental: {
    // TypeScript 7 не отдаёт compiler API, которого ждёт Next; сборка использует CLI компилятора.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
