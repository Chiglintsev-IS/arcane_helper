/**
 * Сотворение заклинания: подтверждённое применение со всеми следствиями одной записью журнала.
 *
 * Сценарий сквозной — задевает книгу, схватку, ресурсы, жизнеспособность и эффекты сразу, — поэтому
 * живёт здесь, а не в домене: ни один объект-значение не вправе знать про остальные.
 */

import { Character } from "@/core/domain/assembly/character";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import type { Spell } from "@/core/domain/catalog/spell";
import { DomainError } from "@/core/domain/shared/errors";
import { consumesSlot, type CastMode } from "@/core/domain/arcana/slots";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";
import {
  lifeRuneTemporaryHitPoints,
  RUNE_LABEL,
  type Rune,
  type RuneTarget,
} from "@/core/domain/arcana/runes";

import { hitDiceHealing } from "@/core/domain/vitality/hitDice";
import { durationWithRoundsRu } from "@/core/domain/effects/concentration";
import {
  bloodPrice,
  castLevelOf,
  checkAvailability,
  turnResourceFor,
  withoutConsent,
  type Consents,
  type PaymentChoice,
  type TurnResource,
} from "@/core/application/casting/availability";
import { materialOf } from "@/core/application/casting/material";
import { commit, type Occasion, type Session } from "@/core/application/session";
import { deriveTurnEconomy, inFight } from "./turn";

/** Способ оплаты определён правилами — здесь только его применение к состоянию. */
type Payment = PaymentChoice;

type CastRequest = {
  spell: Spell;
  mode: CastMode;
  payment: Payment;
  targetLabel?: string;
  /** Руна применяется только к сотворению, у которого есть уровень. */
  rune?: Rune;
  /** Кому досталась «Руна жизни»: остальные руны цели не выбирают. */
  runeTarget?: RuneTarget;
  /** Мастер разрешил исключение — предупреждения, которые оно снимает, не блокируют. */
  allowAnyway?: boolean;
  /**
   * Игрок согласился прервать идущую концентрацию. Исключением мастера это согласие не заменяется:
   * выбор между двумя эффектами принадлежит игроку и делается на своём шаге.
   */
  replaceConcentration?: boolean;
  /**
   * Потраченные Кости хитов и выпавшее на них. Есть только у заклинания, которое их тратит.
   * Выпавшее приходит от игрока: кубик бросает он, приложение принимает результат и складывает.
   */
  hitDice?: { count: number; rolled: number };
};

/** Что заклинание тратит внутри хода. Минуты и часы вне боевой экономии действий. */
function actionUsedBy(spell: Spell): TurnResource | undefined {
  return turnResourceFor(spell.castingTime.type);
}

/**
 * Оплата и то, что она стоила крови.
 *
 * Кровь входит в само сотворение, а не предшествует ему: недостающие очки покупаются хитами тем же
 * подтверждением, одной записью журнала и одной отменой. Отдельного захода в обмен для этого не
 * нужно — обмен хода не занимает.
 */
function applyPayment(root: Character, request: CastRequest): { root: Character; note: string } {
  const { spell, mode, payment, allowAnyway = false } = request;

  if (!consumesSlot(spell.level, mode)) {
    return { root, note: "" };
  }

  if (payment.kind === "slot") {
    return {
      root: root.withArcana(root.arcana.spendSlot(payment.slotLevel, { allowOverdraft: allowAnyway })),
      note: `ячейкой ${payment.slotLevel} уровня`,
    };
  }

  if (payment.kind === "spell_points") {
    const price = bloodPrice(payment.castLevel, root.toState());
    let paid = root;
    if (price.pointsBought > 0) {
      const { vitality, exchange } = paid.vitality.exchangeBlood(
        price.hitPoints,
        price.pointsBought,
        { allowAnyway },
      );
      paid = paid.withVitality(vitality).withArcana(paid.arcana.gainSpellPoints(exchange.pointsCreated));
    }
    const source = price.pointsBought === 0 ? "из запаса" : `${price.hitPoints} хитов`;
    return {
      root: paid.withArcana(paid.arcana.spendSpellPoints(payment.castLevel, { allowAnyway })),
      note: `кровью, ${price.spellPoints} очков (${source})`,
    };
  }

  throw new DomainError("Заклинание с ячейкой требует способа оплаты");
}

/** Состояние персонажа меняет только руна, выбравшая его самого: чужие числа живут в объявлении. */
function grantsToCaster(request: CastRequest): boolean {
  return request.rune === "life" && request.runeTarget !== "other";
}

function applyRune(root: Character, request: CastRequest): Character {
  if (request.rune === undefined) return root;
  const level = castLevelOf(request.payment);
  if (level === undefined) {
    throw new DomainError("Руна применяется только к сотворению, у которого есть уровень");
  }
  const spent = root.withArcana(root.arcana.spendRune());
  if (!grantsToCaster(request)) return spent;
  return spent.withVitality(spent.vitality.grantTemporary(lifeRuneTemporaryHitPoints(level)));
}

/**
 * Расходуемый компонент сгорает применением, и журнал называет сгоревшее: молча уменьшившийся запас
 * читался бы за столом как ошибка приложения.
 *
 * Пустой сумке гореть нечем. Мастер вправе разрешить сотворение без компонента — вещи из этого
 * разрешения не берётся, и отказывать после разрешения приложению не за что.
 */
function burnMaterial(root: Character, spell: Spell): { root: Character; note: string } {
  const material = materialOf(spell.components);
  if (material === undefined || !material.consumed || !root.equipment.carries(material.id)) {
    return { root, note: "" };
  }
  return {
    root: root.withEquipment(root.equipment.adjustBagCount(material.id, -1)),
    note: ` · компонент израсходован: ${material.nameRu}`,
  };
}

/** Что руна добавит к строке журнала: применённая руна не должна менять хиты молча. */
function runeNote(request: CastRequest): string {
  const level = castLevelOf(request.payment);
  if (request.rune === undefined || level === undefined) return "";
  const name = RUNE_LABEL[request.rune].replace("Руна ", "руна ");
  const points = lifeRuneTemporaryHitPoints(level);
  if (request.rune !== "life") return ` · ${name}`;
  if (!grantsToCaster(request)) return ` · ${name}: ${points} временных хитов другому`;
  return ` · ${name}: ${points} временных хитов`;
}

/** Уровень сотворения, а без него — собственный уровень заклинания: заговор и ритуал не растут. */
function slotLevelUsed(request: CastRequest): number {
  return castLevelOf(request.payment) ?? request.spell.level;
}

/**
 * Чем и когда закончится эффект.
 *
 * Длительность называется числом, а не словом «истечение»: «до истечения длительности» не отвечает
 * на единственный вопрос, который задают за столом, — сколько ещё держится.
 */
function endConditionRu(duration: ActiveEffect["duration"], concentration: boolean): string {
  if (duration.type === "until_spell_ends") {
    return concentration ? "До конца концентрации; длительность особая." : "Длительность особая.";
  }
  const held = durationWithRoundsRu(duration);
  return concentration ? `Держится ${held} или до конца концентрации.` : `Держится ${held}.`;
}

/** Создаёт активный эффект, если заклинание продолжается. Мгновенное — не создаёт. */
function buildEffect(request: CastRequest, occasion: Occasion): ActiveEffect | null {
  const { spell } = request;
  if (spell.duration.type === "instant") return null;

  // Карточка называет срок особым — значит отмеряет его само заклинание, а не часы.
  const duration: ActiveEffect["duration"] =
    spell.duration.type === "special"
      ? { type: "until_spell_ends" }
      : {
          type: spell.duration.type,
          ...(spell.duration.value === undefined ? {} : { value: spell.duration.value }),
        };

  return {
    id: occasion.nextId(),
    spellId: spell.id,
    nameRu: spell.nameRu,
    startedAt: occasion.now(),
    duration,
    isConcentration: spell.concentration,
    slotLevelUsed: slotLevelUsed(request),
    // Вклады копируются, чтобы итог считался из одного состояния, без каталога.
    contributions: spell.contributions,
    ...(spell.repeatableAction === undefined ? {} : { repeatableAction: spell.repeatableAction }),
    endConditionRu: endConditionRu(duration, spell.concentration),
  };
}

/** Подтверждённое применение: оплата, действие, руна, концентрация, эффект — одной записью. */
export function castSpell(session: Session, request: CastRequest, occasion: Occasion): Session {
  const { spell } = request;

  const turn = deriveTurnEconomy(session);
  const { warnings } = checkAvailability({
    spell,
    character: session.character,
    turn,
    mode: request.mode,
    payment: request.payment,
  });
  /*
   * Запрет исполняется по объявлению предиката, а не по списку кодов: перечень «что здесь важно»
   * расходился с тем, чем предупреждение объявлено, и одно согласие снимало даже то, которое им не
   * снимается. Мастер применения спрашивает те же согласия до подтверждения — сюда они приходят
   * ответом игрока, а не догадкой сценария.
   */
  const consents: Consents = {
    gm_exception: request.allowAnyway === true,
    ending_concentration: request.replaceConcentration === true,
  };
  const blocking = withoutConsent(warnings, consents);
  if (blocking !== undefined) {
    throw new DomainError(blocking.reasonRu);
  }

  let root = Character.of(session.character);
  const paid = applyPayment(root, request);
  root = applyRune(paid.root, request);

  const burned = burnMaterial(root, spell);
  root = burned.root;

  const effect = buildEffect(request, occasion);
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
    root = root.withEffects(root.effects.start(effect, occasion.now()));
  }

  /*
 * Кости хитов и лечение по ним — часть того же сотворения, а не отдельная операция: игрок должен
 * вернуть ячейку, кости и хиты одним нажатием. Обычное лечение здесь не годится — оно отказывает
 * при полных хитах, а заклинание на полных хитах обязано проходить, просто впустую.
 */
  let hitDiceNote = "";
  if (request.hitDice !== undefined && spell.hitDiceCost !== undefined) {
    const { count, rolled } = request.hitDice;
    const healed = hitDiceHealing(spell.hitDiceCost, rolled, root.sheet.abilityModifier(SPELLCASTING_ABILITY));
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
    request.mode === "ritual" ? "ритуалом" : spell.level === CANTRIP_LEVEL ? "заговором" : paid.note;

  return commit(
    session,
    root,
    {
      kind: spell.castingTime.type === "reaction" ? "reaction_cast" : "spell_cast",
      summaryRu: `${spell.nameRu} — ${how}${runeNote(request)}${burned.note}${hitDiceNote}${expiredNote}`,
      spellId: spell.id,
      slotLevel: level,
      // Вне схватки ход не отслеживается, значит и тратить нечего: записанное действие
      // предъявлялось бы игроку в бою, потому что до отметки о начале боя границы в журнале нет.
      ...(used === undefined || !inFight(session) ? {} : { actionUsed: used }),
    },
    occasion,
  );
}
