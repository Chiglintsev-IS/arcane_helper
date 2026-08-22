/**
 * Импорт и экспорт данных.
 *
 * Приложение живёт в браузере телефона, а браузер вправе очистить хранилище: выгрузка — единственный
 * способ не потерять персонажа. Загрузка принимает и выбранный файл, и вставленный текст — по той же
 * причине, по которой копия отдаётся двумя способами.
 *
 * Компонент презентационный: разбор и проверка живут в движке правил, здесь только ввод и вывод.
 */

"use client";

import { RULE_MARK } from "@/ui/shared/ui/rule";
import { useId, useState } from "react";

import { DataCopy } from "@/ui/features/data-exchange/ui/DataCopy";
import { SURFACE_CONTROL, SURFACE_GROUP_BARE, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function DataSheet({
  exportText,
  fileName,
  error,
  catalogSource,
  onImport,
  onRestoreBuiltInCatalog,
  onClose,
}: {
  exportText: string;
  fileName: string;
  /** Причина отказа от прошлой попытки загрузки или возврата к встроенным карточкам, или `null`. */
  error: string | null;
  /** Чем играют прямо сейчас: слово правил, а подпись к нему — дело экрана. */
  catalogSource: string;
  onImport: (raw: string) => void;
  /** Вернуть карточки из сборки. Без обработчика кнопки нет: возвращать нечем. */
  onRestoreBuiltInCatalog?: () => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const titleId = useId();

  const readFile = (file: File | undefined): void => {
    if (file === undefined) return;
    void file.text().then((text) => setRaw(text));
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-x-0 bottom-0 z-20 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto p-3 ${SURFACE_PANEL}`}
    >
      <h2 id={titleId} className="text-base font-semibold">
        Данные
      </h2>

      <h3 className="text-sm font-semibold">Выгрузка</h3>
      <DataCopy text={exportText} fileName={fileName} />

      {/*
 Чем играют сейчас — раньше кнопки загрузки: игрок должен видеть, что именно он собирается
 заменить, а не узнавать об этом после.
 */}
      <h3 className="text-sm font-semibold">Каталог заклинаний</h3>
      <p className="text-xs text-ink-quiet">
        {catalogSource === "imported"
          ? "Сейчас действуют карточки из загруженного файла."
          : "Сейчас действуют встроенные карточки приложения."}
      </p>
      {catalogSource === "imported" && onRestoreBuiltInCatalog !== undefined ? (
        <button
          type="button"
          onClick={onRestoreBuiltInCatalog}
          className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Вернуть встроенные карточки
        </button>
      ) : null}

      <h3 className="text-sm font-semibold">Загрузка</h3>
      <p className="text-xs text-ink-quiet">
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
          className={`p-2 font-mono text-xs ${SURFACE_CONTROL}`}
        />
      </label>

      {/* Причина отказа называет поле: «ошибка импорта» без деталей заставляет править JSON вслепую. */}
      {error === null ? null : (
        <p role="alert" className={`${RULE_MARK.reaction} p-2 text-xs ${SURFACE_GROUP_BARE}`}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={raw.trim() === ""}
          onClick={() => onImport(raw)}
          className={`min-h-11 flex-1 ${SURFACE_PRIMARY} px-3 text-sm font-semibold disabled:opacity-50`}
        >
          Загрузить
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`min-h-11 shrink-0 px-3 text-sm ${SURFACE_CONTROL}`}
        >
          Закрыть
        </button>
      </div>
    </section>
  );
}
