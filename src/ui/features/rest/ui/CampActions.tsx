/**
 * Операции привала: чем восстановиться, пока бой не идёт.
 *
 * Показывается только то, что сейчас сделать можно: магическое восстановление гаснет, пока не было
 * короткого отдыха и когда оно израсходовано, «Прошёл час» исчезает, когда максимум хитов не
 * снижен. Кнопка, которая гарантированно ответит отказом, занимает ряд и обещает возможность.
 *
 * Порядок рядов — по цене времени: час стоит рядом с тем, что он открывает, восемь часов идут
 * отдельной строкой. Долгий отдых уничтожает состояние боя, и соседство с коротким приглашало бы
 * промахнуться.
 */

"use client";

import type { CharacterState } from "@/core/domain/character/state";
import { maximumRecoveryPerHour } from "@/core/domain/vitality/blood";
import { Vitality } from "@/core/domain/vitality/vitality";

/**
 * Почему магическое восстановление сейчас недоступно. `null` — доступно.
 *
 * Короткий отдых — предусловие правила, а не подсказка: без него восстановления не бывает. Отдых,
 * случившийся за столом без нажатия кнопки, отмечается соседней кнопкой — она в том же ряду.
 */
function arcaneRecoveryReason(character: CharacterState): string | null {
  if (!character.arcaneRecoveryAvailable) return "Уже использовано до следующего долгого отдыха";
  if (character.shortRestSinceLongRest !== true) return "Берётся после короткого отдыха";
  return null;
}

export function CampActions({
  character,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
  onRecoverMaximum,
}: {
  character: CharacterState;
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
  onRecoverMaximum: () => void;
}) {
  const vitality = Vitality.of(character);
  const hourReturns = Math.min(
    maximumRecoveryPerHour(character.level),
    vitality.bloodReduction,
  );
  const recoveryReason = arcaneRecoveryReason(character);

  return (
    <section aria-label="Привал" className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <Action onClick={onShortRest} name="Короткий отдых · час" />
        {/*
         * Кнопка не исчезает недоступной: пропавшая кнопка не отвечает на вопрос «почему нельзя»,
         * а за столом этот вопрос возникает раньше, чем игрок вспомнит правило. Причина называется
         * словами, как у заклинания в списке, и лечится соседней кнопкой.
         */}
        <Action
          onClick={onArcaneRecovery}
          name="Магическое восстановление"
          {...(recoveryReason === null ? {} : { disabledReason: recoveryReason })}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <Action onClick={onLongRest} name="Долгий отдых" />
        {vitality.bloodReduction > 0 ? (
          <Action onClick={onRecoverMaximum} name={`Прошёл час · максимум +${hourReturns}`} />
        ) : null}
      </div>
    </section>
  );
}

/**
 * Кнопка операции — одна строка и только название.
 *
 * Цена в подписи («1 час», «8 часов») делала шапку привала выше экрана: три ряда кнопок по два ряда
 * текста в каждом. Час против восьми часов игрок и так знает — это базовые правила, — а число
 * остаётся только там, где его не угадать: сколько вернёт прошедший час.
 */
function Action({
  onClick,
  name,
  disabledReason,
}: {
  onClick: () => void;
  name: string;
  /** Причина недоступности словами. Кнопка гаснет, но остаётся видимой и объясняет себя. */
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabledReason !== undefined}
      {...(disabledReason === undefined ? {} : { title: disabledReason })}
      aria-label={disabledReason === undefined ? undefined : `${name} — ${disabledReason}`}
      className="min-h-11 grow whitespace-nowrap rounded-xl border border-slate-200 px-3 text-sm font-medium disabled:opacity-50 dark:border-slate-800"
    >
      {name}
    </button>
  );
}
