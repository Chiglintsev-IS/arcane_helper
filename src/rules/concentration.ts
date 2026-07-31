/**
 * Концентрация: КС проверки при получении урона (FR-083).
 *
 * Формула — docs/rules-engine.md#кс-проверки-концентрации.
 */

import type { ActiveEffect, CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";

import { RulesError } from "./abilities";
import { plural, SAVING_THROW_NAMES, withPlural } from "./language";
import { effectiveDamage } from "./scaling";

/** Минимальная КС проверки концентрации. */
export const MINIMUM_CONCENTRATION_DC = 10;

/** Раунд равен шести секундам (rules-engine.md#что-прерывает-концентрацию). */
export const ROUNDS_PER_MINUTE = 10;
export const ROUNDS_PER_HOUR = 600;

const ROUND_FORMS: [string, string, string] = ["раунд", "раунда", "раундов"];

/**
 * Дольше скольких раундов перевод перестаёт помогать.
 *
 * Раунды нужны, чтобы прикинуть «доживёт ли эффект до конца боя». Десять раундов — минута, и это
 * примерно длина боя: всё, что дольше, доживёт в любом случае, а «(4800 раундов)» рядом с «8 часов»
 * — шум, который вытесняет полезное.
 */
const MAXIMUM_USEFUL_ROUNDS = 10;

/** Перевод в раунды, пока он что-то говорит: « (10 раундов)» либо пустая строка. */
function roundsHint(rounds: number): string {
  return rounds > MAXIMUM_USEFUL_ROUNDS ? "" : ` (${withPlural(rounds, ROUND_FORMS)})`;
}

/** Те же раунды после предлога «до»: «до 1 раунда», «до 3 раундов». */
const ROUND_FORMS_GENITIVE: [string, string, string] = ["раунда", "раундов", "раундов"];

/**
 * Запись журнала в том объёме, который нужен для раунда начала.
 *
 * Структурный тип, а не импорт из стора: правила не зависят от состояния приложения, иначе
 * получится цикл — `session.ts` сам импортирует правила.
 */
export type TurnMark = { at: string; kind: string };

export type StartRound = {
  round: number;
  /** Начало вытеснено из обрезанного журнала: число — нижняя граница, а не точное значение. */
  approximate: boolean;
};

/**
 * Раунд, в котором начался эффект: столько ходов началось к его времени (FR-084).
 *
 * Считается так же, как раунд в экономии хода — по записям о начале хода. Журнал обрезается
 * (OQ-08), поэтому у долгого эффекта начало может быть потеряно: тогда число помечается неточным.
 */
export function startRound(marks: readonly TurnMark[], startedAt: string): StartRound {
  const started = marks.filter((mark) => mark.kind === "turn_started" && mark.at <= startedAt).length;
  const earliest = marks[0];
  return {
    round: Math.max(1, started),
    approximate: earliest === undefined || earliest.at > startedAt,
  };
}

/**
 * Длительность в исходных единицах и, пока это помогает, в раундах: «до 1 минуты (10 раундов)»,
 * но «до 10 минут» и «до 8 часов» — без перевода (см. `MAXIMUM_USEFUL_ROUNDS`).
 *
 * Перевод нужен потому, что за столом время считается раундами, а карточка заклинания — минутами.
 * Отсчёта здесь нет и не будет: таймеры вне MVP (F-08).
 *
 * Предлог входит в функцию, а не приписывается снаружи: «до» требует родительного падежа, и
 * склейка «до » с именительным дала бы «до 3 раунда» — за столом это читается как ошибка
 * приложения, а значит и как повод сомневаться в его числах (language.ts). Особая длительность
 * предлога не получает: сроку, которого нет, границы не назовёшь.
 */
export function durationWithRoundsRu(duration: ActiveEffect["duration"]): string {
  const value = duration.value ?? 0;
  switch (duration.type) {
    case "rounds":
      return `до ${withPlural(value, ROUND_FORMS_GENITIVE)}`;
    case "minutes":
      return `до ${withPlural(value, ["минуты", "минут", "минут"])}${roundsHint(value * ROUNDS_PER_MINUTE)}`;
    case "hours":
      return `до ${withPlural(value, ["часа", "часов", "часов"])}${roundsHint(value * ROUNDS_PER_HOUR)}`;
    default:
      return "особая длительность";
  }
}

/**
 * КС проверки концентрации: максимум из 10 и половины полученного урона (округление вниз).
 *
 * Урон 21 даёт КС 10, урон 22 — КС 11.
 */
export function concentrationCheckDc(damage: number): number {
  if (!Number.isInteger(damage) || damage < 0) {
    throw new RulesError(`Полученный урон должен быть целым неотрицательным, получено: ${damage}`);
  }
  return Math.max(MINIMUM_CONCENTRATION_DC, Math.floor(damage / 2));
}

export type ConcentrationCheck = {
  /** Спасбросок Телосложения — единственный вид проверки концентрации. */
  ability: "CON";
  dc: number;
  modifier: number;
  /** «Боевой заклинатель» даёт преимущество на проверку. */
  hasAdvantage: boolean;
  /** Наименьший результат d20, который проходит проверку: КС минус модификатор. */
  minimumRoll: number;
};

/**
 * Готовые данные для карточки проверки: что бросить, против чего и с каким модификатором.
 * Приложение не бросает кубик — бросает игрок (OQ-09).
 */
export function describeConcentrationCheck(
  damage: number,
  constitutionSaveModifier: number,
  options: { hasAdvantage?: boolean } = {},
): ConcentrationCheck {
  if (!Number.isInteger(constitutionSaveModifier)) {
    throw new RulesError(
      `Модификатор спасброска должен быть целым, получено: ${constitutionSaveModifier}`,
    );
  }
  const dc = concentrationCheckDc(damage);
  return {
    ability: "CON",
    dc,
    modifier: constitutionSaveModifier,
    hasAdvantage: options.hasAdvantage === true,
    minimumRoll: dc - constitutionSaveModifier,
  };
}

/**
 * Что делать игроку словами: приложение считает разницу КС и модификатора, чтобы за столом не
 * считали в голове (ux.md#текст-в-интерфейсе). Кубик бросает игрок (OQ-09).
 *
 * Натуральная 20 спасбросок не проходит автоматически, поэтому непроходимая проверка называется
 * непроходимой: единственный выход — «Знаки ограждения» (FR-154).
 */
export function checkGuidanceRu(check: ConcentrationCheck): string {
  if (check.minimumRoll <= 1) return "Проходит любой бросок d20";
  if (check.minimumRoll > 20) return "Не проходит даже 20: концентрация держится только руной";
  const dice = check.hasAdvantage ? "d20 с преимуществом" : "d20";
  return `Бросьте ${dice}, нужно ${check.minimumRoll} и выше`;
}

const AREA_SHAPES: Record<NonNullable<Spell["area"]>["shape"], string> = {
  cone: "Конус",
  cube: "Куб",
  line: "Линия",
  sphere: "Сфера",
  cylinder: "Цилиндр",
};

/** Способ прерывания концентрации. Право мастера помечено: приложение его не применяет само. */
export type ConcentrationBreaker = {
  textRu: string;
  atDiscretion: boolean;
};

export type ConcentrationSummary = {
  /** Для перехода к полной карточке заклинания. */
  spellId: string;
  nameRu: string;
  /** «ячейка 1 ур.» или «без ячейки», если заклинание сотворено без неё. */
  slotLabel: string;
  /** «раунд 3»; «раунд ≥ 3», если начало вытеснено из журнала. */
  startLabel: string;
  /** «до 10 минут (100 раундов)»: концентрация всегда «до», её можно прервать раньше. */
  durationLabel: string;
  /** Механика одной строкой: область или дальность, разрешение, урон. */
  mechanicsLabel: string;
  /** Чем сорвётся от урона — с модификатором этого персонажа. */
  breakLabel: string;
  shortRulesRu: string;
  /** Есть ли карточка заклинания в контенте: без неё некуда вести за полными правилами. */
  rulesAvailable: boolean;
  breakers: ConcentrationBreaker[];
};

function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}

function feet(value: number): string {
  return `${value} ${plural(value, ["фут", "фута", "футов"])}`;
}

/** Куда действует: область важнее дальности, но «от себя» без неё читается неверно. */
function reachLabel(spell: Spell): string {
  if (spell.area !== undefined) {
    const shape = `${AREA_SHAPES[spell.area.shape]} ${feet(spell.area.sizeFeet)}`;
    return spell.range.type === "self" ? `${shape} от себя` : shape;
  }
  switch (spell.range.type) {
    case "self":
      return "На себя";
    case "touch":
      return "Касание";
    case "distance":
      return feet(spell.range.distanceFeet ?? 0);
    default:
      return "Особая дальность";
  }
}

/** Кто бросает и против чего. Числа готовые: игрок называет их вслух (ux.md#текст-в-интерфейсе). */
function resolutionShortRu(spell: Spell, character: CharacterState): string {
  switch (spell.resolution.type) {
    case "spell_attack":
      return `атака заклинанием ${signed(character.spellAttackModifier)}`;
    case "saving_throw":
      return `спасбросок ${SAVING_THROW_NAMES[spell.resolution.savingThrow ?? "CON"]} против КС ${character.spellSaveDc}`;
    default:
      return "без спасброска";
  }
}

/** Механика одной строкой. Урон считается по фактически потраченной ячейке, а не по уровню карточки. */
function mechanicsRu(spell: Spell, effect: ActiveEffect, character: CharacterState): string {
  const damage =
    spell.damage === undefined
      ? null
      : `урон ${effectiveDamage(spell.damage, {
          spellLevel: spell.level,
          slotLevel: effect.slotLevelUsed,
          characterLevel: character.level,
        })} (${spell.damage.type})`;

  return [reachLabel(spell), resolutionShortRu(spell, character), damage]
    .filter((part) => part !== null)
    .join(" · ");
}

/**
 * Готовое описание активной концентрации (FR-084).
 *
 * Собирается из карточки заклинания при отрисовке, а не хранится в состоянии: сохранённый текст
 * разошёлся бы с обновлённым контентом. Способы прерывания — правила игры
 * (rules-engine.md#что-прерывает-концентрацию), поэтому список закрытый.
 *
 * Карточки заклинания может не быть: состояние приходило импортом из другой сборки контента. Скрыть
 * блок в этом случае нельзя — концентрация не может исчезнуть с экрана незаметно, — поэтому
 * описание деградирует до того, что лежит в самом эффекте.
 */
export function describeConcentration(input: {
  spell: Spell | null;
  effect: ActiveEffect;
  character: CharacterState;
  journal: readonly TurnMark[];
}): ConcentrationSummary {
  const { spell, effect, character, journal } = input;
  const start = startRound(journal, effect.startedAt);
  const modifier = signed(character.constitutionSaveModifier);

  return {
    spellId: effect.spellId,
    nameRu: effect.nameRu,
    slotLabel: effect.slotLevelUsed === 0 ? "без ячейки" : `ячейка ${effect.slotLevelUsed} ур.`,
    startLabel: start.approximate ? `раунд ≥ ${start.round}` : `раунд ${start.round}`,
    durationLabel: durationWithRoundsRu(effect.duration),
    mechanicsLabel:
      spell === null
        ? "Правил нет в контенте: состояние из другой сборки"
        : mechanicsRu(spell, effect, character),
    breakLabel: `Урон → спасбросок Телосложения ${modifier}, КС от ${MINIMUM_CONCENTRATION_DC}`,
    shortRulesRu: spell === null ? effect.endConditionRu : spell.shortRulesRu,
    rulesAvailable: spell !== null,
    breakers: [
      {
        textRu: `Урон — спасбросок Телосложения ${modifier}, КС = максимум(${MINIMUM_CONCENTRATION_DC}, половина урона вниз). Провал завершает и концентрацию, и эффект`,
        atDiscretion: false,
      },
      { textRu: "Ещё одно концентрационное заклинание — это заменит", atDiscretion: false },
      { textRu: "Недееспособность или смерть", atDiscretion: false },
      { textRu: "Своё решение — в любой момент, бесплатно", atDiscretion: false },
      { textRu: "Истечение длительности — приложение не отсчитывает", atDiscretion: false },
      {
        textRu: `Сильно отвлекающая обстановка — спасбросок Телосложения ${modifier} против КС ${MINIMUM_CONCENTRATION_DC}`,
        atDiscretion: true,
      },
    ],
  };
}
