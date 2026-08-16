import { TONE_CLASS, type Tone } from "@/ui/shared/ui/tone";
/**
 * Метка «цвет + иконка + подпись».
 *
 * Отдельный компонент нужен ради одного правила: информация никогда не передаётся только цветом
 *. Иконка помечена `aria-hidden`, потому что подпись рядом уже сказана словами.
 */

export function Badge({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  /** Иконка обязательна там, где цвет несёт смысл; у нейтральных метки хватает текста. */
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1 text-[0.6875rem] font-medium leading-5 ${TONE_CLASS[tone]}`}
    >
      {icon === undefined ? null : <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
