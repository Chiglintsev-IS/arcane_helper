import type { Metadata, Viewport } from "next";

import { SURFACE_PAGE } from "@/ui/shared/ui/surface";

import "./globals.css";

export const metadata: Metadata = {
  title: "Arcane Helper",
  description: "Оффлайн-помощник для магического боя",
  applicationName: "Arcane Helper",
  appleWebApp: { capable: true, title: "Arcane Helper", statusBarStyle: "black-translucent" },
  manifest: "./manifest.webmanifest",
  robots: { index: false, follow: false },
  // Safari до iOS 17 читает полноэкранный режим из `apple-mobile-web-app-capable` и без него
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "./icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "./apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Цвет строки состояния берётся не токеном: браузер читает его до того, как появится лист стилей.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe8da" },
    { media: "(prefers-color-scheme: dark)", color: "#15120e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`text-ink antialiased ${SURFACE_PAGE}`}>
        {children}
      </body>
    </html>
  );
}
