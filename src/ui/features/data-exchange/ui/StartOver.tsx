/**
 * Возврат к чистому персонажу сборки.
 *
 * Нужен там, где хранилище недоступно руками: на телефоне очистить его нечем — ни консоли, ни
 * настроек сайта под рукой за столом нет, — и приложение, однажды сохранившее чужое или устаревшее
 * состояние, оставалось бы с ним навсегда. Единственная альтернатива, которая приходит в голову
 * игроку, — переустановить приложение, то есть уничтожить сохранение своими руками и вслепую.
 *
 * Живёт одним компонентом, а не двумя: слова у этого дела одни и те же и там, где сохранение не
 * прочиталось, и там, где его меняют осознанно. Названные дважды, они разошлись бы первой же
 * правкой — и игрок прочёл бы два разных обещания об одном и том же нажатии.
 *
 * Подтверждение здесь единственно уместное на всё приложение: отмены у этого нажатия нет, вернуть
 * прежнее можно только из копии, а копия стоит выше по экрану — до нажатия, а не после.
 */

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
          body="Персонаж, журнал и загруженные карточки будут заменены чистыми. Вернуть их получится только из копии, забранной до очистки."
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
