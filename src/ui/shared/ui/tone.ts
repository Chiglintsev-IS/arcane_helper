export type Tone =
  | "action"
  | "bonus"
  | "reaction"
  | "concentration"
  | "ritual"
  | "damage"
  | "hindrance"
  | "support"
  | "roll"
  | "muted";

/** Знаки типографские, а не картинки: масштабируются с системным шрифтом и не грузятся. */
export const TONE_GLYPH: Record<Tone, string> = {
  action: "●",
  bonus: "◆",
  reaction: "↺",
  concentration: "◉",
  ritual: "◈",
  damage: "✚",
  hindrance: "▼",
  support: "▲",
  roll: "⚄",
  muted: "✗",
};

export const TONE_TEXT: Record<Tone, string> = {
  action: "text-action",
  bonus: "text-bonus",
  reaction: "text-reaction",
  concentration: "text-concentration",
  ritual: "text-ritual",
  damage: "text-damage",
  hindrance: "text-hindrance",
  support: "text-support",
  roll: "text-roll",
  muted: "text-off",
};
