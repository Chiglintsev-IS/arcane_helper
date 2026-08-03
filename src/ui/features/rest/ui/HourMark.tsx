/**
 * «Прошёл час»: единственная кнопка на два режима — «Игра» и «Привал».
 *
 * Один компонент, а не две реализации: та же кнопка, показанная в двух местах, обязана исчезать,
 * называть итог и гаснуть в бою одинаково — иначе один из режимов рано или поздно забудет про
 * правку, внесённую в другом.
 *
 * Час не только даёт, но и берёт: сгорят очки заклинаний, созданные до него. Подпись обязана
 * назвать это число заранее — нажатие тратит ресурс молча, а строка списка так не делает ни для
 * одного заклинания.
 */

"use client";

import type { CharacterState } from "@/core/domain/assembly/state";
import { Vitality } from "@/core/domain/vitality/vitality";
import { Arcana } from "@/core/domain/arcana/arcana";
import { withPlural } from "@/core/shared/language";
import { RestActionButton } from "./RestActionButton";

/**
 * Подпись «Прошёл час»: называет всё, что случится именно сейчас, и только это. Максимум без
 * остатка не упомянут, очков без остатка тоже нет — иначе кнопка обещала бы то, чего не сделает.
 *
 * Три факта те же, что в записи журнала, но время другое: кнопка обещает, журнал сообщает. Одна
 * строка на оба случая читалась бы за столом как «уже произошло».
 */
function hourLabel(maximumReturn: number, healed: number, spellPoints: number): string {
  const facts = [
    ...(maximumReturn > 0 ? [`максимум +${maximumReturn}`] : []),
    ...(healed > 0 ? [`регенерация +${healed}`] : []),
    ...(spellPoints > 0 ? [`сгорит ${withPlural(spellPoints, ["очко", "очка", "очков"])}`] : []),
  ];
  return facts.length === 0 ? "Прошёл час" : `Прошёл час · ${facts.join(", ")}`;
}

export function HourMark({
  character,
  inFight,
  onRecoverMaximum,
}: {
  character: CharacterState;
  /** Идёт ли бой прямо сейчас: внутри раунда час не проходит. */
  inFight: boolean;
  onRecoverMaximum: () => void;
}) {
  const { returned, healed } = Vitality.of(character).afterAnHour(character.level);
  const spellPoints = Arcana.of(character).spellPoints;
  // Кнопка, которая гарантированно ответит отказом, занимает ряд и обещает возможность, которой
  // нет: часу нечего менять — кнопки тоже нет.
  if (returned <= 0 && healed <= 0 && spellPoints <= 0) return null;

  return (
    <RestActionButton
      onClick={onRecoverMaximum}
      name={hourLabel(returned, healed, spellPoints)}
      {...(inFight ? { disabledReason: "Час не проходит во время боя" } : {})}
    />
  );
}
