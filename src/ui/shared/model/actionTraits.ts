import type { SpellRowView } from "@/contract/views";

export type ActionTraits = {
  nameRu: string;
  castingTime: string;
  level: number;
  concentration: boolean;
  role: string;
};

export function lastHintTraits(nameRu: string): ActionTraits {
  return { nameRu, castingTime: "special", level: 0, concentration: false, role: "other" };
}

export function animalSpeechTraits(nameRu: string): ActionTraits {
  return { nameRu, castingTime: "special", level: 0, concentration: false, role: "other" };
}

export function wardingSigilTraits(nameRu: string): ActionTraits {
  return { nameRu, castingTime: "reaction", level: 0, concentration: false, role: "defense" };
}

export function traitsOf(spell: SpellRowView): ActionTraits {
  return {
    nameRu: spell.nameRu,
    castingTime: spell.castingTime.type,
    level: spell.slotPrice,
    concentration: spell.concentration,
    role: spell.role,
  };
}
