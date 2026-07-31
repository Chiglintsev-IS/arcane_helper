/**
 * Черновик применения заклинания (FR-022).
 *
 * Отдельный стор — это техническая гарантия инварианта: состояние персонажа живёт в `sessionStore`,
 * и ни одно действие этого стора его не касается. Выход из мастера на любом шаге, включая закрытие
 * приложения, оставляет ресурсы нетронутыми, потому что менять их отсюда попросту нечем
 * (architecture.md#состояние-и-хранение).
 *
 * Подтверждение выполняет вызывающий: он берёт `toCastRequest` и передаёт её в `castSpell` через
 * единственную точку изменения состояния — `sessionStore.apply`.
 */

import { createStore, type StoreApi } from "zustand/vanilla";

import type { CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import { checkAvailability, type TurnResources } from "@/rules/availability";
import { bestCastPlan, castOptions, type CastOption } from "@/rules/filters";
import type { Rune } from "@/rules/runes";
import { CANTRIP_LEVEL } from "@/rules/slots";
import type { CastRequest } from "./session";

/**
 * Экраны мастера в порядке FR-021. Шаг, где нечего выбирать, не показывается.
 *
 * Последние три шага FR-021 — объявление, отыгрыш и подтверждение — живут на одном экране
 * `summary` раздельными блоками (ADR-0010): иначе типовое применение выходит за бюджет
 * M-03 в четыре основных шага.
 */
export const WIZARD_STEPS = [
  "availability",
  "slot",
  "components",
  "concentration",
  "summary",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Итоговый экран: объявление, отыгрыш, подтверждение. Показывается всегда. */
export const LAST_STEP = "summary" satisfies WizardStep;

/** Шаги, которые показываются по условию. */
const OPTIONAL_STEPS = WIZARD_STEPS.filter(
  (step): step is Exclude<WizardStep, typeof LAST_STEP> => step !== LAST_STEP,
);

/** Категории готовых вариантов отыгрыша (F-04). */
export type RoleplayCategory = "short" | "atmospheric" | "sarcastic";

/** Сколько недавних целей помнить: ввод текста в бою — самая медленная операция (OQ-10). */
export const RECENT_TARGETS_LIMIT = 5;

export type CastDraft = {
  spell: Spell;
  mode: CastOption["mode"];
  payment: CastOption["payment"];
  /** Цель свободным текстом; `null` — не указана, и объявление корректно без неё. */
  targetLabel: string | null;
  roleplayCategory: RoleplayCategory;
  /** Мастер разрешил исключение (FR-031). */
  allowAnyway: boolean;
  /** Приложенная руна или `null`. Не более одной на заклинание (FR-151). */
  rune: Rune | null;
  step: WizardStep;
};

export type DraftContext = {
  character: CharacterState;
  turn: TurnResources;
};

const DEFAULT_ROLEPLAY_CATEGORY: RoleplayCategory = "short";

/** Ключ запоминания — идентификатор заклинания: выбор помнится по заклинанию, а не глобально. */
type Remembered = {
  payment: Record<string, CastOption["payment"]>;
  roleplay: Record<string, RoleplayCategory>;
};

/**
 * Способ оплаты для нового черновика: запомненный выбор игрока важнее предложения по умолчанию.
 *
 * Предложение по умолчанию берётся у `bestCastPlan` — того же способа, чью причину недоступности
 * показывает строка списка. Одна функция на оба места: иначе список объясняет одно, а мастер
 * предлагает другое (F-02, «Причина недоступности берётся у лучшего способа»).
 */
function defaultOption(
  spell: Spell,
  context: DraftContext,
  remembered: Remembered,
): CastOption {
  const rememberedPayment = remembered.payment[spell.id];
  if (rememberedPayment !== undefined) {
    const match = castOptions(spell, context.character).find(
      (option) =>
        option.payment.kind === rememberedPayment.kind &&
        (option.payment.kind !== "slot" ||
          rememberedPayment.kind !== "slot" ||
          option.payment.slotLevel === rememberedPayment.slotLevel),
    );
    if (match !== undefined) return match;
  }

  // Способов может не быть вовсе — заклинание уровня, до которого персонаж не дорос. Тогда оплата
  // не выбрана, и шаг доступности объяснит причину, а не молчаливо пустой мастер.
  const plan = bestCastPlan(spell, context.character, context.turn);
  return plan?.option ?? { mode: "normal", payment: { kind: "none" } };
}

/** Требуется ли отдельный шаг компонентов: фокусировка заменяет всё, кроме стоимости и расхода. */
function needsComponentStep(spell: Spell): boolean {
  const { components } = spell;
  return components.material && (components.costGp !== undefined || components.consumed === true);
}

/**
 * Видимые шаги. Шаг показывается, только если на нём есть что выбрать или о чём предупредить:
 * иначе мастер выходит за бюджет M-03 — не более четырёх основных шагов.
 *
 * Шага выбора цели среди них нет: ввод текста в бою — самая медленная операция, и решением игрока
 * мастер цель не спрашивает ([OQ-10](../../docs/open-questions.md#oq-10)). Подстановка цели в
 * объявлении осталась: она понадобится, если решение изменится после игровой сессии.
 */
export function visibleSteps(
  draft: CastDraft,
  context: DraftContext,
): [...WizardStep[], WizardStep] {
  const { spell } = draft;
  const availability = checkAvailability({
    spell,
    character: context.character,
    turn: context.turn,
    mode: draft.mode,
    payment: draft.payment,
  });
  // Замена концентрации живёт на своём шаге и в проверке доступности не дублируется.
  // Замена концентрации и нехватка компонента живут на своих шагах и в проверке доступности не
  // дублируются: иначе игрок читает одно и то же дважды и жмёт «Далее» не глядя.
  const blocking = availability.warnings.filter(
    (warning) => warning.code !== "concentration_busy" && warning.code !== "no_component",
  );
  // Шаг концентрации — это выбор между двумя эффектами, а не сообщение. Предупреждение приходит
  // ровно тогда, когда концентрация занята и её придётся бросить (FR-081).
  const replacesConcentration = availability.warnings.some(
    (warning) => warning.code === "concentration_busy",
  );

  const optional = OPTIONAL_STEPS.filter((step) => {
    switch (step) {
      case "availability":
        return blocking.length > 0;
      case "slot":
        return spell.level !== CANTRIP_LEVEL;
      case "components":
        return needsComponentStep(spell);
      case "concentration":
        return replacesConcentration;
    }
  });

  // Итоговый экран есть всегда: подтверждение — единственный шаг, который нельзя пропустить.
  return [...optional, LAST_STEP];
}

/** Заявка на применение. Собирается из черновика и уходит в `castSpell` при подтверждении. */
export function toCastRequest(draft: CastDraft): CastRequest {
  return {
    spell: draft.spell,
    mode: draft.mode,
    payment: draft.payment,
    ...(draft.targetLabel === null ? {} : { targetLabel: draft.targetLabel }),
    ...(draft.rune === null ? {} : { rune: draft.rune }),
    allowAnyway: draft.allowAnyway,
  };
}

export type CastDraftState = {
  draft: CastDraft | null;
  /** Недавно введённые цели: выбор из списка вместо ввода экономит секунды в бою. */
  recentTargets: string[];

  start: (spell: Spell, context: DraftContext) => void;
  chooseCastOption: (option: CastOption) => void;
  /** Приложить руну или снять её. Не более одной на заклинание (FR-151). */
  chooseRune: (rune: Rune) => void;
  setTarget: (label: string) => void;
  setRoleplayCategory: (category: RoleplayCategory) => void;
  /** «Применить всё равно»: предупреждения перестают мешать (FR-031). */
  allowAnyway: () => void;
  next: (steps: readonly WizardStep[]) => void;
  back: (steps: readonly WizardStep[]) => void;
  cancel: () => void;
};

function shift(
  draft: CastDraft,
  steps: readonly WizardStep[],
  direction: 1 | -1,
): CastDraft {
  const index = steps.indexOf(draft.step);
  const next = steps[index + direction];
  return next === undefined ? draft : { ...draft, step: next };
}

export function createCastDraftStore(): StoreApi<CastDraftState> {
  return createStore<CastDraftState>((set, get) => {
    const remembered: Remembered = { payment: {}, roleplay: {} };

    /** Правка черновика в одном месте: без черновика правки просто нет. */
    const edit = (change: (draft: CastDraft) => CastDraft): void => {
      const { draft } = get();
      if (draft === null) return;
      set({ draft: change(draft) });
    };

    return {
      draft: null,
      recentTargets: [],

      start(spell, context) {
        const option = defaultOption(spell, context, remembered);
        const draft: CastDraft = {
          spell,
          mode: option.mode,
          payment: option.payment,
          targetLabel: null,
          roleplayCategory: remembered.roleplay[spell.id] ?? DEFAULT_ROLEPLAY_CATEGORY,
          allowAnyway: false,
          rune: null,
          step: "summary",
        };
        // Первый видимый шаг: у списка всегда есть хотя бы итоговый экран.
        const [first] = visibleSteps(draft, context);
        set({ draft: { ...draft, step: first } });
      },

      chooseRune(rune) {
        // Повторное нажатие снимает руну: выбор из трёх без возможности передумать — ловушка.
        edit((draft) => ({ ...draft, rune: draft.rune === rune ? null : rune }));
      },

      chooseCastOption(option) {
        edit((draft) => {
          remembered.payment[draft.spell.id] = option.payment;
          // Ритуал и заговор руну не принимают: выбранная до смены оплаты, она молча пропала бы
          // при подтверждении (FR-151).
          if (option.payment.kind !== "slot") return { ...draft, ...option, rune: null };
          return { ...draft, mode: option.mode, payment: option.payment };
        });
      },

      setTarget(label) {
        const trimmed = label.trim();
        edit((draft) => ({ ...draft, targetLabel: trimmed === "" ? null : trimmed }));
        if (trimmed === "") return;
        set({
          recentTargets: [
            trimmed,
            ...get().recentTargets.filter((candidate) => candidate !== trimmed),
          ].slice(0, RECENT_TARGETS_LIMIT),
        });
      },

      setRoleplayCategory(category) {
        edit((draft) => {
          remembered.roleplay[draft.spell.id] = category;
          return { ...draft, roleplayCategory: category };
        });
      },

      allowAnyway() {
        edit((draft) => ({ ...draft, allowAnyway: true }));
      },

      next(steps) {
        edit((draft) => shift(draft, steps, 1));
      },

      back(steps) {
        edit((draft) => shift(draft, steps, -1));
      },

      cancel() {
        set({ draft: null });
      },
    };
  });
}
