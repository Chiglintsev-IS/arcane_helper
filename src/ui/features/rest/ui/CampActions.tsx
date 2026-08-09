/**
 * Операции привала: короткий отдых, магическое восстановление и долгий отдых.
 *
 * Ни одна не идёт во время боя, и у магического восстановления есть ещё свои причины. Какая из них
 * сейчас главная, решают правила: кнопка получает готовую фразу и её же показывает. Кнопка при этом
 * не исчезает, а гаснет и называет причину словами: пропавшая не отвечает на вопрос «почему нельзя».
 *
 * Порядок рядов — по цене времени: короткий отдых и магическое восстановление, которое он
 * открывает, стоят рядом; долгий отдых — отдельной строкой, потому что он уничтожает состояние боя,
 * и соседство с коротким приглашало бы промахнуться.
 */

"use client";

import type { RecoveryView } from "@/contract/views";
import { withPlural } from "@/core/shared/language";
import { ARCANE_RECOVERY_LABEL } from "@/ui/entities/character/lib/labels";
import { RestActionButton } from "./RestActionButton";

/**
 * Подпись кнопки восстановления: остаток бюджета виден до нажатия, а не после отказа — решение,
 * сколько ячеек возвращать, требует знать остаток заранее.
 */
function arcaneRecoveryLabel(remaining: number): string {
  return `${ARCANE_RECOVERY_LABEL} · осталось ${withPlural(remaining, ["уровень", "уровня", "уровней"])}`;
}

/** Причина отказа приезжает готовой; её отсутствие и означает «можно». */
function disabled(reasonRu: string | undefined): { disabledReason?: string } {
  return reasonRu === undefined ? {} : { disabledReason: reasonRu };
}

export function CampActions({
  recovery,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
}: {
  recovery: RecoveryView;
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
}) {
  const { arcaneRecovery } = recovery;

  return (
    <section aria-label="Привал" className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <RestActionButton
          onClick={onShortRest}
          name="Короткий отдых · час"
          {...disabled(recovery.shortRestUnavailabilityRu)}
        />
        {/*
         * Кнопка не исчезает недоступной: пропавшая кнопка не отвечает на вопрос «почему нельзя»,
         * а за столом этот вопрос возникает раньше, чем игрок вспомнит правило. Причина называется
         * словами, как у заклинания в списке, и лечится соседней кнопкой.
         */}
        <RestActionButton
          onClick={onArcaneRecovery}
          name={arcaneRecoveryLabel(arcaneRecovery.remaining)}
          {...disabled(arcaneRecovery.unavailabilityRu)}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <RestActionButton
          onClick={onLongRest}
          name="Долгий отдых"
          {...disabled(recovery.longRestUnavailabilityRu)}
        />
      </div>
    </section>
  );
}
