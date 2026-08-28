/**
 * Черновик применения заклинания.
 *
 * Отдельный стор — это техническая гарантия инварианта: состояние персонажа живёт в `sessionStore`,
 * и ни одно действие этого стора его не касается. Выход из мастера на любом шаге, включая закрытие
 * приложения, оставляет ресурсы нетронутыми, потому что менять их отсюда попросту нечем
 *
 * По правилам черновик не считает ничего: способы сотворения вместе с их ценой, уроном и вердиктом
 * приезжают строкой заклинания, эффект руны и границы броска костей — ответом на вопрос. Здесь
 * остаётся выбор игрока и то, что он уже набрал.
 *
 * Подтверждение выполняет вызывающий: он берёт `toCastCommand` и отправляет намерение через
 * единственную дверь ядра — `sessionStore.execute`.
 */

import type { CommandOf } from "@/contract/commands";
import type { CastOptionView, SpellRowView } from "@/contract/views";
import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * Экраны мастера в порядке. Каждый показывается по условию: шаг, где нечего выбирать и не о чём
 * предупредить, не показывается, а последний из показанных и подтверждает. Заклинание, которому не
 * нужен ни один, творится прямо с карточки.
 */
export const WIZARD_STEPS = [
  "availability",
  "slot",
  "hitDice",
  "components",
  "concentration",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Занятая концентрация: шаг замены — выбор между двумя эффектами, а не сообщение. */
export const CONCENTRATION_BUSY = "concentration_busy";

/** Нехватка компонента: о ней говорит свой шаг, где рядом стоит и перечень требуемого. */
export const NO_COMPONENT = "no_component";

/**
 * Помехи, у которых в мастере свой шаг, и потому не повторяемые на шаге доступности: иначе игрок
 * читает одно и то же дважды и жмёт «Далее» не глядя.
 */
const OWN_STEP_WARNINGS: readonly string[] = [CONCENTRATION_BUSY, NO_COMPONENT];

export type CastDraft = {
  /** Что творят: заклинание названо идентификатором, а строка его берётся из снимка. */
  spellId: string;
  /** Выбранный способ сотворения — целиком, вместе с его ценой и вердиктом. */
  option: CastOptionView;
  /** Мастер разрешил исключение. Замену концентрации это согласие не покрывает. */
  allowAnyway: boolean;
  /** Игрок согласился прервать идущую концентрацию: выбор между двумя эффектами — только его. */
  replaceConcentration: boolean;
  /** Приложенная руна словом правил или `null`. Не более одной на заклинание. */
  rune: string | null;
  /** Кому её эффект. Спрашивается только у той руны, которая выбирает цель. */
  runeTarget: string;
  /**
   * Сколько Костей хитов бросить и что на них выпало. Оба `null`, пока игрок не выбрал.
   *
   * Умолчания нет намеренно: максимум зависит от уровня ячейки, и подставленное число молча
   * устарело бы при её смене. Смена оплаты обнуляет оба поля по той же причине.
   */
  hitDiceCount: number | null;
  hitDiceRolled: number | null;
  step: WizardStep;
};

/**
 * Цель руны, пока игрок не выбирал: заклинатель. Правилам это не противоречит и их не повторяет —
 * невыбранная цель для них и означает «себе», а мастеру нужна отмеченная кнопка, а не пустой ряд.
 */
const DEFAULT_RUNE_TARGET = "self";

/** Ключ запоминания — идентификатор заклинания: выбор помнится по заклинанию, а не глобально. */
type Remembered = {
  payment: Record<string, CastOptionView["payment"]>;
};

/** Один ли это способ оплаты: ячейки различаются уровнем, прочие роды — только собой. */
function samePayment(one: CastOptionView["payment"], other: CastOptionView["payment"]): boolean {
  if (one.kind !== other.kind) return false;
  return one.kind !== "slot" || other.kind !== "slot" || one.slotLevel === other.slotLevel;
}

/**
 * Способ для нового черновика: запомненный выбор игрока важнее предложенного.
 *
 * Предложенный помечен в самой строке — тем же перебором, который назвал её причину недоступности.
 * Одно решение на оба места: иначе список объясняет одно, а мастер предлагает другое.
 */
function defaultOption(row: SpellRowView, remembered: Remembered): CastOptionView {
  const [head, ...tail] = row.castOptions;
  const rememberedPayment = remembered.payment[row.id];
  const match =
    rememberedPayment === undefined
      ? undefined
      : row.castOptions.find((option) => samePayment(option.payment, rememberedPayment));

  // Ищется по остальным, а первый способ и есть ответ по умолчанию: пометка стоит ровно одна.
  return match ?? tail.find((option) => option.suggested) ?? head;
}

/**
 * Видимые шаги. Шаг показывается, только если на нём есть что выбрать или о чём предупредить.
 * Пустой список — мастер не нужен: подтверждают прямо с карточки.
 *
 * Шага выбора цели среди них нет: ввод текста в бою — самая медленная операция, и решением игрока
 * мастер цель не спрашивает.
 */
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

/**
 * Намерение сотворить. Собирается из черновика и уходит в ядро при подтверждении.
 *
 * Заклинание называется идентификатором: карточку ядро возьмёт свою. Присланная карточка была бы
 * экраном, диктующим правила. Выпавшее на костях едет числом — его знает игрок, а не приложение.
 */
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

  /**
   * Начать применение. Есть что спросить — мастер открыт, и возвращается `null`; спрашивать нечего —
   * мастер не открывается, а возвращается черновик, который вызывающий подтверждает сразу.
   */
  start: (row: SpellRowView) => CastDraft | null;
  chooseCastOption: (option: CastOptionView) => void;
  /**
   * Приложить руну или снять её. Не более одной на заклинание.
   *
   * Выбирает ли руна цель — правило, и приходит оно предпросмотром рядом с её эффектом: набранная
   * цель руны, которая цель не выбирает, уехала бы в подтверждение и молча ничего не значила.
   */
  chooseRune: (rune: string, choosesTarget: boolean) => void;
  chooseRuneTarget: (target: string) => void;
  /** Сколько костей бросить. Смена числа обнуляет выпавшее: оно относилось к прежнему. */
  setHitDiceCount: (count: number) => void;
  /** Что выпало на брошенных костях. */
  setHitDiceRolled: (rolled: number | null) => void;
  /** «Применить всё равно»: предупреждения, которые снимает исключение мастера, перестают мешать. */
  allowAnyway: () => void;
  /** «Прервать и сотворить»: согласие на замену идущей концентрации. */
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

    /** Правка черновика в одном месте: без черновика правки просто нет. */
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
        // Повторное нажатие снимает руну: выбор из трёх без возможности передумать — ловушка.
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
          // Ритуал и заговор руну не принимают: выбранная до смены оплаты, она молча пропала бы
          // при подтверждении.
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
