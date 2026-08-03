/**
 * Операции привала: короткий отдых, магическое восстановление и долгий отдых.
 *
 * Ни одна не идёт во время боя: короткий отдых — это час, а долгий разом уничтожает состояние
 * схватки, и оба предложения посреди раунда невыполнимы. Магическое восстановление гаснет ещё и по
 * своим причинам: пока не было короткого отдыха и когда дневной бюджет исчерпан. Кнопка при этом не
 * исчезает, а гаснет и называет причину словами: пропавшая не отвечает на вопрос «почему нельзя».
 *
 * Порядок рядов — по цене времени: короткий отдых и магическое восстановление, которое он
 * открывает, стоят рядом; долгий отдых — отдельной строкой, потому что он уничтожает состояние боя,
 * и соседство с коротким приглашало бы промахнуться.
 */

"use client";

import type { CharacterState } from "@/core/domain/assembly/state";
import { withPlural } from "@/core/shared/language";
import { RestActionButton } from "./RestActionButton";

const COMBAT_REASON = "Не проходит во время боя";

/**
 * Почему магическое восстановление сейчас недоступно. `null` — доступно.
 *
 * Бой перекрывает собственное предусловие: пока он идёт, называть «берётся после короткого
 * отдыха» бессмысленно — короткий отдых сейчас недоступен по той же причине.
 */
function arcaneRecoveryReason(character: CharacterState, inFight: boolean): string | null {
  if (inFight) return COMBAT_REASON;
  if (character.arcaneRecovery.remaining <= 0) {
    return "Дневной бюджет восстановления исчерпан до следующего долгого отдыха";
  }
  if (character.shortRestSinceLongRest !== true) return "Берётся после короткого отдыха";
  return null;
}

/**
 * Подпись кнопки восстановления: остаток бюджета виден до нажатия, а не после отказа — решение,
 * сколько ячеек возвращать, требует знать остаток заранее.
 */
function arcaneRecoveryLabel(remaining: number): string {
  return `Магическое восстановление · осталось ${withPlural(remaining, ["уровень", "уровня", "уровней"])}`;
}


export function CampActions({
  character,
  inFight,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
}: {
  character: CharacterState;
  /** Идёт ли бой прямо сейчас: ни один из отдыхов внутри раунда не проходит. */
  inFight: boolean;
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
}) {
  const recoveryReason = arcaneRecoveryReason(character, inFight);

  return (
    <section aria-label="Привал" className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <RestActionButton
          onClick={onShortRest}
          name="Короткий отдых · час"
          {...(inFight ? { disabledReason: COMBAT_REASON } : {})}
        />
        {/*
         * Кнопка не исчезает недоступной: пропавшая кнопка не отвечает на вопрос «почему нельзя»,
         * а за столом этот вопрос возникает раньше, чем игрок вспомнит правило. Причина называется
         * словами, как у заклинания в списке, и лечится соседней кнопкой.
         */}
        <RestActionButton
          onClick={onArcaneRecovery}
          name={arcaneRecoveryLabel(character.arcaneRecovery.remaining)}
          {...(recoveryReason === null ? {} : { disabledReason: recoveryReason })}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <RestActionButton
          onClick={onLongRest}
          name="Долгий отдых"
          {...(inFight ? { disabledReason: COMBAT_REASON } : {})}
        />
      </div>
    </section>
  );
}
