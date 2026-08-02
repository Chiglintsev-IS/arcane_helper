/**
 * Снаряжение: чем персонаж располагает вещественно.
 *
 * Отдельно от книги заклинаний намеренно. Книга отвечает на вопрос «что я умею», снаряжение — «что у
 * меня есть»; связывает их сотворение, которому нужно и то, и другое. Пока книга держала внутри себя
 * мешочек с компонентами, добавить инвентарь было некуда: он оказался бы внутри книги заклинаний.
 *
 * Сегодня здесь ровно то, от чего зависит проверка компонентов. Инвентарь и экипировка вырастут из
 * этого агрегата, а не из книги.
 */

import type { CharacterState } from "@/core/domain/character/state";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";

export type EquipmentState = Pick<CharacterState, "equipment">;

export class Equipment {
  private static readonly KEYS = ["equipment"] as const satisfies readonly (keyof EquipmentState)[];

  private constructor(private readonly state: EquipmentState) {}

  static of(state: EquipmentState): Equipment {
    return new Equipment(ownedFields(state, Equipment.KEYS));
  }

  /**
   * Заведено ли снаряжение вообще.
   *
   * Состояние могло прийти выгрузкой из сборки, которая про снаряжение не знала. Тогда вердикта о
   * компонентах нет вовсе: «компонента нет» было бы выдумкой про чужого персонажа.
   */
  get known(): boolean {
    return this.state.equipment !== undefined;
  }

  /** Заменяет ли что-нибудь материальные компоненты без стоимости. */
  get replacesFreeComponents(): boolean {
    const { equipment } = this.state;
    return equipment !== undefined && (equipment.spellcastingFocus || equipment.componentPouch);
  }

  /** Лежит ли в сумке дорогой компонент конкретного заклинания: фокусировка его не заменяет. */
  hasMaterialFor(spellId: string): boolean {
    return this.state.equipment?.materialsForSpellIds.includes(spellId) === true;
  }

  toggleMaterial(spellId: string): { equipment: Equipment; owned: boolean } {
    const current = this.state.equipment;
    if (current === undefined) {
      throw new DomainError("У персонажа не заведено снаряжение");
    }
    const owned = current.materialsForSpellIds.includes(spellId);
    return {
      equipment: new Equipment({
        equipment: {
          ...current,
          materialsForSpellIds: owned
            ? current.materialsForSpellIds.filter((id) => id !== spellId)
            : [...current.materialsForSpellIds, spellId],
        },
      }),
      owned: !owned,
    };
  }

  toState(): EquipmentState {
    return this.state;
  }
}
