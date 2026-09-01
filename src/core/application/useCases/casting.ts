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
  runeTrace,
  type Rune,
  type RuneTarget,
} from "@/core/domain/arcana/runes";

import { hitDiceHealing } from "@/core/domain/vitality/hitDice";
import { effectEndConditionRu } from "@/core/domain/effects/concentration";
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

type Payment = PaymentChoice;

type CastRequest = {
  spell: Spell;
  mode: CastMode;
  payment: Payment;
  rune?: Rune;
  runeTarget?: RuneTarget;
  allowAnyway?: boolean;
  replaceConcentration?: boolean;
  hitDice?: { count: number; rolled: number };
};

function actionUsedBy(spell: Spell): TurnResource | undefined {
  return turnResourceFor(spell.castingTime.type);
}

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

  if (payment.kind === "blood") {
    const { hitPoints } = bloodPrice(payment.castLevel, root.toState());
    return {
      root: root.withVitality(root.vitality.payWithBlood(hitPoints, { allowAnyway })),
      note: `ячейкой ${payment.castLevel} уровня из крови (${hitPoints} хитов)`,
    };
  }

  throw new DomainError("Заклинание с ячейкой требует способа оплаты");
}

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

function runeNote(request: CastRequest): string {
  const level = castLevelOf(request.payment);
  if (request.rune === undefined || level === undefined) return "";
  const name = RUNE_LABEL[request.rune].replace("Руна ", "руна ");
  const points = lifeRuneTemporaryHitPoints(level);
  if (request.rune !== "life") return ` · ${name}`;
  if (!grantsToCaster(request)) return ` · ${name}: ${points} временных хитов другому`;
  return ` · ${name}: ${points} временных хитов`;
}

function slotLevelUsed(request: CastRequest): number {
  return castLevelOf(request.payment) ?? request.spell.level;
}

function buildEffect(request: CastRequest, occasion: Occasion): ActiveEffect | null {
  const { spell } = request;
  if (spell.duration.type === "instant") return null;

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
    contributions: spell.contributions,
    ...(spell.repeatableAction === undefined ? {} : { repeatableAction: spell.repeatableAction }),
    endConditionRu: effectEndConditionRu(duration, spell.concentration),
  };
}

function buildRuneEffect(request: CastRequest, occasion: Occasion): ActiveEffect | null {
  const level = castLevelOf(request.payment);
  if (request.rune === undefined || level === undefined) return null;
  const trace = runeTrace(request.rune, level);
  if (trace === null) return null;

  return {
    id: occasion.nextId(),
    nameRu: RUNE_LABEL[request.rune],
    startedAt: occasion.now(),
    duration: { type: "rounds", value: trace.rounds },
    isConcentration: false,
    slotLevelUsed: level,
    contributions: trace.contributions,
    endConditionRu: trace.endConditionRu,
    note: trace.noteRu,
  };
}

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

  const inCombat = inFight(session);
  let expiredNote = "";

  for (const effect of [buildEffect(request, occasion), buildRuneEffect(request, occasion)]) {
    if (effect === null) continue;
    if (effect.duration.type === "rounds" && !inCombat) {
      expiredNote += ` · «${effect.nameRu}» истёк сразу: вне боя раундов нет`;
      continue;
    }
    root = root.withEffects(root.effects.start(effect, occasion.now()));
  }

  let hitDiceNote = "";
  if (request.hitDice !== undefined && spell.hitDiceCost !== undefined) {
    const { count, rolled } = request.hitDice;
    const healed = hitDiceHealing(spell.hitDiceCost, rolled, root.sheet.abilityModifier(SPELLCASTING_ABILITY));
    const spentDice = root.vitality.spendHitDice(count);
    const { vitality, restored } = spentDice.healUpTo(healed);
    root = root.withVitality(vitality);
    const spentLabel = ` · ${count} ${count === 1 ? "кость" : "кости"} хитов`;
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
      ...(used === undefined || !inCombat ? {} : { actionUsed: used }),
    },
    occasion,
  );
}
