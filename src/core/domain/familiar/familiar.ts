import { abilityModifier, passivePerception } from "@/core/domain/character/abilities";
import { ABILITIES, type Ability } from "@/core/domain/shared/stats";

const FAMILIAR_SKILLS = ["herbalism", "perception"] as const;

type FamiliarSkillId = (typeof FAMILIAR_SKILLS)[number];

type FamiliarSkill = {
  nameRu: string;
  ability: Ability;
  base: number;
  advantageRu: string;
};

type FamiliarTrait = {
  nameRu: string;
  textRu: string;
};

export type FamiliarRecord = {
  nameRu: string;
  kindRu: string;
  armorClass: number;
  hitPointsRu: string;
  speedsRu: readonly string[];
  sensesRu: readonly string[];
  languagesRu: string;
  dangerRu: string;
  proficiencyRu: string;
  scores: Readonly<Record<Ability, number>>;
  skills: Readonly<Record<FamiliarSkillId, FamiliarSkill>>;
  traits: readonly FamiliarTrait[];
  obligationsRu: readonly string[];
};

type FamiliarCheck = {
  nameRu: string;
  ability: Ability;
  value: number;
  advantageRu: string;
};

type FamiliarScore = {
  ability: Ability;
  score: number;
  modifier: number;
};

export class Familiar {
  private constructor(
    private readonly card: FamiliarRecord,
    private readonly contractorProficiency: number,
  ) {}

  /**
   * Контракт отдаёт фамильяру бонус мастерства контрактора: его навыки растут вместе с уровнем
   * того, кто его связал, а не сами по себе.
   */
  static bondedTo(card: FamiliarRecord, contractorProficiency: number): Familiar {
    return new Familiar(card, contractorProficiency);
  }

  get checks(): readonly FamiliarCheck[] {
    return FAMILIAR_SKILLS.map((id) => {
      const skill = this.card.skills[id];
      return {
        nameRu: skill.nameRu,
        ability: skill.ability,
        value: skill.base + this.contractorProficiency,
        advantageRu: skill.advantageRu,
      };
    });
  }

  get passivePerception(): number {
    return passivePerception(this.card.skills.perception.base + this.contractorProficiency);
  }

  get scores(): readonly FamiliarScore[] {
    return ABILITIES.map((ability) => ({
      ability,
      score: this.card.scores[ability],
      modifier: abilityModifier(this.card.scores[ability]),
    }));
  }
}
