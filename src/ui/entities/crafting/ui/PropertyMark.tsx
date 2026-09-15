import { propertyMarks } from "@/ui/entities/crafting/lib/labels";
import { RULE_GROUP } from "@/ui/shared/ui/rule";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

const SEPARATOR = " · ";

type Marked = { readonly dirRu: string | null; readonly rarityRu: string | null };

/** Словами то же, что полосами: цветом одним смысл не передаётся. */
export function markNameRu(slot: Marked): string {
  return propertyMarks(slot)
    .map((mark) => mark.labelRu)
    .join(SEPARATOR);
}

/**
 * Особая редкость не берёт себе цвета: свободных в палитре нет, и всякий занятый спутали бы со
 * ступенью лестницы или с направлением. Полоса собрана из всех цветов значений разом — так видно,
 * что это не строка справочника, а то, что назвал стол. Цвета взяты у палитры, своих здесь нет.
 */
/* Класс собран одной строкой: склеенный из кусков Tailwind не увидит и правило не соберёт. */
// prettier-ignore
const SPECIAL_STRIPE = "[background-image:repeating-linear-gradient(135deg,var(--color-damage)_0_2px,var(--color-roll)_2px_4px,var(--color-ritual)_4px_6px,var(--color-concentration)_6px_8px,var(--color-action)_8px_10px,var(--color-bonus)_10px_12px)]";

/** Полоса шире волосяной линии: её читают цветом, а тонкую полосу цветом не прочесть. */
const STRIPE_WIDTH = "w-2";

/** Та же полоса всех цветов стоит и на кнопке выбора: выбираемое и выбранное помечены одинаково. */
export function SpecialStripe({ height }: { height: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 ${STRIPE_WIDTH} ${height} ${SPECIAL_STRIPE}`}
    />
  );
}

/**
 * Пометки свойства полосами: полоса на каждую пометку, в том же порядке, в каком они читаются
 * словами. Полос столько, сколько мастер назвал: направление и редкость.
 */
export function PropertyStripes({ slot, height }: { slot: Marked; height: string }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 gap-0.5">
      {propertyMarks(slot).map((mark) =>
        mark.special ? (
          <SpecialStripe key={mark.labelRu} height={height} />
        ) : (
          <span
            key={mark.labelRu}
            className={`${STRIPE_WIDTH} ${height} ${TONE_TEXT[mark.tone]} bg-current`}
          />
        ),
      )}
    </span>
  );
}

/** Нераскрытое место: полосе взяться неоткуда, и стоит пустая рамка той же ширины. */
export function EmptyStripes({ height }: { height: string }) {
  return (
    <span aria-hidden="true" className={`block shrink-0 ${STRIPE_WIDTH} ${height} ${RULE_GROUP}`} />
  );
}
