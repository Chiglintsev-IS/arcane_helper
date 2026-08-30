import type { Tone } from "@/ui/shared/ui/tone";

export const RULE_SECTION = "border-b-[3px] border-double border-accent";

export const RULE_BLOCK = "border-l-[3px] border-l-accent-rule";

export const RULE_ROW = "border-t border-rule";

export const RULE_GROUP = "border border-rule-strong";

export const RULE_EDGE_TOP = "border-t border-rule-strong";

export const RULE_EDGE_BOTTOM = "border-b border-rule-strong";

export const RULE_ROLE: Record<Tone, string> = {
  action: "border-l-[3px] border-l-action",
  bonus: "border-l-[3px] border-l-bonus",
  reaction: "border-l-[3px] border-l-reaction",
  concentration: "border-l-[3px] border-l-concentration",
  ritual: "border-l-[3px] border-l-ritual",
  offense: "border-l-[3px] border-l-offense",
  defense: "border-l-[3px] border-l-defense",
  roll: "border-l-[3px] border-l-roll",
  muted: "border-l-[3px] border-l-rule-strong",
};

export const RULE_ACTIVE = "border border-accent";

export const RULE_MARK: Record<Tone, string> = {
  action: "border border-action",
  bonus: "border border-bonus",
  reaction: "border border-reaction",
  concentration: "border border-concentration",
  ritual: "border border-ritual",
  offense: "border border-offense",
  defense: "border border-defense",
  roll: "border border-roll",
  muted: "border border-off",
};
