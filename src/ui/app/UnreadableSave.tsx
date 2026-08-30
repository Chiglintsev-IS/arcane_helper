"use client";

import { RULE_MARK, RULE_ROW } from "@/ui/shared/ui/rule";
import { DataCopy } from "@/ui/features/data-exchange/ui/DataCopy";
import { StartOver } from "@/ui/features/data-exchange/ui/StartOver";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { SURFACE_GROUP, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

export function UnreadableSave() {
  const { session: sessionStore } = useStores();
  const reason = useSession((state) => state.error);
  const rawSave = useSession((state) => state.rawSave);

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
      <StartOver onConfirm={() => void sessionStore.getState().execute({ kind: "reset" })} />
    </main>
  );
}
