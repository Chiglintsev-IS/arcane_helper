export const SCREEN_MODES = [
  "play",
  "notes",
  "book",
  "sheet",
  "things",
  "crafting",
  "rest",
  "log",
] as const;

export type ScreenMode = (typeof SCREEN_MODES)[number];

export const DEFAULT_SCREEN_MODE: ScreenMode = "play";
