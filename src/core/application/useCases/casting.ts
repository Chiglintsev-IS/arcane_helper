/**
 * Сотворение заклинания: подтверждённое применение со всеми следствиями одной записью журнала.
 *
 * Сценарий сквозной — задевает книгу, схватку, ресурсы, жизнеспособность и эффекты сразу, — поэтому
 * живёт здесь, а не в домене: ни один агрегат не вправе знать про остальные.
 */

import { Character } from "@/core/domain/character/character";
import type { ActiveEffect, CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { DomainError } from "@/core/domain/shared/errors";
import { CANTRIP_LEVEL, consumesSlot, type CastMode } from "@/core/domain/arcana/slots";
import {
  lifeRuneTemporaryHitPoints,
  RUNE_LABEL,
  type Rune,
  type RuneTarget,
} from "@/core/domain/arcana/runes";
import { spellPointCost } from "@/core/domain/vitality/blood";
import { hitDiceHealing } from "@/core/domain/vitality/hitDice";
import { durationWithRoundsRu } from "@/core/domain/effects/concentration";
import {
  ACTION_SPENT_MESSAGES,
  turnResourceFor,
  type PaymentChoice,
  type TurnResource,
} from "@/core/application/casting/availability";
import { commit, type Clock, type Session } from "@/core/application/session";
import { deriveTurnEconomy, inFight } from "./turn";

/** Способ оплаты определён правилами — здесь только его применение к состоянию. */
export type Payment = PaymentChoice;

export type CastRequest = {
  spell: Spell;
  mode: CastMode;
  payment: Payment;
  targetLabel?: string;
  /** Руна применяется только к заклинанию, оплаченному ячейкой. */
  rune?: Rune;
  /** Кому досталась «Руна жизни»: остальные руны цели не выбирают. */
  runeTarget?: RuneTarget;
  /** Мастер разрешил исключение — предупреждения не блокируют. */
  allowAnyway?: boolean;
  /**
   * Потраченные Кости хитов и выпавшее на них. Есть только у заклинания, которое их тратит.
   * Выпавшее приходит от игрока: кубик бросает он, приложение принимает результат и складывает.
   */
  hitDice?: { count: number; rolled: number };
};

/** Что заклинание тратит внутри хода. Минуты и часы вне боевой экономии действий. */
export function actionUsedBy(spell: Spell): TurnResource | undefined {
  return turnResourceFor(spell.castingTime.type);
}

/**
 * Списывает потраченное внутри хода. Доступность считается по журналу, а флаги состояния
 * обновляются как кэш для интерфейса.
 */
function spendAction(session: Session, spell: Spell, allowAnyway: boolean): CharacterState {
  const { character } = session;
  const used = actionUsedBy(spell);
  if (used === undefined || !inFight(session)) return character;

  const economy = deriveTurnEconomy(session);
  const available =
    used === "reaction"
      ? economy.reactionAvailable
      : used === "bonus_action"
        ? economy.bonusActionAvailable
        : economy.actionAvailable;

  if (!available && !allowAnyway) {
    throw new DomainError(ACTION_SPENT_MESSAGES[used]);
  }

  if (used === "reaction") return { ...character, reactionAvailable: false };
  const turnTracking = { ...character.turnTracking };
  if (used === "bonus_action") turnTracking.bonusActionAvailable = false;
  else turnTracking.actionAvailable = false;
  return { ...character, turnTracking };
}

function applyPayment(root: Character, request: CastRequest): Character {
  const { spell, mode, payment, allowAnyway = false } = request;

  if (!consumesSlot(spell.level, mode)) {
    if (payment.kind !== "none") {
      throw new DomainError(
        spell.level === CANTRIP_LEVEL
          ? "Заговор не расходует ячейку"
          : "Ритуальное применение не расходует ячейку",
      );
    }
    return root;
  }

  if (payment.kind === "slot") {
    if (payment.slotLevel < spell.level) {
      throw new DomainError(
        `Ячейка ${payment.slotLevel} уровня ниже уровня заклинания ${spell.level}`,
      );
    }
    return root.withArcana(root.arcana.spendSlot(payment.slotLevel, { allowOverdraft: allowAnyway }));
  }

  if (payment.kind === "spell_points") {
    return root.withArcana(root.arcana.spendSpellPoints(spell.level, { allowAnyway }));
  }

  throw new DomainError("Заклинание с ячейкой требует способа оплаты");
}

/** Состояние персонажа меняет только руна, выбравшая его самого: чужие числа живут в объявлении. */
function grantsToCaster(request: CastRequest): boolean {
  return request.rune === "life" && request.runeTarget !== "other";
}

function applyRune(root: Character, request: CastRequest): Character {
  if (request.rune === undefined) return root;
  if (request.payment.kind !== "slot") {
    throw new DomainError("Руна применяется только к заклинанию, оплаченному ячейкой");
  }
  const spent = root.withArcana(root.arcana.spendRune());
  if (!grantsToCaster(request)) return spent;
  return spent.withVitality(
    spent.vitality.grantTemporary(lifeRuneTemporaryHitPoints(request.payment.slotLevel)),
  );
}

/** Что руна добавит к строке журнала: применённая руна не должна менять хиты молча. */
function runeNote(request: CastRequest): string {
  if (request.rune === undefined || request.payment.kind !== "slot") return "";
  const name = RUNE_LABEL[request.rune].replace("Руна ", "руна ");
  const points = lifeRuneTemporaryHitPoints(request.payment.slotLevel);
  if (request.rune !== "life") return ` · ${name}`;
  if (!grantsToCaster(request)) return ` · ${name}: ${points} временных хитов другому`;
  return ` · ${name}: ${points} временных хитов`;
}

function slotLevelUsed(request: CastRequest): number {
  if (request.payment.kind === "slot") return request.payment.slotLevel;
  return request.spell.level;
}

/**
 * Чем и когда закончится эффект.
 *
 * Длительность называется числом, а не словом «истечение»: «до истечения длительности» не отвечает
 * на единственный вопрос, который задают за столом, — сколько ещё держится.
 */
function endConditionRu(duration: ActiveEffect["duration"], concentration: boolean): string {
  if (duration.type === "special") {
    return concentration ? "До конца концентрации; длительность особая." : "Длительность особая.";
  }
  const held = durationWithRoundsRu(duration);
  return concentration ? `Держится ${held} или до конца концентрации.` : `Держится ${held}.`;
}

/** Создаёт активный эффект, если заклинание продолжается. Мгновенное — не создаёт. */
function buildEffect(request: CastRequest, clock: Clock): ActiveEffect | null {
  const { spell } = request;
  if (spell.duration.type === "instant") return null;

  const type: ActiveEffect["type"] = spell.concentration
    ? "control"
    : spell.targeting.type === "self"
      ? "buff"
      : "utility";

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
    // Вклад в Класс Доспеха копируется, чтобы итог считался из одного состояния, без каталога.
    ...(spell.armorClassEffect === undefined ? {} : { armorClass: spell.armorClassEffect }),
    ...(spell.repeatableAction === undefined ? {} : { repeatableAction: spell.repeatableAction }),
    endConditionRu: endConditionRu(duration, spell.concentration),
  };
}

/** Подтверждённое применение: оплата, действие, руна, концентрация, эффект — одной записью. */
export function castSpell(session: Session, request: CastRequest, clock: Clock): Session {
  const { spell, allowAnyway = false } = request;

  if (spell.concentration && session.character.concentration !== undefined && !allowAnyway) {
    throw new DomainError("Уже идёт концентрация: замена требует отдельного подтверждения");
  }

  let root = Character.of(spendAction(session, spell, allowAnyway));
  root = applyPayment(root, request);
  root = applyRune(root, request);

  const effect = buildEffect(request, clock);
  /*
 * Раундовый эффект вне схватки не успевает начаться: раундов нет, значит эффект истёк бы в тот же
 * миг, в который родился. Ячейка при этом уже потрачена — сотворить игрок выбрал сам, и молча
 * вернуть её значило бы решать за него, что он ошибся.
 */
  const expiresImmediately =
    effect !== null && effect.duration.type === "rounds" && !inFight(session);
  const expiredNote = expiresImmediately
    ? ` · «${spell.nameRu}» истёк сразу: вне боя раундов нет`
    : "";

  if (effect !== null && !expiresImmediately) {
    root = root.withEffects(root.effects.start(effect, clock.now()));
  }

  /*
 * Кости хитов и лечение по ним — часть того же сотворения, а не отдельная операция: игрок должен
 * вернуть ячейку, кости и хиты одним нажатием. Обычное лечение здесь не годится — оно отказывает
 * при полных хитах, а заклинание на полных хитах обязано проходить, просто впустую.
 */
  let hitDiceNote = "";
  if (request.hitDice !== undefined && spell.hitDiceCost !== undefined) {
    const { count, rolled } = request.hitDice;
    const healed = hitDiceHealing(spell.hitDiceCost, rolled, root.base.spellcastingModifier);
    const spentDice = root.vitality.spendHitDice(count);
    const { vitality, restored } = spentDice.healUpTo(healed);
    root = root.withVitality(vitality);
    const spentLabel = ` · ${count} ${count === 1 ? "кость" : "кости"} хитов`;
    // Молчание про нулевое лечение читалось бы как ошибка приложения, а это выбор игрока.
    hitDiceNote = restored === 0 ? `${spentLabel}, хиты уже на максимуме` : `${spentLabel}, вылечено ${restored}`;
  }

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
    root,
    {
      kind: spell.castingTime.type === "reaction" ? "reaction_cast" : "spell_cast",
      summaryRu: `${spell.nameRu} — ${how}${runeNote(request)}${hitDiceNote}${expiredNote}`,
      spellId: spell.id,
      slotLevel: level,
      // Вне схватки ход не отслеживается, значит и тратить нечего: записанное действие
      // предъявлялось бы игроку в бою, потому что до отметки о начале боя границы в журнале нет.
      ...(used === undefined || !inFight(session) ? {} : { actionUsed: used }),
    },
    clock,
  );
}
