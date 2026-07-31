/**
 * Service worker: работа без сети (NFR-001, NFR-002).
 *
 * Стратегия — «сначала кэш», и это выбор, а не упрощение: за столом сеть либо отсутствует, либо
 * хуже кэша, а всё содержимое приложения статично. Данные пользователя живут в IndexedDB и сюда не
 * попадают вовсе — обновление кэша их не касается (NFR-003).
 *
 * Список файлов сборки заранее неизвестен: статический экспорт даёт имена с хешами. Поэтому в
 * install кладётся только оболочка, а остальное оседает в кэше по мере первой загрузки. Требование
 * «один раз открыть приложение до игры» записано в инструкции по установке — иначе кэшировать
 * нечего.
 */

// Версия меняется вручную вместе с изменением стратегии кэширования. Прежние кэши сносятся в
// activate: две версии сразу означали бы, что часть страницы пришла из вчерашней сборки.
const CACHE = "arcane-helper-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png"];

self.addEventListener("install", (event) => {
  // Ждать активации не нужно: свежая версия не должна перехватывать управление посреди боя, и
  // страница сама попросит об этом сообщением SKIP_WAITING (NFR-003).
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
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
  // в свой кэш означала бы хранить то, за что оно не отвечает.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

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
