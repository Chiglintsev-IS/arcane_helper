import type { NextConfig } from "next";

/**
 * Статический экспорт: сервера нет, данные локальные, сетевых запросов в рантайме нет.
 * См. ADR-0002 в docs/decisions.md — серверные возможности фреймворка не используются намеренно.
 */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  experimental: {
    // TypeScript 7 не отдаёт compiler API, которого ждёт Next; сборка использует CLI компилятора.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
