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
const CACHE = "arcane-helper-v2";
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
const BUILD = [];

self.addEventListener("install", (event) => {
  // Ждать активации не нужно: свежая версия не должна перехватывать управление посреди боя, и
  // страница сама попросит об этом сообщением SKIP_WAITING (NFR-003).
  // Оболочка обязательна, файлы сборки — по возможности: один недоступный файл не должен
  // отменять установку целиком, иначе офлайна не будет вовсе.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(SHELL).then(() => Promise.all(BUILD.map((path) => cache.add(path).catch(() => undefined)))),
      ),
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
