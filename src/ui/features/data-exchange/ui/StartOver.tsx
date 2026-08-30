"use client";

import { useState } from "react";

import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { ConfirmSheet } from "@/ui/shared/ui/ConfirmSheet";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

const TITLE = "Чистое состояние";

export function StartOver({ onConfirm }: { onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <h3 className="text-sm font-semibold">{TITLE}</h3>
      <p className="text-xs text-ink-quiet">
        Приложение начнёт с чистого Торна из сборки. Сохранение при этом заменяется — копию берут до,
        а не после.
      </p>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={`min-h-11 px-3 text-sm text-reaction ${SURFACE_CONTROL}`}
      >
        Начать заново
      </button>

      {asking ? (
        <ConfirmSheet
          title="Начать заново?"
          body="Персонаж, лог и загруженные карточки будут заменены чистыми. Вернуть их получится только из копии, забранной до очистки."
          confirmLabel="Удалить и начать"
          cancelLabel={BUTTON_LABELS.dismiss}
          onConfirm={() => {
            setAsking(false);
            onConfirm();
          }}
          onCancel={() => setAsking(false)}
        />
      ) : null}
    </>
  );
}
