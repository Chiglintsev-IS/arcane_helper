import type { Metadata, Viewport } from "next";

import { ServiceWorkerUpdate } from "@/components/app/ServiceWorkerUpdate";

import "./globals.css";

export const metadata: Metadata = {
  title: "Arcane Helper",
  description: "Оффлайн-помощник для магического боя в D&D 5e",
  applicationName: "Arcane Helper",
  appleWebApp: { capable: true, title: "Arcane Helper", statusBarStyle: "black-translucent" },
  // Относительные пути: статический экспорт кладут и в подкаталог, и абсолютный «/» там сломался бы.
  manifest: "./manifest.webmanifest",
  icons: {
    icon: [{ url: "./icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "./apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Приложение держат в одной руке за столом; масштабирование не запрещаем ради доступности.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
        <ServiceWorkerUpdate />
      </body>
    </html>
  );
}
