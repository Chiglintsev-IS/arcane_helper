import { z } from "zod";

import type { Spell } from "@/core/domain/catalog/spell";

const COMBAT_ROLES = [
  "damage",
  "hindrance",
  "support",
  "movement",
  "healing",
  "scouting",
  "other",
] as const;

type CombatRole = (typeof COMBAT_ROLES)[number];

const OTHER_ROLE: CombatRole = "other";

/**
 * Имена ролей прежних выгрузок. «Боевое» звалось одним словом там, где теперь стоит урон, а
 * защита и усиление были двумя ролями там, где вопрос игрока один: чем помочь своим.
 */
const retired = (name: string, role: CombatRole) =>
  z.literal(name).transform((): CombatRole => role);

const combatRoleSchema = z.union([
  z.enum(COMBAT_ROLES),
  retired("offense", "damage"),
  retired("defense", "support"),
  retired("buff", "support"),
]);

function withoutRepeats(roles: readonly CombatRole[]): boolean {
  return new Set(roles).size === roles.length;
}

function otherStandsAlone(roles: readonly CombatRole[]): boolean {
  return !roles.includes(OTHER_ROLE) || roles.length === 1;
}

export const combatRolesSchema = z
  .array(combatRoleSchema)
  .min(1, { message: "Перечень ролей в бою не бывает пустым" })
  .refine(withoutRepeats, { message: "Роль в перечне не повторяется" })
  .refine(otherStandsAlone, {
    message: "«Прочее» стоит одно: заклинание с боевой ролью прочим не бывает",
  });

type RetiredSingleRoleCard = { combatRole: unknown; combatRoles?: unknown };

function carriesRetiredSingleRole(raw: unknown): raw is RetiredSingleRoleCard {
  return typeof raw === "object" && raw !== null && "combatRole" in raw && !("combatRoles" in raw);
}

export function foldRetiredSingleRole(raw: unknown): unknown {
  if (!carriesRetiredSingleRole(raw)) return raw;
  const { combatRole, ...rest } = raw;
  return { ...rest, combatRoles: [combatRole] };
}

export function combatRolesOf(spell: Spell): readonly CombatRole[] {
  return spell.combatRoles ?? [OTHER_ROLE];
}
