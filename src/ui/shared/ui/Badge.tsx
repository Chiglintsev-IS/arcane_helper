import { RULE_MARK } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { TONE_GLYPH, TONE_TEXT, type Tone } from "@/ui/shared/ui/tone";
/**
 * Метка «знак + подпись + цвет».
 *
 * Отдельный компонент нужен ради одного правила: информация никогда не передаётся только цветом.
 * Знак помечен `aria-hidden`, потому что подпись рядом уже сказана словами.
 *
 * Цвет держит край и знак, а подпись остаётся чернилами: подкрашенная подложка меняла бы порог
 * контраста подписи вместе с тоном, и каждый новый тон пришлось бы проверять заново.
 *
 * Знак по умолчанию приходит от тона: у тона он один на всё приложение, и набранный на месте
 * расходится с соседним экраном молча. Свой знак называет та метка, которая берёт тон взаймы —
 * ради нажима или приглушения, — а не ради того значения, которым тон назван.
 */

export function Badge({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  /** Свой знак вместо знака тона: только там, где тон взят взаймы, а не по своему значению. */
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1 text-[0.6875rem] font-medium leading-5 ${SURFACE_GROUP_BARE} ${RULE_MARK[tone]}`}
    >
      <span aria-hidden="true" className={TONE_TEXT[tone]}>
        {icon ?? TONE_GLYPH[tone]}
      </span>
      {children}
    </span>
  );
}
