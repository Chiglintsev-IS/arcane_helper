import type { Tone } from "@/ui/shared/ui/tone";

export const RULE_SECTION = "border-b-[3px] border-double border-accent";

export const RULE_BLOCK = "border-l-[3px] border-l-accent-rule";

/** Линейка под заголовком работы: одинарная — двойная отбивает раздел, а не шаг внутри него. */
export const RULE_TITLE = "border-b border-accent-rule";

export const RULE_ROW = "border-t border-rule";

/** Волосяная линия между столбцами строки: тем же волоском, что делит соседей списка. */
export const RULE_COLUMN = "border-l border-rule";

/** Волосяная линия между соседями списка: первого она не подчёркивает. */
export const RULE_BETWEEN = "divide-y divide-rule";

export const RULE_GROUP = "border border-rule-strong";

export const RULE_EDGE_TOP = "border-t border-rule-strong";

export const RULE_EDGE_BOTTOM = "border-b border-rule-strong";

export const RULE_ROLE: Record<Tone, string> = {
  action: "border-l-[3px] border-l-action",
  bonus: "border-l-[3px] border-l-bonus",
  reaction: "border-l-[3px] border-l-reaction",
  concentration: "border-l-[3px] border-l-concentration",
  ritual: "border-l-[3px] border-l-ritual",
  damage: "border-l-[3px] border-l-damage",
  hindrance: "border-l-[3px] border-l-hindrance",
  support: "border-l-[3px] border-l-support",
  roll: "border-l-[3px] border-l-roll",
  muted: "border-l-[3px] border-l-rule-strong",
};

export const RULE_ACTIVE = "border border-accent";

/** Кромка открытой строки списка: у прочих на её месте пустое поле той же ширины. */
export const RULE_EDGE_ACTIVE = "border-l-4 border-l-accent";
export const RULE_EDGE_QUIET = "border-l-4 border-l-transparent";

/** Рамка вокруг знака: она держит квадрат, в котором стоит типографский знак раздела. */
export const RULE_SIGN = "border border-accent-rule";

/** Кромка роли пошире: ею отбивают карточку и слот, где роль читают раньше самого текста. */
export const RULE_ROLE_WIDE: Record<Tone, string> = {
  action: "border-l-4 border-l-action",
  bonus: "border-l-4 border-l-bonus",
  reaction: "border-l-4 border-l-reaction",
  concentration: "border-l-4 border-l-concentration",
  ritual: "border-l-4 border-l-ritual",
  damage: "border-l-4 border-l-damage",
  hindrance: "border-l-4 border-l-hindrance",
  support: "border-l-4 border-l-support",
  roll: "border-l-4 border-l-roll",
  muted: "border-l-4 border-l-rule-strong",
};

/** Кромка плитки сверху: под ней стоит число, и род числа виден раньше подписи. */
export const RULE_TILE: Record<Tone, string> = {
  action: "border-t-2 border-t-action",
  bonus: "border-t-2 border-t-bonus",
  reaction: "border-t-2 border-t-reaction",
  concentration: "border-t-2 border-t-concentration",
  ritual: "border-t-2 border-t-ritual",
  damage: "border-t-2 border-t-damage",
  hindrance: "border-t-2 border-t-hindrance",
  support: "border-t-2 border-t-support",
  roll: "border-t-2 border-t-roll",
  muted: "border-t-2 border-t-accent",
};

/** Закладка режима: полоса сверху у выбранной и пустое место у прочих — высота строки одна. */
export const RULE_TAB_ON = "border-t-2 border-t-accent";
export const RULE_TAB_OFF = "border-t-2 border-t-transparent";

export const RULE_MARK: Record<Tone, string> = {
  action: "border border-action",
  bonus: "border border-bonus",
  reaction: "border border-reaction",
  concentration: "border border-concentration",
  ritual: "border border-ritual",
  damage: "border border-damage",
  hindrance: "border border-hindrance",
  support: "border border-support",
  roll: "border border-roll",
  muted: "border border-off",
};
