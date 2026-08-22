/**
 * Содержимое оболочки, когда сохранённое не прочиталось.
 *
 * Отказ, у которого не видно выхода, запирает игрока за столом: лист и журнал недостижимы, и
 * единственное действие, которое приходит в голову, — переустановить приложение, то есть уничтожить
 * сохранение своими руками. Поэтому копия стоит прежде очистки, а само содержимое видно на экране:
 * данные целы, и это первое, что нужно знать за столом.
 *
 * Режимом это не является: режим выбирают, а сюда попадают по состоянию сохранения.
 */

"use client";

import { RULE_MARK, RULE_ROW } from "@/ui/shared/ui/rule";
import { useState } from "react";

import { DataCopy } from "@/ui/features/data-exchange/ui/DataCopy";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { SURFACE_CONTROL, SURFACE_GROUP, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

export function UnreadableSave() {
  const { session: sessionStore } = useStores();
  const reason = useSession((state) => state.error);
  const rawSave = useSession((state) => state.rawSave);

  const [startingOver, setStartingOver] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col gap-3 overflow-y-auto p-4">
      <h1 className="text-base font-semibold">Сохранение не прочиталось</h1>
      <p
        role="alert"
        className={`${RULE_MARK.reaction} p-2 text-xs text-reaction ${SURFACE_GROUP_BARE}`}
      >
        {reason ?? "Состояние не прочитано"}
      </p>

      {rawSave === null ? (
        <p className="text-xs text-ink-quiet">
          Копировать нечего: хранилище не отдало и сырого содержимого.
        </p>
      ) : (
        <>
          <h2 className="text-sm font-semibold">Копия данных</h2>
          <p className="text-xs text-ink-quiet">
            Хранилище как есть, без проверки схемой. Заберите копию до очистки: по ней сохранение
            чинят руками.
          </p>
          {/* Область прокручивается, поэтому получает фокус: с клавиатуры до неё иначе не добраться. */}
          <pre
            role="region"
            aria-label="Содержимое хранилища"
            tabIndex={0}
            className={`max-h-40 overflow-auto p-2 font-mono text-[11px] leading-snug ${SURFACE_GROUP}`}
          >
            {rawSave.text}
          </pre>
          <DataCopy text={rawSave.text} fileName={rawSave.fileName} />
        </>
      )}

      <hr className={`mt-2 ${RULE_ROW}`} />
      <h2 className="text-sm font-semibold">Чистое состояние</h2>
      <p className="text-xs text-ink-quiet">
        Приложение начнёт с чистого Торна. Сохранение при этом заменяется — копию берут до, а не
        после.
      </p>
      <button
        type="button"
        onClick={() => setStartingOver(true)}
        className={`min-h-11 px-3 text-sm text-reaction ${SURFACE_CONTROL}`}
      >
        Начать заново
      </button>

      {startingOver ? (
        <ConfirmSheet
          title="Начать заново?"
          body="Персонаж, журнал и загруженные карточки будут заменены чистыми. Вернуть их получится только из копии, забранной до очистки."
          confirmLabel="Удалить и начать"
          cancelLabel={BUTTON_LABELS.dismiss}
          onConfirm={() => {
            setStartingOver(false);
            void sessionStore.getState().execute({ kind: "reset" });
          }}
          onCancel={() => setStartingOver(false)}
        />
      ) : null}
    </main>
  );
}
