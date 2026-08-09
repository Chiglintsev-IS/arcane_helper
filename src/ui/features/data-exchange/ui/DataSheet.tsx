/**
 * Импорт и экспорт данных.
 *
 * Приложение живёт в браузере телефона, а браузер вправе очистить хранилище: выгрузка — единственный
 * способ не потерять персонажа. Работа с файлами в Safari на iOS ограничена, поэтому рядом со
 * скачиванием и выбором файла стоит обмен через буфер: скопировать текст и вставить его — то, что
 * работает всегда.
 *
 * Компонент презентационный: разбор и проверка живут в движке правил, здесь только ввод и вывод.
 */

"use client";

import { useState } from "react";

import type { SpellCatalogSource } from "@/core/application/session";

export function DataSheet({
  exportText,
  fileName,
  error,
  catalogSource = "built_in",
  onImport,
  onRestoreBuiltInCatalog,
  onClose,
}: {
  exportText: string;
  fileName: string;
  /** Причина отказа от прошлой попытки загрузки или возврата к встроенным карточкам, или `null`. */
  error: string | null;
  /** Чем играют прямо сейчас. */
  catalogSource?: SpellCatalogSource;
  onImport: (raw: string) => void;
  /** Вернуть карточки из сборки. Без обработчика кнопки нет: возвращать нечем. */
  onRestoreBuiltInCatalog?: () => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");

  const download = (): void => {
    const url = URL.createObjectURL(new Blob([exportText], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const readFile = (file: File | undefined): void => {
    if (file === undefined) return;
    void file.text().then((text) => setRaw(text));
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Данные"
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 className="text-base font-semibold">Выгрузка</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="min-h-11 grow rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
        >
          Скачать файл
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(exportText)}
          className="min-h-11 grow rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          Скопировать
        </button>
      </div>

      {/*
 Чем играют сейчас — раньше кнопки загрузки: игрок должен видеть, что именно он собирается
 заменить, а не узнавать об этом после.
 */}
      <h2 className="text-base font-semibold">Каталог заклинаний</h2>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {catalogSource === "imported"
          ? "Сейчас действуют карточки из загруженного файла."
          : "Сейчас действуют встроенные карточки приложения."}
      </p>
      {catalogSource === "imported" && onRestoreBuiltInCatalog !== undefined ? (
        <button
          type="button"
          onClick={onRestoreBuiltInCatalog}
          className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          Вернуть встроенные карточки
        </button>
      ) : null}

      <h2 className="text-base font-semibold">Загрузка</h2>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Заменяет персонажа целиком: подготовку, остаток ресурсов, заметки. Карточки из файла тоже
        становятся действующими и остаются после перезапуска.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Файл или вставленный текст</span>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => readFile(event.target.files?.[0])}
          className="text-xs"
        />
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={4}
          aria-label="Данные для загрузки"
          className="rounded-lg border border-slate-200 p-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-900"
        />
      </label>

      {/* Причина отказа называет поле: «ошибка импорта» без деталей заставляет править JSON вслепую. */}
      {error === null ? null : (
        <p role="alert" className="rounded-lg border border-reaction bg-reaction/10 p-2 text-xs">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={raw.trim() === ""}
          onClick={() => onImport(raw)}
          className="min-h-11 flex-1 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Загрузить
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-800"
        >
          Закрыть
        </button>
      </div>
    </section>
  );
}
