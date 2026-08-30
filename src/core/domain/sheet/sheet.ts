import { abilityModifier } from "@/core/domain/character/abilities";
import { abilityStatId } from "@/core/domain/shared/stats";
import type {
  Ability,
  ContributionSource,
  SourcedContribution,
  StatId,
} from "@/core/domain/shared/stats";

import { breakdownOf, resolveStats, type Breakdown } from "./resolve";
import { statsOf, type StatFoundation } from "./stats";

export class Sheet {
  private constructor(
    private readonly resolved: ReadonlyMap<StatId, Breakdown<ContributionSource>>,
  ) {}

  static of(foundation: StatFoundation, brought: readonly SourcedContribution[]): Sheet {
    return new Sheet(resolveStats(statsOf(foundation), brought));
  }

  value(stat: StatId): number {
    return this.breakdown(stat).value;
  }

  abilityModifier(ability: Ability): number {
    return abilityModifier(this.value(abilityStatId(ability)));
  }

  breakdown(stat: StatId): Breakdown<ContributionSource> {
    return breakdownOf(this.resolved, stat);
  }
}
