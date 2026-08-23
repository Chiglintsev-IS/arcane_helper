/**
 * Строка списка: рамка, роль тремя носителями и имя в шапке.
 *
 * Одна на заклинание и на то, что заклинанием не является. Пока каждая строка одевалась сама,
 * «Последняя подсказка» стояла в списке без рамки и без линейки роли, а роль называла одним серым
 * словом — и строка читалась заголовком раздела, а не тем, чем можно сходить. Строки в одном списке
 * обязаны выглядеть одинаково: разный вид читается как разное правило.
 *
 * Роль приходит готовой парой «тон и слово»: подпись и цвет роли принадлежат её владельцу, а здесь
 * они только расставляются по трём носителям — линейка с краю, знак и слово в углу.
 */

import { RULE_GROUP, RULE_ROLE } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP, SURFACE_PAGE } from "@/ui/shared/ui/surface";
import { TONE_GLYPH, TONE_TEXT, type Tone } from "@/ui/shared/ui/tone";

/**
 * Ступень приглушённой строки: она остаётся лежать на странице, пока доступная приподнята.
 *
 * Прозрачностью строку гасить нельзя: она гасит и текст, и значки вместе с ним — контраст падает до
 * 2.8 при требуемых 4.5, и это ловит прогон axe. Приглушение живёт в ступени, а причина, по которой
 * строка приглушена, написана на ней словами.
 */
const DIMMED_SURFACE = `${SURFACE_PAGE} ${RULE_GROUP}`;

export function ActionRow({
  nameRu,
  role,
  dimmed = false,
  corner,
  aside,
  onOpen,
  children,
}: {
  nameRu: string;
  /** Роль в бою: тон красит линейку, знак и слово, а называет её владелец подписи. */
  role: { tone: Tone; label: string };
  /** Строка приподнята, пока ею можно сходить: приглушённая объясняет причину словами внутри. */
  dimmed?: boolean;
  /** Что стоит в углу перед ролью: буквы компонентов у заклинания, ничего — у прочих строк. */
  corner?: React.ReactNode;
  /** Кнопка рядом со строкой, а не внутри неё: подготовка в «Книге». */
  aside?: React.ReactNode;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onOpen}
        className={`flex flex-1 flex-col items-start gap-1 p-2 text-left ${
          dimmed ? DIMMED_SURFACE : SURFACE_GROUP
        } ${RULE_ROLE[role.tone]}`}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="font-medium leading-tight">{nameRu}</span>
          <span className="flex shrink-0 items-baseline gap-1.5 text-[0.625rem]">
            {corner}
            <span className={TONE_TEXT[role.tone]}>
              <span aria-hidden="true">{TONE_GLYPH[role.tone]}</span> {role.label}
            </span>
          </span>
        </span>
        {children}
      </button>
      {aside}
    </li>
  );
}
