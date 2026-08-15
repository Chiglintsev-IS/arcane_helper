import type { NextConfig } from "next";

/**
 * Две поставки, одна переменная.
 *
 * По умолчанию — статический экспорт: сервера нет, данные локальные, сетевых запросов в рантайме
 * нет. Это основная поставка, и офлайн в ней не деградация, а способ работы.
 *
 *     NEXT_PUBLIC_ARCANE_BACKEND=http npm run build
 *
 * С этой переменной отображение выбирает провод по сети, а сборка перестаёт быть статическим
 * экспортом: обработчиков маршрутов он не исполняет, и бэкенду было бы негде отвечать. Переменная
 * одна на оба решения намеренно — разойтись им нечем, а два переключателя однажды выставили бы
 * сетевой провод в сборке без маршрутов.
 *
 * Маршруты бэкенда носят собственное расширение и потому существуют только в сетевой сборке:
 * статический экспорт не пропускает даже объявленный обработчик чтения, а офлайновой поставке
 * маршрут и не нужен — отвечать в ней некому.
 */
const networked = process.env.NEXT_PUBLIC_ARCANE_BACKEND === "http";

/** Расширения файлов, которые сборка считает маршрутами. Первое существует только в сетевой. */
const NETWORKED_PAGE_EXTENSIONS = ["backend.ts", "tsx", "ts"];

/**
 * Подкаталог, если приложение лежит не в корне домена: GitHub Pages отдаёт проект по адресу вида
 * `/arcane_helper/`, и абсолютные пути к файлам сборки там ведут в пустоту. Локальные прогоны и
 * хостинг в корне переменную не задают и работают как раньше.
 *
 *     BASE_PATH=/arcane_helper npm run build
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(networked ? { pageExtensions: NETWORKED_PAGE_EXTENSIONS } : { output: "export" as const }),
  ...(basePath === "" ? {} : { basePath, assetPrefix: basePath }),
  reactStrictMode: true,
  images: { unoptimized: true },
  experimental: {
    // TypeScript 7 не отдаёт compiler API, которого ждёт Next; сборка использует CLI компилятора.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
