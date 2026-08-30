import { z } from "zod";

import { ARCANA_FIELDS } from "@/core/domain/arcana/schema";
import { CHARACTER_FIELDS } from "@/core/domain/character/schema";
import { CRAFTING_FIELDS } from "@/core/domain/crafting/schema";
import { EFFECTS_FIELDS, refineEffects } from "@/core/domain/effects/schema";
import { EQUIPMENT_FIELDS } from "@/core/domain/equipment/schema";
import { ITEMS_FIELDS } from "@/core/domain/items/schema";
import { NOTES_FIELDS } from "@/core/domain/notes/schema";
import { refineSpellbook, SPELLBOOK_FIELDS } from "@/core/domain/spellbook/schema";
import { VITALITY_FIELDS } from "@/core/domain/vitality/schema";
import { isoDateTime } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

export const EXPORT_SCHEMA_VERSION = 7;

const STATE_FIELDS = {
  ...CHARACTER_FIELDS,
  ...ARCANA_FIELDS,
  ...CRAFTING_FIELDS,
  ...EFFECTS_FIELDS,
  ...EQUIPMENT_FIELDS,
  ...ITEMS_FIELDS,
  ...NOTES_FIELDS,
  ...SPELLBOOK_FIELDS,
  ...VITALITY_FIELDS,
};

export const characterStateSchema = z.object(STATE_FIELDS).superRefine((character, context) => {
  refineSpellbook(character, context);
  refineEffects(character, context);
});

/**
 * Спрашивается своё поле, а не любое доступное: имена вроде `toString` есть у каждого объекта, и
 * поиском по цепочке прототипов они прошли бы за поля состояния.
 */
export function isStateField(key: string): boolean {
  return Object.hasOwn(STATE_FIELDS, key);
}

export const characterStatePatchSchema = z.custom<Partial<CharacterState>>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every(isStateField),
  { message: "Снимок отмены должен быть набором полей состояния" },
);

export const exportFileSchema = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: isoDateTime,
  character: characterStateSchema,
  spells: z.array(z.unknown()),
});

const UNRECORDED_KEYS: readonly (keyof CharacterStateShape)[] = [
  "id",
  "name",
  "className",
  "species",
  "subclass",
  "age",
  "size",
  "speed",
  "proficiencies",
];

export const MUTABLE_STATE_KEYS = characterStateSchema
  .keyof()
  .options.filter((key) => !UNRECORDED_KEYS.includes(key));

type CharacterStateShape = z.infer<typeof characterStateSchema>;

export type CharacterState = DeepReadonly<CharacterStateShape>;
