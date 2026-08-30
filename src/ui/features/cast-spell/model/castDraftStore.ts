import type { CommandOf } from "@/contract/commands";
import type { CastOptionView, SpellRowView } from "@/contract/views";
import { createStore, type StoreApi } from "zustand/vanilla";

export const WIZARD_STEPS = [
  "availability",
  "slot",
  "hitDice",
  "components",
  "concentration",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export const CONCENTRATION_BUSY = "concentration_busy";

export const NO_COMPONENT = "no_component";

const OWN_STEP_WARNINGS: readonly string[] = [CONCENTRATION_BUSY, NO_COMPONENT];

export type CastDraft = {
  spellId: string;
  option: CastOptionView;
  allowAnyway: boolean;
  replaceConcentration: boolean;
  rune: string | null;
  runeTarget: string;
  hitDiceCount: number | null;
  hitDiceRolled: number | null;
  step: WizardStep;
};

const DEFAULT_RUNE_TARGET = "self";

type Remembered = {
  payment: Record<string, CastOptionView["payment"]>;
};

function samePayment(one: CastOptionView["payment"], other: CastOptionView["payment"]): boolean {
  if (one.kind !== other.kind) return false;
  return one.kind !== "slot" || other.kind !== "slot" || one.slotLevel === other.slotLevel;
}

function defaultOption(row: SpellRowView, remembered: Remembered): CastOptionView {
  const [head, ...tail] = row.castOptions;
  const rememberedPayment = remembered.payment[row.id];
  const match =
    rememberedPayment === undefined
      ? undefined
      : row.castOptions.find((option) => samePayment(option.payment, rememberedPayment));

  return match ?? tail.find((option) => option.suggested) ?? head;
}

export function visibleSteps(draft: CastDraft, row: SpellRowView): WizardStep[] {
  const { warnings } = draft.option;
  const blocking = warnings.filter((warning) => !OWN_STEP_WARNINGS.includes(warning.code));
  const replacesConcentration = warnings.some((warning) => warning.code === CONCENTRATION_BUSY);

  return WIZARD_STEPS.filter((step) => {
    switch (step) {
      case "availability":
        return blocking.length > 0;
      case "slot":
        return !row.cantrip;
      case "hitDice":
        return row.spendsHitDice;
      case "components":
        return row.ownComponentRequired;
      case "concentration":
        return replacesConcentration;
    }
  });
}

export function toCastCommand(draft: CastDraft): CommandOf<"cast_spell"> {
  return {
    kind: "cast_spell",
    spellId: draft.spellId,
    mode: draft.option.mode,
    payment: draft.option.payment,
    ...(draft.rune === null ? {} : { rune: draft.rune, runeTarget: draft.runeTarget }),
    ...(draft.hitDiceCount === null || draft.hitDiceRolled === null
      ? {}
      : { hitDice: { count: draft.hitDiceCount, rolled: draft.hitDiceRolled } }),
    allowAnyway: draft.allowAnyway,
    replaceConcentration: draft.replaceConcentration,
  };
}

export type CastDraftState = {
  draft: CastDraft | null;

  start: (row: SpellRowView) => CastDraft | null;
  chooseCastOption: (option: CastOptionView) => void;
  chooseRune: (rune: string, choosesTarget: boolean) => void;
  chooseRuneTarget: (target: string) => void;
  setHitDiceCount: (count: number) => void;
  setHitDiceRolled: (rolled: number | null) => void;
  allowAnyway: () => void;
  replaceConcentration: () => void;
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
    const remembered: Remembered = { payment: {} };

    const edit = (change: (draft: CastDraft) => CastDraft): void => {
      const { draft } = get();
      if (draft === null) return;
      set({ draft: change(draft) });
    };

    return {
      draft: null,

      start(row) {
        const draft: CastDraft = {
          spellId: row.id,
          option: defaultOption(row, remembered),
          allowAnyway: false,
          replaceConcentration: false,
          rune: null,
          runeTarget: DEFAULT_RUNE_TARGET,
          hitDiceCount: null,
          hitDiceRolled: null,
          step: WIZARD_STEPS[0],
        };
        const [first] = visibleSteps(draft, row);
        if (first === undefined) return draft;
        set({ draft: { ...draft, step: first } });
        return null;
      },

      chooseRune(rune, choosesTarget) {
        edit((draft) => ({
          ...draft,
          rune: draft.rune === rune ? null : rune,
          runeTarget: choosesTarget ? draft.runeTarget : DEFAULT_RUNE_TARGET,
        }));
      },

      chooseRuneTarget(target) {
        edit((draft) => ({ ...draft, runeTarget: target }));
      },

      setHitDiceCount(count) {
        edit((draft) => ({ ...draft, hitDiceCount: count, hitDiceRolled: null }));
      },

      setHitDiceRolled(rolled) {
        edit((draft) => ({ ...draft, hitDiceRolled: rolled }));
      },

      chooseCastOption(option) {
        edit((draft) => {
          remembered.payment[draft.spellId] = option.payment;
          const reset = { hitDiceCount: null, hitDiceRolled: null };
          if (option.payment.kind !== "slot")
            return { ...draft, option, rune: null, runeTarget: DEFAULT_RUNE_TARGET, ...reset };
          return { ...draft, option, ...reset };
        });
      },

      allowAnyway() {
        edit((draft) => ({ ...draft, allowAnyway: true }));
      },

      replaceConcentration() {
        edit((draft) => ({ ...draft, replaceConcentration: true }));
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
