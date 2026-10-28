/**
 * Service worker: работа без сети.
 *
 * Стратегия — «сначала кэш», и это выбор, а не упрощение: за столом сеть либо отсутствует, либо
 * хуже кэша, а всё содержимое приложения статично. Данные пользователя живут в IndexedDB и сюда не
 * попадают вовсе — обновление кэша их не касается.
 *
 * Список файлов сборки заранее неизвестен: статический экспорт даёт имена с хешами. Поэтому в
 * install кладётся только оболочка, а остальное оседает в кэше по мере первой загрузки. Требование
 * «один раз открыть приложение до игры» записано в инструкции по установке — иначе кэшировать
 * нечего.
 */

/**
 * Отпечаток сборки: его вписывает `scripts/precache.py` по содержимому собранных файлов. Через него
 * воркер и узнаётся новым — браузер сличает файл воркера побайтно, и сборка, не тронувшая ни одного
 * скрипта, иначе осталась бы для телефона прежней и никогда бы не доехала.
 *
 * Им же назван кэш: у каждой сборки свой, прежние сносятся в activate. Один кэш на все сборки
 * означал бы страницу, часть которой пришла из вчерашней.
 */
const BUILD_ID = "d16a5a71b2b9";
const CACHE = `arcane-helper-${BUILD_ID}`;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png"];

/**
 * Файлы сборки. Список подставляет `scripts/precache.py` после `next build`: имена содержат хеш и
 * заранее неизвестны, а без них в кэш при установке попадала бы одна оболочка. Тогда скрипты
 * оседали бы в кэше только со второй загрузки — при первой service worker ещё не управляет
 * страницей и её запросов не видит, — и игрок, открывший приложение дома один раз, получил бы за
 * столом пустой экран.
 *
 * Пустой список — это работа в dev-режиме или сборка без шага подстановки: приложение всё равно
 * работает, просто офлайн наступает со второго открытия.
 */
const BUILD = [
  "./_next/static/K7xNpC1VpJxpp0NshEJ1C/_buildManifest.js",
  "./_next/static/K7xNpC1VpJxpp0NshEJ1C/_clientMiddlewareManifest.js",
  "./_next/static/K7xNpC1VpJxpp0NshEJ1C/_ssgManifest.js",
  "./_next/static/chunks/021gxf6e19jvx.js",
  "./_next/static/chunks/0cz1d0mv5g_q7.js",
  "./_next/static/chunks/0umf92h1sb77c.js",
  "./_next/static/chunks/1-ve77dxfw558.js",
  "./_next/static/chunks/2c5sl9xb17x-s.js",
  "./_next/static/chunks/2khxl0v1q4i6n.js",
  "./_next/static/chunks/2zsarhnz0nb9o.css",
  "./_next/static/chunks/33-s8y-bryqwz.js",
  "./_next/static/chunks/3cfn99dbrcvvp.js",
  "./_next/static/chunks/41quvuu2o8fqc.js",
  "./_next/static/chunks/turbopack-1hy_-mslzb08u.js",
  "./map.jpg",
  "./species/arachnids.webp",
  "./species/centaurs.webp",
  "./species/cyclopes.webp",
  "./species/domovye.webp",
  "./species/dryads.webp",
  "./species/dwarves.webp",
  "./species/elves.webp",
  "./species/frogs.webp",
  "./species/goblins.webp",
  "./species/gorgons.webp",
  "./species/gremlins.webp",
  "./species/harpies.webp",
  "./species/inferids.webp",
  "./species/kashtars.webp",
  "./species/leshies.webp",
  "./species/lirches.webp",
  "./species/lizardfolk.webp",
  "./species/minotaurs.webp",
  "./species/orcs.webp",
  "./species/primals.webp",
  "./species/rats.webp",
  "./species/snakebloods.webp",
  "./species/troglodytes.webp",
  "./species/trolls.webp",
];

/**
 * Копия кладётся целиком и мимо кэша браузера. Pages отдаёт файлы с max-age=600, и оболочка
 * прошлой сборки при файлах новой — страница без стилей и скриптов, которой воркер отвечает
 * первым, даже когда сеть есть. Неполная копия ломает так же; не установленный воркер оставляет
 * работать прежний, а браузер повторит установку при следующей проверке.
 */
const freshRequest = (path) => new Request(path, { cache: "reload" });

self.addEventListener("install", (event) => {
  // Ждать активации не нужно: свежая версия не должна перехватывать управление посреди боя, и
  // страница сама попросит об этом сообщением SKIP_WAITING.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([...SHELL, ...BUILD].map(freshRequest))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Кэшируется только собственная статика: чужие домены приложению не нужны, а запись их ответов
  // в свой кэш означала бы хранить то, за что оно не отвечает. Бэкенд — тоже не статика: снимок
  // из кэша показывал бы вчерашнюю игру и не менялся бы больше никогда.
  const address = new URL(request.url);
  if (
    request.method !== "GET" ||
    address.origin !== self.location.origin ||
    address.pathname.includes("/api/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached !== undefined) return cached;
      return fetch(request)
        .then((response) => {
          // Кладём только удачные ответы: закэшированная 404 переживёт исправление ошибки.
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          // Навигация без сети и без кэша — это первый запуск в офлайне. Отдаём оболочку: она
          // покажет состояние из IndexedDB, если оно есть.
          request.mode === "navigate" ? caches.match("./index.html") : Response.error(),
        );
    }),
  );
});
