export const SCREEN_MODES = [
  "play",
  "notes",
  "book",
  "sheet",
  "things",
  "alchemy",
  "smithing",
  "familiar",
  "rest",
  "log",
] as const;

export type ScreenMode = (typeof SCREEN_MODES)[number];

export const DEFAULT_SCREEN_MODE: ScreenMode = "play";

/**
 * Как режим зовётся на экране: имя произносят и нижняя навигация, и всякий возврат на
 * приведший экран. Место у имени одно, иначе «назад» назвало бы режим иначе, чем кнопка.
 */
export const SCREEN_LABELS: Record<ScreenMode, { title: string; hint: string }> = {
  play: { title: "Игра", hint: "то, чем ходят" },
  book: { title: "Книга", hint: "весь состав целиком, для чтения и сверки" },
  things: { title: "Вещи", hint: "надетое с защитой, счётное с деньгами и чего не хватает" },
  rest: { title: "Привал", hint: "отдых и восстановление" },
  log: { title: "Лог", hint: "что случилось, что можно отменить и где взять копию" },
  sheet: { title: "Лист", hint: "кто он: уровень, характеристики, навыки, владения" },
  alchemy: { title: "Алхимия", hint: "виды ингредиентов, их свойства и верстак состава" },
  smithing: { title: "Кузнечное дело", hint: "правил мастер пока не дал" },
  notes: { title: "Заметки", hint: "записанное о мире: места, имена, обещания" },
  familiar: { title: "Фамильяр", hint: "фрубит: о чём просить и что обещано" },
};
