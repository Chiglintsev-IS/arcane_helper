/**
 * Ответчик: вопрос договора — в предпросмотр.
 *
 * Отличается от контроллера тем, чего не делает: состояния не меняет, журнала не пишет, повтора не
 * ищет. Спросить дважды — то же самое, что спросить один раз, и обратимости здесь нечему касаться.
 *
 * Считает не сам: набранное отдаётся владельцу правила, и наружу уходит его ответ. Свой расчёт
 * разошёлся бы с тем, которым команда потом откажет или согласится.
 */

import type { Preview, Question } from "@/contract/questions";

import { Character } from "@/core/domain/assembly/character";
import type { LiveSession } from "@/core/application/session";
import { previewLevelChange } from "@/core/application/useCases/sheet";

export function answerQuestion(live: LiveSession, question: Question): Preview {
  const { character } = live.session;

  if (question.kind === "health_preview") {
    return {
      kind: "health_preview",
      effectiveMaximum: Character.of(character).vitality.maximumWith({
        maximumBase: question.maximumBase,
        masterReduction: question.masterReduction,
      }),
    };
  }

  const { changes, hitPoints } = previewLevelChange(character, question.level);
  return {
    kind: "level_preview",
    changes: changes.map((change) => ({
      of: change.of,
      ...(change.of === "slots" ? { slotLevel: change.slotLevel } : {}),
      before: change.before,
      after: change.after,
    })),
    hitPoints,
  };
}
