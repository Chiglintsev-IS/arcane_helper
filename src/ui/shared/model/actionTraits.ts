import type { SpellRowView } from "@/contract/views";

export type ActionTraits = {
  nameRu: string;
  castingTime: string;
  level: number;
  concentration: boolean;
  roles: readonly string[];
};

export function lastHintTraits(nameRu: string): ActionTraits {
  return { nameRu, castingTime: "special", level: 0, concentration: false, roles: ["other"] };
}

export function animalSpeechTraits(nameRu: string): ActionTraits {
  return { nameRu, castingTime: "special", level: 0, concentration: false, roles: ["other"] };
}

export function wardingSigilTraits(nameRu: string): ActionTraits {
  return { nameRu, castingTime: "reaction", level: 0, concentration: false, roles: ["defense"] };
}

export function traitsOf(spell: SpellRowView): ActionTraits {
  return {
    nameRu: spell.nameRu,
    castingTime: spell.castingTime.type,
    level: spell.slotPrice,
    concentration: spell.concentration,
    roles: spell.roles,
  };
}
