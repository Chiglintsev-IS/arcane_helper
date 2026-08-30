import type { Spell } from "@/core/domain/catalog/spell";

export const COMBAT_ROLES = ["offense", "defense", "other"] as const;

type CombatRole = (typeof COMBAT_ROLES)[number];

export function combatRoleOf(spell: Spell): CombatRole {
  return spell.combatRole ?? "other";
}
