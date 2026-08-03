/**
 * Операции привала: чем восстановиться, пока бой не идёт.
 *
 * Показывается только то, что сейчас сделать можно: магическое восстановление гаснет, пока не было
 * короткого отдыха и когда его дневной бюджет исчерпан. «Прошёл час» исчезает, когда часу нечего изменить — ни
 * вернуть максимум, ни долечить регенерацией, ни погасить очки заклинаний: кнопка, которая
 * гарантированно ответит отказом, занимает ряд и обещает возможность. Внутри боя у часа есть что
 * менять, но пройти он не может — кнопка остаётся и называет причину словами, как и магическое
 * восстановление.
 *
 * Час не только даёт, но и берёт: сгорят очки заклинаний, созданные до него. Подпись обязана
 * назвать это число заранее — нажатие тратит ресурс молча, а строка списка так не делает ни для
 * одного заклинания.
 *
 * Порядок рядов — по цене времени: час стоит рядом с тем, что он открывает, восемь часов идут
 * отдельной строкой. Долгий отдых уничтожает состояние боя, и соседство с коротким приглашало бы
 * промахнуться.
 */

"use client";

import type { CharacterState } from "@/core/domain/character/state";
import { Vitality } from "@/core/domain/vitality/vitality";
import { Arcana } from "@/core/domain/arcana/arcana";
import { withPlural } from "@/core/shared/language";

/**
 * Почему магическое восстановление сейчас недоступно. `null` — доступно.
 *
 * Короткий отдых — предусловие правила, а не подсказка: без него восстановления не бывает. Отдых,
 * случившийся за столом без нажатия кнопки, отмечается соседней кнопкой — она в том же ряду.
 */
function arcaneRecoveryReason(character: CharacterState): string | null {
  if (character.arcaneRecovery.remaining <= 0) {
    return "Дневной бюджет восстановления исчерпан до следующего долгого отдыха";
  }
  if (character.shortRestSinceLongRest !== true) return "Берётся после короткого отдыха";
  return null;
}

/**
 * Подпись кнопки восстановления: остаток бюджета виден до открытия шторки, а не после отказа —
 * решение, сколько ячеек возвращать, требует знать остаток заранее.
 */
function arcaneRecoveryLabel(remaining: number): string {
  return `Магическое восстановление · осталось ${withPlural(remaining, ["уровень", "уровня", "уровней"])}`;
}

/**
 * Подпись «Прошёл час»: называет только то, что случится именно сейчас. Максимум без остатка не
 * упомянут, очков без остатка тоже нет — иначе кнопка обещала бы то, чего не сделает.
 */
function hourLabel(maximumReturn: number, spellPoints: number): string {
  const facts = [
    ...(maximumReturn > 0 ? [`максимум +${maximumReturn}`] : []),
    ...(spellPoints > 0 ? [`сгорит ${withPlural(spellPoints, ["очко", "очка", "очков"])}`] : []),
  ];
  return facts.length === 0 ? "Прошёл час" : `Прошёл час · ${facts.join(", ")}`;
}

export function CampActions({
  character,
  inFight,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
  onRecoverMaximum,
}: {
  character: CharacterState;
  /** Идёт ли бой прямо сейчас: внутри раунда час не проходит. */
  inFight: boolean;
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
  onRecoverMaximum: () => void;
}) {
  const { returned: hourReturns, healed: hourHealed } = Vitality.of(character).afterAnHour(
    character.level,
  );
  const spellPoints = Arcana.of(character).spellPoints;
  const hourHasWork = hourReturns > 0 || hourHealed > 0 || spellPoints > 0;
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
          name={arcaneRecoveryLabel(character.arcaneRecovery.remaining)}
          {...(recoveryReason === null ? {} : { disabledReason: recoveryReason })}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <Action onClick={onLongRest} name="Долгий отдых" />
        {hourHasWork ? (
          <Action
            onClick={onRecoverMaximum}
            name={hourLabel(hourReturns, spellPoints)}
            {...(inFight ? { disabledReason: "Час не проходит во время боя" } : {})}
          />
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
