/**
 * Операции над состоянием персонажа: чистые функции без React и без хранилища.
 *
 * Каждая операция возвращает новое состояние и запись журнала со снимком изменённых полей
 * (ADR-0006). Снимок вычисляется сравнением «до» и «после», поэтому новая операция не требует
 * писать обратную к себе, а отмена остаётся одной функцией.
 *
 * Инварианты, которые держит этот модуль:
 *   FR-022 — черновик применения живёт отдельно, здесь только подтверждённые изменения;
 *   FR-023 — подтверждение применяет все следствия одной записью журнала;
 *   FR-080 — одновременно не более одной концентрации;
 *   FR-111 — любое изменение обратимо;
 *   FR-174 — потеря хитов от кровавого колдовства не порождает проверку концентрации.
 */

import type { ActiveEffect, CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import {
  ACTION_SPENT_MESSAGES,
  turnResourceFor,
  type PaymentChoice,
  type TurnResource,
} from "@/rules/availability";
import {
  exchangeHitPoints,
  maximumRecoveryPerHour,
  regenerationPerTurn,
  traitsSuppressed,
} from "@/rules/bloodMagic";
import {
  applyArcaneRecovery,
  CANTRIP_LEVEL,
  consumesSlot,
  refundSlot,
  restoreAllSlots,
  spendSlot,
  type CastMode,
  type SlotRecoveryPlan,
} from "@/rules/slots";
import { hitPointCost, spellPointCost } from "@/rules/bloodMagic";
import { durationWithRoundsRu } from "@/rules/concentration";
import type { ScreenMode } from "@/rules/modes";

/** Глубина журнала — предложенное значение OQ-08, уточняется после игровой сессии. */
export const JOURNAL_LIMIT = 100;

export type JournalKind =
  | "spell_cast"
  | "reaction_cast"
  | "slot_spent"
  | "slot_refunded"
  | "concentration_started"
  | "concentration_ended"
  | "effect_ended"
  | "long_rest"
  | "short_rest"
  | "arcane_recovery"
  | "turn_started"
  | "manual_adjustment"
  | "blood_exchange"
  | "rune_spent"
  | "hit_points_changed"
  | "suppression_changed";

/**
 * Что потрачено внутри хода. Без этого доступность из журнала не вывести (ADR-0008).
 * Словарь ресурсов хода один и живёт в движке правил: журнал и проверка доступности обязаны
 * понимать «действие» одинаково.
 */
export type ActionUsed = TurnResource;

export type JournalEntry = {
  id: string;
  at: string;
  kind: JournalKind;
  summaryRu: string;
  /** Снимок затронутых полей ДО изменения — основа отмены. */
  undoPatch: Partial<CharacterState>;
  spellId?: string;
  slotLevel?: number;
  actionUsed?: ActionUsed;
};

export type Session = {
  character: CharacterState;
  journal: JournalEntry[];
};

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

/** Время и идентификаторы приходят снаружи: чистые функции их не изобретают. */
export type Clock = {
  now: () => string;
  nextId: () => string;
};

export function createSession(character: CharacterState): Session {
  return { character, journal: [] };
}

const STATE_KEYS = [
  "spellSlots",
  "reactionAvailable",
  "concentration",
  "activeEffects",
  "turnTracking",
  "arcaneRecoveryAvailable",
  "hitPoints",
  "runes",
  "spellPoints",
  "suppression",
  "preparedSpellIds",
] as const satisfies readonly (keyof CharacterState)[];

/**
 * Снимок полей, значения которых изменились. Сравнение по сериализации: состояние
 * заведомо сериализуемо, а глубокое сравнение вручную дало бы больше кода и больше ошибок.
 */
function changedFields(before: CharacterState, after: CharacterState): Partial<CharacterState> {
  const patch: Partial<CharacterState> = {};
  for (const key of STATE_KEYS) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      Object.assign(patch, { [key]: structuredClone(before[key]) });
    }
  }
  return patch;
}

type Recorded = {
  kind: JournalKind;
  summaryRu: string;
  spellId?: string;
  slotLevel?: number;
  actionUsed?: ActionUsed;
};

/**
 * Оформляет переход состояния в запись журнала. Одно действие — одна запись (FR-110).
 *
 * Пустой `undoPatch` допустим и не считается ошибкой: заговор при выключенном учёте хода не
 * тратит ни ячейку, ни действие, но остаётся применением заклинания, которое FR-110 требует
 * записать. Отмена такой записи просто убирает строку журнала.
 */
function commit(
  session: Session,
  after: CharacterState,
  recorded: Recorded,
  clock: Clock,
): Session {
  const undoPatch = changedFields(session.character, after);

  const entry: JournalEntry = {
    id: clock.nextId(),
    at: clock.now(),
    kind: recorded.kind,
    summaryRu: recorded.summaryRu,
    undoPatch,
    ...(recorded.spellId === undefined ? {} : { spellId: recorded.spellId }),
    ...(recorded.slotLevel === undefined ? {} : { slotLevel: recorded.slotLevel }),
    ...(recorded.actionUsed === undefined ? {} : { actionUsed: recorded.actionUsed }),
  };

  const journal = [...session.journal, entry];
  return {
    character: after,
    journal: journal.length > JOURNAL_LIMIT ? journal.slice(-JOURNAL_LIMIT) : journal,
  };
}

/** Отмена последнего действия: применить снимок и снять запись (FR-111). */
export function undoLast(session: Session): Session {
  const last = session.journal.at(-1);
  if (last === undefined) {
    throw new SessionError("Журнал пуст, отменять нечего");
  }
  return {
    character: { ...session.character, ...structuredClone(last.undoPatch) },
    journal: session.journal.slice(0, -1),
  };
}

// —————————————————————————— Экономия хода ——————————————————————————

export type TurnEconomy = {
  /** Номер раунда — число отметок «начало хода» плюс текущий. */
  round: number;
  /** Начинался ли свой ход хоть раз: до этого учёт вести не от чего. */
  started: boolean;
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
  /** Когда реакция вернётся. Ответ на вопрос «когда», а не «нет» (FR-144). */
  reactionReturns: "в начале вашего хода" | null;
};

/**
 * Ведётся ли учёт хода. Ровно в режиме «Бой»: вне боя ходов нет, и считать нечего (FR-143).
 *
 * Раньше это был переключатель в шапке, и он умел врать — с выключенным учётом значки стояли
 * зелёными всегда. Теперь состояние выводится из режима и разойтись с ним не может.
 */
export function turnTracked(character: CharacterState): boolean {
  return character.screenMode === "combat";
}

const ALL_AVAILABLE = {
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
  reactionReturns: null,
} as const;

/**
 * Выводит экономию хода из журнала: доступно то, что не потрачено после последней отметки
 * «начало хода» (ADR-0008). Флага в состоянии для этого нет намеренно — он мог бы разойтись с журналом.
 *
 * Если отметки нет вовсе — журнал новый или обрезан — считаем всё доступным: приложение не должно
 * запрещать лишнего из-за нехватки истории.
 */
export function deriveTurnEconomy(session: Session): TurnEconomy {
  const lastTurnIndex = session.journal.findLastIndex((entry) => entry.kind === "turn_started");
  const round = Math.max(1, session.journal.filter((entry) => entry.kind === "turn_started").length);

  if (!turnTracked(session.character)) {
    return { round, started: lastTurnIndex !== -1, ...ALL_AVAILABLE };
  }

  // Отметки хода ещё нет — считаем с начала журнала. Иначе при включённом учёте контроль
  // молча не работал бы до первого нажатия «Мой ход начался», а это худший из возможных
  // исходов: игрок думает, что приложение следит, а оно не следит.
  const spent = new Set<ActionUsed>();
  for (const entry of session.journal.slice(lastTurnIndex + 1)) {
    if (entry.actionUsed !== undefined) spent.add(entry.actionUsed);
  }

  const reactionAvailable = !spent.has("reaction");
  return {
    round,
    started: lastTurnIndex !== -1,
    actionAvailable: !spent.has("action"),
    bonusActionAvailable: !spent.has("bonus_action"),
    reactionAvailable,
    reactionReturns: reactionAvailable ? null : "в начале вашего хода",
  };
}

// —————————————————————————————— Ход ——————————————————————————————

/**
 * Начало своего хода: восстанавливает действие, бонусное действие и реакцию (FR-140),
 * снимает подавление огнём (FR-180) и начисляет регенерацию, если она действует (FR-182).
 *
 * Регенерация начисляется, а не предлагается: по правилам она происходит сама, и требовать
 * подтверждения — значит добавлять нажатие там, где выбора нет.
 */
export function beginTurn(session: Session, clock: Clock): Session {
  const { character } = session;
  const healed = regenerationDue(character);
  const { kept, expired } = expireRoundEffects(session);

  const withoutConcentration = expired.some((effect) => effect.isConcentration)
    ? (({ concentration: _dropped, ...rest }) => rest)(character)
    : character;

  const after: CharacterState = {
    ...withoutConcentration,
    reactionAvailable: true,
    turnTracking: {
      ...character.turnTracking,
      actionAvailable: true,
      bonusActionAvailable: true,
    },
    // Подавление огнём держится до конца следующего хода, то есть снимается с его началом.
    suppression: { ...character.suppression, firedUpon: false },
    hitPoints: {
      ...character.hitPoints,
      current: Math.min(character.hitPoints.maximum, character.hitPoints.current + healed),
    },
    activeEffects: kept,
  };

  const notes = [
    ...(healed > 0 ? [`регенерация +${healed}`] : []),
    ...expired.map((effect) => `«${effect.nameRu}» истёк`),
  ];
  const summaryRu = notes.length === 0 ? "Начало хода" : `Начало хода · ${notes.join(", ")}`;
  return commit(session, after, { kind: "turn_started", summaryRu }, clock);
}

/**
 * Эффекты, чьи раунды кончились к началу нового хода (FR-094).
 *
 * Раунды считаются по журналу, как и вся экономия хода (ADR-0008): эффект живёт столько отметок
 * «начало хода», сколько в нём раундов. Отметка, ради которой вызвана эта функция, ещё не записана,
 * поэтому она добавляется единицей — иначе «Щит» на один раунд пережил бы свой раунд.
 *
 * Минуты, часы и особая длительность не трогаются: приложение не знает, сколько прошло времени, и
 * отсчёт был бы выдуманным.
 */
function expireRoundEffects(session: Session): {
  kept: ActiveEffect[];
  expired: ActiveEffect[];
} {
  const kept: ActiveEffect[] = [];
  const expired: ActiveEffect[] = [];

  for (const effect of session.character.activeEffects) {
    const rounds = effect.duration.type === "rounds" ? effect.duration.value : undefined;
    if (rounds === undefined) {
      kept.push(effect);
      continue;
    }
    const elapsed =
      session.journal.filter(
        (entry) => entry.kind === "turn_started" && entry.at > effect.startedAt,
      ).length + 1;
    (elapsed >= rounds ? expired : kept).push(effect);
  }

  return { kept, expired };
}

/** Действует ли регенерация прямо сейчас и на сколько (FR-182). */
export function regenerationDue(character: CharacterState): number {
  if (traitsSuppressed(character.suppression)) return 0;
  if (character.hitPoints.current <= 0) return 0;
  if (character.hitPoints.current >= character.hitPoints.maximum / 2) return 0;
  return regenerationPerTurn(character.level);
}

// ———————————————————————— Применение заклинания ————————————————————————

/** Способ оплаты сотворения определён движком правил — здесь только его применение к состоянию. */
export type Payment = PaymentChoice;

export type CastRequest = {
  spell: Spell;
  mode: CastMode;
  payment: Payment;
  targetLabel?: string;
  /** Руна применяется только к заклинанию, оплаченному ячейкой (FR-151, OQ-17). */
  rune?: "life" | "war" | "wind";
  /** Мастер разрешил исключение — предупреждения не блокируют (FR-031). */
  allowAnyway?: boolean;
};

/** Что заклинание тратит внутри хода. Минуты и часы вне боевой экономии действий. */
export function actionUsedBy(spell: Spell): ActionUsed | undefined {
  return turnResourceFor(spell.castingTime.type);
}

/**
 * Списывает потраченное внутри хода. Доступность проверяется по журналу (ADR-0008), а флаги
 * состояния обновляются как кэш для интерфейса — тест держит их согласованными с выводом.
 */
function spendActionFor(session: Session, spell: Spell, allowAnyway: boolean): CharacterState {
  const { character } = session;
  const used = actionUsedBy(spell);
  if (used === undefined || !turnTracked(character)) return character;

  const economy = deriveTurnEconomy(session);
  const available =
    used === "reaction"
      ? economy.reactionAvailable
      : used === "bonus_action"
        ? economy.bonusActionAvailable
        : economy.actionAvailable;

  if (!available && !allowAnyway) {
    throw new SessionError(ACTION_SPENT_MESSAGES[used]);
  }

  if (used === "reaction") return { ...character, reactionAvailable: false };
  if (used === "bonus_action") {
    return { ...character, turnTracking: { ...character.turnTracking, bonusActionAvailable: false } };
  }
  return { ...character, turnTracking: { ...character.turnTracking, actionAvailable: false } };
}

function applyPayment(character: CharacterState, request: CastRequest): CharacterState {
  const { spell, mode, payment, allowAnyway = false } = request;

  if (!consumesSlot(spell.level, mode)) {
    if (payment.kind !== "none") {
      throw new SessionError(
        spell.level === CANTRIP_LEVEL
          ? "Заговор не расходует ячейку"
          : "Ритуальное применение не расходует ячейку",
      );
    }
    return character;
  }

  if (payment.kind === "slot") {
    if (payment.slotLevel < spell.level) {
      throw new SessionError(
        `Ячейка ${payment.slotLevel} уровня ниже уровня заклинания ${spell.level}`,
      );
    }
    return {
      ...character,
      spellSlots: spendSlot(character.spellSlots, payment.slotLevel, {
        allowOverdraft: allowAnyway,
      }),
    };
  }

  if (payment.kind === "spell_points") {
    const cost = spellPointCost(spell.level);
    if (character.spellPoints.remaining < cost && !allowAnyway) {
      throw new SessionError(
        `Очков заклинаний ${character.spellPoints.remaining}, нужно ${cost}`,
      );
    }
    return {
      ...character,
      spellPoints: { ...character.spellPoints, remaining: character.spellPoints.remaining - cost },
    };
  }

  throw new SessionError("Заклинание с ячейкой требует способа оплаты");
}

function applyRune(character: CharacterState, request: CastRequest): CharacterState {
  if (request.rune === undefined) return character;
  if (request.payment.kind !== "slot") {
    throw new SessionError("Руна применяется только к заклинанию, оплаченному ячейкой");
  }
  if (character.runes.remaining <= 0) {
    throw new SessionError("Рун не осталось");
  }
  return { ...character, runes: { ...character.runes, remaining: character.runes.remaining - 1 } };
}

function slotLevelUsed(request: CastRequest): number {
  if (request.payment.kind === "slot") return request.payment.slotLevel;
  return request.spell.level;
}

/**
 * Чем и когда закончится эффект (FR-090).
 *
 * Длительность называется числом, а не словом «истечение». «До истечения длительности» — это ответ
 * «закончится, когда закончится»: он не отвечает на единственный вопрос, который задают за столом, —
 * сколько ещё держится. Раунды приписаны потому, что в бою считают ими, а карточка написана
 * минутами.
 */
function endConditionRu(duration: ActiveEffect["duration"], concentration: boolean): string {
  if (duration.type === "special") {
    return concentration ? "До конца концентрации; длительность особая." : "Длительность особая.";
  }
  const held = durationWithRoundsRu(duration);
  return concentration ? `Держится ${held} или до конца концентрации.` : `Держится ${held}.`;
}

/** Создаёт активный эффект, если заклинание продолжается (FR-090). Мгновенное — не создаёт. */
function buildEffect(request: CastRequest, clock: Clock): ActiveEffect | null {
  const { spell } = request;
  if (spell.duration.type === "instant") return null;

  const type: ActiveEffect["type"] = spell.concentration
    ? "control"
    : spell.targeting.type === "self"
      ? "buff"
      : "utility";

  // Длительность эффекта собирается до записи: из неё же строится и текст окончания, чтобы число
  // в подписи и число в состоянии не могли разойтись.
  const duration: ActiveEffect["duration"] =
    spell.duration.type === "special"
      ? { type: "special" }
      : {
          type: spell.duration.type,
          ...(spell.duration.value === undefined ? {} : { value: spell.duration.value }),
        };

  return {
    id: clock.nextId(),
    spellId: spell.id,
    nameRu: spell.nameRu,
    type,
    startedAt: clock.now(),
    duration,
    isConcentration: spell.concentration,
    slotLevelUsed: slotLevelUsed(request),
    // Вклад в КД копируется из заклинания, чтобы итог считался из одного состояния (ADR-0013).
    ...(spell.armorClassEffect === undefined ? {} : { armorClass: spell.armorClassEffect }),
    endConditionRu: endConditionRu(duration, spell.concentration),
  };
}

/**
 * Подтверждённое применение заклинания: оплата, действие, руна, концентрация, эффект —
 * одной записью журнала (FR-023).
 */
export function castSpell(session: Session, request: CastRequest, clock: Clock): Session {
  const { spell, allowAnyway = false } = request;

  if (spell.concentration && session.character.concentration !== undefined && !allowAnyway) {
    throw new SessionError(
      "Уже идёт концентрация: замена требует отдельного подтверждения (FR-081)",
    );
  }

  let after = spendActionFor(session, spell, allowAnyway);
  after = applyPayment(after, request);
  after = applyRune(after, request);

  const effect = buildEffect(request, clock);
  // Заменяя концентрацию, закрываем прежний концентрационный эффект (UC-03).
  const keptEffects = spell.concentration
    ? after.activeEffects.filter((existing) => !existing.isConcentration)
    : after.activeEffects;

  after = {
    ...after,
    activeEffects: effect === null ? keptEffects : [...keptEffects, effect],
    ...(spell.concentration
      ? { concentration: { spellId: spell.id, startedAt: clock.now() } }
      : {}),
  };

  const level = slotLevelUsed(request);
  const used = actionUsedBy(spell);
  const how =
    request.mode === "ritual"
      ? "ритуалом"
      : request.payment.kind === "spell_points"
        ? `кровью, ${spellPointCost(spell.level)} очков`
        : spell.level === CANTRIP_LEVEL
          ? "заговором"
          : `ячейкой ${level} уровня`;

  return commit(
    session,
    after,
    {
      kind: spell.castingTime.type === "reaction" ? "reaction_cast" : "spell_cast",
      summaryRu: `${spell.nameRu} — ${how}`,
      spellId: spell.id,
      slotLevel: level,
      // Записываем всегда, даже при выключенном учёте: журнал фиксирует факт,
      // а настройка влияет только на то, запрещать ли повторную трату.
      ...(used === undefined ? {} : { actionUsed: used }),
    },
    clock,
  );
}

// —————————————————————————— Концентрация ——————————————————————————

export type ConcentrationEnd = "manual" | "failed_check" | "replaced" | "long_rest";

const CONCENTRATION_REASONS: Record<ConcentrationEnd, string> = {
  manual: "снята вручную",
  failed_check: "провалена проверка концентрации",
  replaced: "заменена концентрация",
  long_rest: "долгий отдых",
};

/** Завершает концентрацию и связанный эффект одной операцией (FR-083). */
export function endConcentration(
  session: Session,
  reason: ConcentrationEnd,
  clock: Clock,
): Session {
  const { character } = session;
  if (character.concentration === undefined) {
    throw new SessionError("Активной концентрации нет");
  }
  const { concentration: _dropped, ...withoutConcentration } = character;
  const after: CharacterState = {
    ...withoutConcentration,
    activeEffects: character.activeEffects.filter((effect) => !effect.isConcentration),
  };
  return commit(
    session,
    after,
    {
      kind: "concentration_ended",
      summaryRu: `Концентрация завершена: ${CONCENTRATION_REASONS[reason]}`,
      spellId: character.concentration.spellId,
    },
    clock,
  );
}

/**
 * Можно ли спасти провал проверки концентрации руной (FR-154).
 * Проверка концентрации — спасбросок Телосложения, значит «Знаки ограждения» применимы.
 */
export function wardingSigilAvailable(character: CharacterState): boolean {
  return character.runes.remaining > 0 && character.reactionAvailable;
}

/** «Знаки ограждения»: реакция и руна превращают провал спасброска в успех (FR-153). */
export function spendRuneOnWardingSigil(session: Session, clock: Clock): Session {
  const { character } = session;
  if (!wardingSigilAvailable(character)) {
    throw new SessionError(
      character.runes.remaining <= 0 ? "Рун не осталось" : "Реакция уже израсходована",
    );
  }
  const after: CharacterState = {
    ...character,
    runes: { ...character.runes, remaining: character.runes.remaining - 1 },
    reactionAvailable: false,
  };
  return commit(
    session,
    after,
    {
      kind: "rune_spent",
      summaryRu: "Знаки ограждения: провал спасброска считается успехом",
      actionUsed: "reaction",
    },
    clock,
  );
}

/** Ручное завершение активного эффекта (FR-091). */
export function endEffect(session: Session, effectId: string, clock: Clock): Session {
  const { character } = session;
  const effect = character.activeEffects.find((candidate) => candidate.id === effectId);
  if (effect === undefined) {
    throw new SessionError(`Активного эффекта «${effectId}» нет`);
  }
  const rest = character.activeEffects.filter((candidate) => candidate.id !== effectId);
  const after: CharacterState = effect.isConcentration
    ? (() => {
        const { concentration: _dropped, ...withoutConcentration } = character;
        return { ...withoutConcentration, activeEffects: rest };
      })()
    : { ...character, activeEffects: rest };

  return commit(
    session,
    after,
    { kind: "effect_ended", summaryRu: `Эффект завершён: ${effect.nameRu}`, spellId: effect.spellId },
    clock,
  );
}

// ———————————————————————— Кровавое колдовство ————————————————————————

/**
 * Обмен хитов на очки заклинаний (FR-170). Действие в свой ход; потеря хитов не считается
 * уроном и проверку концентрации не порождает (FR-174) — этот модуль её и не запускает.
 */
export function exchangeBlood(
  session: Session,
  hitPoints: number,
  clock: Clock,
  options: { allowAnyway?: boolean } = {},
): Session {
  const { character } = session;
  if (traitsSuppressed(character.suppression) && options.allowAnyway !== true) {
    throw new SessionError(
      character.suppression.firedUpon
        ? "Кровавое колдовство подавлено уроном огнём"
        : "Кровавое колдовство не действует под прямым солнечным светом",
    );
  }

  const exchange = exchangeHitPoints(hitPoints, character.level);
  if (exchange.pointsCreated === 0) {
    throw new SessionError(`${hitPoints} хитов не хватает даже на одно очко заклинаний`);
  }
  if (exchange.hitPointsSpent > character.hitPoints.current && options.allowAnyway !== true) {
    throw new SessionError(
      `Нужно ${exchange.hitPointsSpent} хитов, в наличии ${character.hitPoints.current}`,
    );
  }

  const after: CharacterState = {
    ...character,
    hitPoints: {
      current: character.hitPoints.current - exchange.hitPointsSpent,
      maximum: character.hitPoints.maximum - exchange.hitPointsSpent,
      maximumReduction: character.hitPoints.maximumReduction + exchange.hitPointsSpent,
    },
    spellPoints: {
      remaining: character.spellPoints.remaining + exchange.pointsCreated,
      createdAt: clock.now(),
    },
    ...(turnTracked(character)
      ? { turnTracking: { ...character.turnTracking, actionAvailable: false } }
      : {}),
  };

  return commit(
    session,
    after,
    {
      kind: "blood_exchange",
      summaryRu: `Кровавое колдовство: ${exchange.hitPointsSpent} хитов → ${exchange.pointsCreated} очков`,
      actionUsed: "action",
    },
    clock,
  );
}

/**
 * Почасовое восстановление максимума хитов (FR-173).
 *
 * За полный час без солнечного света и без урона огнём возвращается столько же, сколько даёт
 * регенерация за ход, но не больше утраченного кровавым колдовством
 * (rules-engine.md#регенерация-и-восстановление). Час отмечает игрок: таймеров в MVP нет.
 *
 * Текущие хиты не растут — восстанавливается именно потолок. Лечение поднимает текущие хиты, но
 * упереться им можно только в снижённый максимум, и это единственный способ его вернуть.
 */
export function recoverHitPointMaximum(session: Session, clock: Clock): Session {
  const { character } = session;
  if (character.hitPoints.maximumReduction <= 0) {
    throw new SessionError("Максимум хитов не снижен: восстанавливать нечего");
  }
  if (traitsSuppressed(character.suppression)) {
    throw new SessionError(
      character.suppression.firedUpon
        ? "Урон огнём подавил особенности: максимум пока не восстанавливается"
        : "Под прямым солнечным светом особенности не действуют",
    );
  }

  const returned = Math.min(
    maximumRecoveryPerHour(character.level),
    character.hitPoints.maximumReduction,
  );
  const after: CharacterState = {
    ...character,
    hitPoints: {
      ...character.hitPoints,
      maximum: character.hitPoints.maximum + returned,
      maximumReduction: character.hitPoints.maximumReduction - returned,
    },
  };
  return commit(
    session,
    after,
    {
      kind: "hit_points_changed",
      summaryRu: `Прошёл час: максимум хитов восстановлен на ${returned}`,
    },
    clock,
  );
}

/** Сколько хитов стоит заклинание указанного уровня для этого персонажа (FR-171). */
export function bloodCostFor(character: CharacterState, spellLevel: number): number {
  return hitPointCost(spellLevel, character.level);
}

// —————————————————————————— Урон и подавление ——————————————————————————

/**
 * Полученный урон. Огненный урон подавляет расовые особенности (FR-180).
 * Проверку концентрации приложение предлагает отдельно: бросает игрок (OQ-09).
 */
export function takeDamage(
  session: Session,
  damage: number,
  clock: Clock,
  options: { fire?: boolean } = {},
): Session {
  const { character } = session;
  if (!Number.isInteger(damage) || damage <= 0) {
    throw new SessionError(`Урон должен быть целым положительным, получено: ${damage}`);
  }
  // Урон идёт сначала по временным хитам, и только остаток — по текущим (FR-206).
  const absorbed = Math.min(character.temporaryHitPoints, damage);
  const after: CharacterState = {
    ...character,
    temporaryHitPoints: character.temporaryHitPoints - absorbed,
    hitPoints: {
      ...character.hitPoints,
      current: Math.max(0, character.hitPoints.current - (damage - absorbed)),
    },
    ...(options.fire === true
      ? { suppression: { ...character.suppression, firedUpon: true } }
      : {}),
  };
  const note = options.fire === true ? " (огонь: особенности подавлены)" : "";
  const absorbedNote = absorbed > 0 ? `, из них ${absorbed} временными хитами` : "";
  return commit(
    session,
    after,
    { kind: "hit_points_changed", summaryRu: `Получено урона: ${damage}${absorbedNote}${note}` },
    clock,
  );
}

/**
 * Лечение (FR-205).
 *
 * Потолок — `hitPoints.maximum`, и он уже снижен кровавым колдовством: `exchangeBlood` уменьшает сам
 * максимум, а `maximumReduction` хранит лишь то, сколько его предстоит вернуть по часу
 * ([FR-172](../../docs/features/F-15-blood-magic.md#fr-172)). Вычитать снижение ещё раз значило бы
 * снизить максимум дважды: после обмена 9 хитов персонаж с максимумом 51 не смог бы вылечиться выше
 * 42, и лечение молча упиралось бы в число, которого нет ни на одном экране.
 *
 * Временные хиты лечением не восстанавливаются: это не хиты (FR-206).
 */
export function heal(session: Session, amount: number, clock: Clock): Session {
  const { character } = session;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new SessionError(`Лечение должно быть целым положительным, получено: ${amount}`);
  }
  const ceiling = character.hitPoints.maximum;
  const current = Math.min(ceiling, character.hitPoints.current + amount);
  const restored = current - character.hitPoints.current;
  if (restored === 0) {
    throw new SessionError("Здоровье уже на максимуме");
  }
  const after: CharacterState = {
    ...character,
    hitPoints: { ...character.hitPoints, current },
  };
  const note = restored < amount ? ` (из ${amount}: упёрлись в максимум)` : "";
  return commit(
    session,
    after,
    { kind: "hit_points_changed", summaryRu: `Вылечено: ${restored}${note}` },
    clock,
  );
}

/**
 * Временные хиты (FR-206). Не складываются: берётся большее из двух — таково правило, и оно же
 * защищает от привычки «накопить» их несколькими источниками.
 */
export function grantTemporaryHitPoints(session: Session, amount: number, clock: Clock): Session {
  const { character } = session;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new SessionError(`Временные хиты должны быть целым положительным, получено: ${amount}`);
  }
  if (amount <= character.temporaryHitPoints) {
    throw new SessionError(
      `Временных хитов уже ${character.temporaryHitPoints}: они не складываются, меньшее не берётся`,
    );
  }
  return commit(
    session,
    { ...character, temporaryHitPoints: amount },
    { kind: "hit_points_changed", summaryRu: `Временные хиты: ${amount}` },
    clock,
  );
}

/**
 * Сколько здоровья вернёт конец боя (FR-216). Ноль — восстанавливать нечего.
 *
 * Половина максимума — со слов игрока про регенерацию тролля. В документе расы регенерация описана
 * иначе — 3 хита в начале своего хода, — и половина из неё не следует
 * ([OQ-15](../../docs/open-questions.md#oq-15), пункт 6). Поэтому приложение считает это число, но
 * не применяет само: восстановление предлагается кнопкой.
 */
export function combatEndRecovery(character: CharacterState): number {
  const half = Math.floor(character.hitPoints.maximum / 2);
  return Math.max(0, half - character.hitPoints.current);
}

/** Конец боя: здоровье поднимается до половины максимума, если оно ниже (FR-216). */
export function endCombat(session: Session, clock: Clock): Session {
  const { character } = session;
  const restored = combatEndRecovery(character);
  if (restored === 0) {
    throw new SessionError("Здоровье не ниже половины максимума: восстанавливать нечего");
  }
  const after: CharacterState = {
    ...character,
    hitPoints: { ...character.hitPoints, current: character.hitPoints.current + restored },
  };
  return commit(
    session,
    after,
    {
      kind: "hit_points_changed",
      summaryRu: `Бой закончен: восстановлено ${restored} до половины максимума`,
    },
    clock,
  );
}

/** Признак прямого солнечного света переключается вручную (FR-181). */
export function setSunlight(session: Session, underSunlight: boolean, clock: Clock): Session {
  const { character } = session;
  if (character.suppression.underDirectSunlight === underSunlight) {
    throw new SessionError("Признак солнечного света уже в этом состоянии");
  }
  const after: CharacterState = {
    ...character,
    suppression: { ...character.suppression, underDirectSunlight: underSunlight },
  };
  return commit(
    session,
    after,
    {
      kind: "suppression_changed",
      summaryRu: underSunlight ? "Под прямым солнечным светом" : "Вне солнечного света",
    },
    clock,
  );
}

// —————————————————————————————— Отдых ——————————————————————————————

/** Долгий отдых (FR-130). Восстанавливает всё, включая руны, и снимает концентрацию. */
export function longRest(session: Session, clock: Clock): Session {
  const { character } = session;
  const { concentration: _dropped, ...withoutConcentration } = character;
  const after: CharacterState = {
    ...withoutConcentration,
    spellSlots: restoreAllSlots(character.spellSlots),
    runes: { ...character.runes, remaining: character.runes.maximum },
    reactionAvailable: true,
    arcaneRecoveryAvailable: true,
    turnTracking: { actionAvailable: true, bonusActionAvailable: true },
    // Эффекты короче отдыха закрываются; «до рассеивания» и подобные — нет.
    activeEffects: character.activeEffects.filter((effect) => effect.duration.type === "special"),
    spellPoints: { remaining: 0, createdAt: null },
    // Временные хиты отдых снимает: они не восстанавливаются, а заканчиваются (FR-206).
    temporaryHitPoints: 0,
    suppression: { ...character.suppression, firedUpon: false },
  };
  return commit(session, after, { kind: "long_rest", summaryRu: "Долгий отдых" }, clock);
}

/** Короткий отдых (FR-132). Ячейки сам по себе не восстанавливает. */
export function shortRest(session: Session, clock: Clock): Session {
  const { character } = session;
  const after: CharacterState = {
    ...character,
    reactionAvailable: true,
    turnTracking: { actionAvailable: true, bonusActionAvailable: true },
    suppression: { ...character.suppression, firedUpon: false },
  };
  return commit(session, after, { kind: "short_rest", summaryRu: "Короткий отдых" }, clock);
}

/** Магическое восстановление (FR-131). Один раз между долгими отдыхами. */
export function useArcaneRecovery(
  session: Session,
  plan: SlotRecoveryPlan,
  clock: Clock,
): Session {
  const { character } = session;
  if (!character.arcaneRecoveryAvailable) {
    throw new SessionError("Магическое восстановление уже использовано до следующего долгого отдыха");
  }
  const after: CharacterState = {
    ...character,
    spellSlots: applyArcaneRecovery(character.spellSlots, plan, character.level),
    arcaneRecoveryAvailable: false,
  };
  const returned = Object.entries(plan)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${count}×${level} ур.`)
    .join(", ");
  return commit(
    session,
    after,
    { kind: "arcane_recovery", summaryRu: `Магическое восстановление: ${returned}` },
    clock,
  );
}

/**
 * Включение и выключение учёта хода (FR-143).
 *
 * При выключенном учёте действие и реакция считаются доступными всегда: вне боя отслеживание ходов
 * создаёт ложные предупреждения. Операция обратима, как и всё остальное (FR-111).
 */
/**
 * Смена режима экрана (FR-204).
 *
 * Без записи в журнал и без отмены: режим меняет вид, а не состояние персонажа. Записывать его
 * значило бы засорять журнал глубиной 100 ([FR-111](../../docs/features/F-10-journal-undo.md)) тем,
 * что нечего отменять, и заставлять «Отменить» переключать экран вместо возврата ресурса.
 *
 * Сохранение всё равно происходит: `apply` пишет сессию целиком после любой операции.
 */
export function setScreenMode(session: Session, mode: ScreenMode): Session {
  if (session.character.screenMode === mode) return session;
  return { ...session, character: { ...session.character, screenMode: mode } };
}


// —————————————————————————— Заметки ——————————————————————————

/**
 * Заметка пользователя к заклинанию (FR-012): место для домашних правил мастера.
 *
 * Игрового состояния не меняет, поэтому записи журнала не создаёт и отмене не подлежит
 * ([F-10](../../docs/features/F-10-journal-undo.md)): журнал — механизм обратимости ресурсов, а не
 * история правок текста. Заметка из одних пробелов удаляется: пустая строка не проходит схему
 * состояния.
 *
 * Сам текст сохраняется как введён. Обрезать его здесь нельзя: заметка пишется по одному символу, и
 * обрезка на каждом нажатии съедала бы пробел, который пользователь только что поставил.
 */
export function setSpellNote(session: Session, spellId: string, note: string): Session {
  const { [spellId]: _replaced, ...rest } = session.character.spellNotes;
  return {
    character: {
      ...session.character,
      spellNotes: note.trim() === "" ? rest : { ...rest, [spellId]: note },
    },
    journal: session.journal,
  };
}

/** Возврат ошибочно потраченной ячейки (FR-071). */
export function refundSpellSlot(session: Session, slotLevel: number, clock: Clock): Session {
  const after: CharacterState = {
    ...session.character,
    spellSlots: refundSlot(session.character.spellSlots, slotLevel),
  };
  return commit(
    session,
    after,
    { kind: "slot_refunded", summaryRu: `Возвращена ячейка ${slotLevel} уровня`, slotLevel },
    clock,
  );
}
