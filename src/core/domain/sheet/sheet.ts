/**
 * Лист — итог: то, что действует за столом прямо сейчас.
 *
 * Своего состояния у листа нет вовсе. Он получает основание — то, что персонаж хранит, — и
 * принесённые вклады, и складывает одно с другим единой свёрткой: у Класса Доспеха нет больше
 * собственного движка слоёв, а у пассивной внимательности — собственной формулы, и разойтись им нечем.
 *
 * Кто вклад прислал, лист не спрашивает: снаряжение, каталог и слово мастера приходят одной формой.
 * Поэтому здесь нет ни импорта снаряжения, ни импорта вещей — иначе снятое кольцо правило бы
 * характеристики.
 */

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

  /**
   * Вклады — обязательный довод, а не удобное умолчание.
   *
   * Пустой список по умолчанию однажды уже дал листу считать без надетого и без действующего: экран
   * звал лист напрямую и получал числа, которых за столом нет. Забыть вклады теперь нельзя —
   * собирает их корень персонажа.
   */
  static of(foundation: StatFoundation, brought: readonly SourcedContribution[]): Sheet {
    return new Sheet(resolveStats(statsOf(foundation), brought));
  }

  /**
   * Действующее значение величины.
   *
   * Отказ вместо нуля: величина, которой нет в словаре, — опечатка в имени, а не число ноль, и
   * молчаливый ноль объявили бы мастеру за настоящий.
   */
  value(stat: StatId): number {
    return this.breakdown(stat).value;
  }

  /**
   * Модификатор характеристики — по действующему её значению, а не по записанному.
   *
   * Здесь, а не у персонажа: назначенный мастером Интеллект обязан двигать и лечение Костями хитов,
   * и подпись в мастере применения, а персонаж про назначения не знает.
   */
  abilityModifier(ability: Ability): number {
    return abilityModifier(this.value(abilityStatId(ability)));
  }

  /** Разбор: итог вместе с вкладами и их источниками — ответ на «почему число такое». */
  breakdown(stat: StatId): Breakdown<ContributionSource> {
    return breakdownOf(this.resolved, stat);
  }
}
