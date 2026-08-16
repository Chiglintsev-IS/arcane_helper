/**
 * Знак поиска: одно дело названо одним знаком на всех экранах сразу.
 *
 * Рисунком, а не знаком шрифта: шрифтовая лупа берёт начертание системы и цвет эмодзи, то есть на
 * нажатой кнопке остаётся того же тона, что и на ненажатой.
 */
export function Magnifier() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L14 14" strokeLinecap="round" />
    </svg>
  );
}
