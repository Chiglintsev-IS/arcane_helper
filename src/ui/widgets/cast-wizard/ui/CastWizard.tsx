/** Компонент меняет только черновик: состояние персонажа трогает лишь кнопка подтверждения. */

"use client";

import type { CastingView } from "@/contract/views";

import type { TurnEconomy } from "@/core/domain/encounter/encounter";
import { useState } from "react";

import {
  ANNOUNCEMENT_LABEL,
  WIZARD_STEP_TITLES,
  WizardShell,
} from "@/ui/shared/ui/WizardShell";
import { RitualDiagramView } from "@/ui/features/ritual-diagram/ui/RitualDiagramView";
import { castingTimeBadge, castingTimePhrase, levelLabel } from "@/ui/entities/spell/lib/format";
import { RoleplaySection } from "@/ui/features/roleplay/ui/RoleplaySection";
import type { CharacterState } from "@/core/domain/assembly/state";
import { checkAvailability, type Availability } from "@/core/application/casting/availability";
import { castOptions, type CastOption } from "@/core/application/casting/castOptions";
import { castInstructions, renderAnnouncement } from "@/core/application/casting/announcement";
import { effectiveDamage } from "@/core/domain/catalog/scaling";
import { hitPointCost, spellPointCost } from "@/core/domain/arcana/slots";
import {
  hitDiceRollRange,
  isPossibleHitDiceRoll,
  maximumHitDiceForCast,
} from "@/core/domain/vitality/hitDice";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";
import {
  visibleSteps,
  type CastDraft,
  type WizardStep,
} from "@/ui/features/cast-spell/model/castDraftStore";
import type { RoleplayCategory } from "@/core/domain/catalog/roleplay";
import {
  RUNES,
  RUNE_LABEL,
  RUNE_TARGETS,
  RUNE_TARGET_LABEL,
  runeChoosesTarget,
  runeEffect,
  runeUnavailability,
  type Rune,
  type RuneTarget,
} from "@/core/domain/arcana/runes";
import { useDraft, useStores } from "@/ui/shared/model/storeContext";

const STEP_TITLES: Record<WizardStep, string> = {
  availability: WIZARD_STEP_TITLES.availability,
  slot: "Чем сотворить",
  hitDice: "Кости хитов",
  components: "Компоненты",
  concentration: "Концентрация",
  summary: WIZARD_STEP_TITLES.summary,
};

/**
 * Причина, по которой руну сейчас не приложить, — словами. `null` — приложить можно.
 *
 * Недоступное показывается с причиной, а не исчезает (ux.md):
 * пропавший блок читается как «руны в этой игре нет», а не как «не к этому сотворению».
 */
function runeUnavailable(draft: CastDraft, character: CharacterState): string | null {
  return runeUnavailability(draft.payment.kind === "slot", character.runes.remaining);
}

/**
 * Шаг руны.
 *
 * Число показывается до подтверждения и по выбранному уровню ячейки: «половина уровня с округлением
 * вверх, минимум +1» — ровно то, что игрок иначе считает в уме в момент объявления мастеру.
 *
 * Руна необязательна: шаг проходится дальше без выбора, и это отдельная кнопка «Без руны», а не
 * молчание — иначе непонятно, ждёт ли мастер выбора.
 */
function RuneStep({
  draft,
  character,
  onChoose,
  onChooseTarget,
}: {
  draft: CastDraft;
  character: CharacterState;
  onChoose: (rune: Rune) => void;
  onChooseTarget: (target: RuneTarget) => void;
}) {
  const slotLevel = draft.payment.kind === "slot" ? draft.payment.slotLevel : draft.spell.level;
  const unavailable = runeUnavailable(draft, character);

  if (unavailable !== null) {
    return (
      <section aria-label="Руна" className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Руна</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">{unavailable}</p>
      </section>
    );
  }

  return (
    <section aria-label="Руна" className="flex flex-col gap-2">
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Руна не требует действия и не более одной на заклинание. Осталось рун:{" "}
        {character.runes.remaining} из {character.runes.maximum}.
      </p>
      <ul className="flex flex-col gap-1">
        {RUNES.map((rune) => {
          const chosen = draft.rune === rune;
          return (
            <li key={rune}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() => onChoose(rune)}
                className={`flex min-h-11 w-full flex-col items-start rounded-lg border px-3 py-1 text-left ${
                  chosen
                    ? "border-ritual bg-ritual/10 text-ritual-strong dark:text-ritual"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <span className="text-sm font-medium leading-tight">{RUNE_LABEL[rune]}</span>
                <span className="text-xs leading-tight text-slate-600 dark:text-slate-400">
                  {runeEffect(rune, slotLevel)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {draft.rune !== null && runeChoosesTarget(draft.rune) ? (
        <div role="group" aria-label="Кому руна" className="flex gap-1">
          {RUNE_TARGETS.map((target) => (
            <button
              key={target}
              type="button"
              aria-pressed={draft.runeTarget === target}
              onClick={() => onChooseTarget(target)}
              className={`min-h-11 grow rounded-lg border px-3 text-sm ${
                draft.runeTarget === target
                  ? "border-ritual bg-ritual/10 text-ritual-strong dark:text-ritual"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {RUNE_TARGET_LABEL[target]}
            </button>
          ))}
        </div>
      ) : null}
      {draft.rune === null ? (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Руна не выбрана — заклинание сотворится без неё.
        </p>
      ) : null}
    </section>
  );
}

/** Подпись способа сотворения: что именно спишется. */
function optionLabel(option: CastOption, draft: CastDraft, character: CharacterState): string {
  if (option.mode === "ritual") return "Ритуалом · +10 минут, ячейка не расходуется";
  if (option.payment.kind === "spell_points") {
    const points = spellPointCost(draft.spell.level);
    return `Кровью · ${points} очков (${hitPointCost(draft.spell.level, character.level)} хитов), осталось ${character.spellPoints.remaining}`;
  }
  if (option.payment.kind === "slot") {
    const slot = character.spellSlots[option.payment.slotLevel];
    return `Ячейка ${option.payment.slotLevel} уровня · осталось ${slot?.remaining ?? 0} из ${slot?.maximum ?? 0}`;
  }
  return "Без оплаты";
}

/** Результат повышения уровня показывается до подтверждения, а не после списания. */
function optionEffect(option: CastOption, draft: CastDraft, character: CharacterState): string | null {
  const { damage } = draft.spell;
  if (damage === undefined) return null;
  const slotLevel = option.payment.kind === "slot" ? option.payment.slotLevel : draft.spell.level;
  return `урон ${effectiveDamage(damage, {
    spellLevel: draft.spell.level,
    slotLevel,
    characterLevel: character.level,
  })} ${damage.type}`;
}

function AvailabilityStep({
  availability,
  allowAnyway,
  onAllowAnyway,
}: {
  availability: Availability;
  allowAnyway: boolean;
  onAllowAnyway: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {availability.warnings
          .filter((warning) => warning.code !== "concentration_busy")
          .map((warning) => (
            <li
              key={warning.code}
              className="rounded-lg border border-reaction/50 bg-reaction/10 p-2 text-sm"
            >
              {warning.reasonRu}
            </li>
          ))}
      </ul>
      {allowAnyway ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Мастер разрешил исключение: предупреждения не мешают.
        </p>
      ) : (
        <button
          type="button"
          onClick={onAllowAnyway}
          className="min-h-11 rounded-lg border border-reaction/60 px-3 text-sm font-medium text-reaction-strong dark:text-reaction"
        >
          Применить всё равно
        </button>
      )}
    </div>
  );
}

function SlotStep({
  draft,
  character,
  inCombat,
  onChoose,
}: {
  draft: CastDraft;
  character: CharacterState;
  /** В бою ритуального способа нет: он не укладывается в раунд. */
  inCombat: boolean;
  onChoose: (option: CastOption) => void;
}) {
  const options = castOptions(draft.spell, character, { inCombat });
  const chosen = (option: CastOption): boolean =>
    option.mode === draft.mode &&
    option.payment.kind === draft.payment.kind &&
    (option.payment.kind !== "slot" ||
      draft.payment.kind !== "slot" ||
      option.payment.slotLevel === draft.payment.slotLevel);

  return (
    <ul className="flex flex-col gap-1">
      {options.map((option) => {
        const effect = optionEffect(option, draft, character);
        const key = `${option.mode}-${option.payment.kind}-${
          option.payment.kind === "slot" ? option.payment.slotLevel : 0
        }`;
        return (
          <li key={key}>
            <button
              type="button"
              aria-pressed={chosen(option)}
              onClick={() => onChoose(option)}
              className={`flex min-h-11 w-full flex-col items-start rounded-lg border px-3 py-1 text-left text-sm ${
                chosen(option)
                  ? "border-action bg-action/10 text-action-strong dark:text-action"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <span>{optionLabel(option, draft, character)}</span>
              {effect === null ? null : <span className="text-xs opacity-80">{effect}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Сколько костей бросить и что выпало.
 *
 * Кубик бросает игрок, приложение принимает результат и складывает. Выпавшее проверяется
 * диапазоном возможного: опечатку от броска приложение отличать обязано, а оспаривать возможный
 * результат не вправе.
 */
function HitDiceStep({
  draft,
  character,
  casting,
  onCount,
  onRolled,
}: {
  draft: CastDraft;
  character: CharacterState;
  /** Числа заклинателя: прибавка к броску костей — его модификатор, а не число этой карточки. */
  casting: CastingView;
  onCount: (count: number) => void;
  onRolled: (rolled: number | null) => void;
}) {
  const cost = draft.spell.hitDiceCost;
  const pool = character.hitDice;
  if (cost === undefined) return null;

  const slotLevel = draft.payment.kind === "slot" ? draft.payment.slotLevel : draft.spell.level;
  const maximum = maximumHitDiceForCast(cost, draft.spell.level, slotLevel, pool?.remaining ?? 0);

  if (maximum === 0) {
    // Шаг не прячется, а объясняет: правило запрещает бросать несуществующие кости, но не
    // запрещает потратить ячейку зря, и решение остаётся за игроком.
    return (
      <p className="text-sm opacity-80">
        Неистраченных Костей хитов не осталось — бросать нечего, и ячейка уйдёт впустую. Сотворить
        всё равно можно.
      </p>
    );
  }

  const count = draft.hitDiceCount;
  const size = pool?.size ?? 0;
  const modifier = cost.addsSpellcastingModifier ? casting.spellcastingModifier : 0;
  const rolled = draft.hitDiceRolled;
  const range = count === null ? null : hitDiceRollRange(count, size);
  const outOfRange =
    count !== null && rolled !== null && !isPossibleHitDiceRoll(rolled, count, size);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm">Сколько костей бросить</span>
        <ul className="flex flex-wrap gap-1">
          {Array.from({ length: maximum }, (_, index) => index + 1).map((option) => (
            <li key={option}>
              <button
                type="button"
                aria-pressed={count === option}
                onClick={() => onCount(option)}
                className={`min-h-11 min-w-11 rounded-lg border px-3 text-sm ${
                  count === option
                    ? "border-action bg-action/10 text-action-strong dark:text-action"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {option}d{size}
              </button>
            </li>
          ))}
        </ul>
        <span className="text-xs opacity-80">
          Осталось {pool?.remaining ?? 0} из {pool?.total ?? 0}
        </span>
      </div>

      {count === null ? null : (
        // Подсказка вынесена из метки намеренно: внутри неё она попадала бы в доступное имя поля,
        // и вместо «Что выпало на 2d6» экранный диктор читал бы имя, склеенное с подсказкой.
        <div className="flex flex-col gap-1">
          <label className="text-sm" htmlFor="hit-dice-rolled">
            Что выпало на {count}d{size}
          </label>
          <input
            id="hit-dice-rolled"
            aria-describedby="hit-dice-rolled-hint"
            type="number"
            inputMode="numeric"
            min={range?.minimum}
            max={range?.maximum}
            value={rolled ?? ""}
            onChange={(event) =>
              onRolled(event.target.value === "" ? null : Number(event.target.value))
            }
            className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-800"
          />
          {outOfRange ? (
            <span id="hit-dice-rolled-hint" className="text-xs text-danger">
              На {count}d{size} может выпасть от {range?.minimum} до {range?.maximum}
            </span>
          ) : rolled === null ? (
            <span id="hit-dice-rolled-hint" className="text-xs opacity-80">
              Бросьте кости и введите сумму
            </span>
          ) : (
            <span id="hit-dice-rolled-hint" className="text-xs opacity-80">
              {rolled}
              {modifier === 0 ? "" : ` + ${modifier}`} — вернётся {rolled + modifier} хитов
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ComponentsStep({ availability }: { availability: Availability }) {
  // Вердикт, а не напоминание: приложение знает про фокусировку и про то, что лежит в сумке
  //. Пока был открыт, здесь стояла честная отговорка «проверьте по листу».
  const missing = availability.warnings.filter((warning) => warning.code === "no_component");

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {availability.componentReminders.map((reminder) => (
        <li key={reminder} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          {reminder}
        </li>
      ))}
      {missing.map((warning) => (
        <li
          key={warning.code}
          className="rounded-lg border border-reaction bg-reaction/10 p-2 font-medium"
        >
          {warning.reasonRu}
        </li>
      ))}
      {missing.length === 0 ? (
        <li className="text-xs text-slate-500">Всё нужное есть.</li>
      ) : (
        <li className="text-xs text-slate-500">
          Купить и положить в сумку можно в режиме «Вне боя».
        </li>
      )}
    </ul>
  );
}

/**
 * Предупреждение о концентрации. Единственное место мастера, где нужен выбор из двух:
 * «Применить всё равно» здесь недостаточно, потому что цена ошибки — молча потерянный эффект.
 *
 * Шаг показывается, только когда концентрация занята:
 * без замены выбирать не из чего, а о самой концентрации напоминает итоговый экран.
 */
function ConcentrationStep({
  character,
  onReplace,
  onCancel,
  replaceConfirmed,
}: {
  character: CharacterState;
  onReplace: () => void;
  onCancel: () => void;
  replaceConfirmed: boolean;
}) {
  const current = character.concentration;
  if (current === undefined) return null;

  // Имя берётся у эффекта, а при его отсутствии — у самой концентрации: так же поступает проверка
  // доступности, и расхождение двух источников не оставит на экране пустые кавычки.
  const effect = character.activeEffects.find(
    (candidate) => candidate.isConcentration && candidate.spellId === current.spellId,
  );

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="rounded-lg border border-concentration/50 bg-concentration/10 p-2">
        Идёт концентрация: «{effect?.nameRu ?? current.spellId}». Новое заклинание её завершит, и
        эффект закроется.
      </p>
      {replaceConfirmed ? (
        <p className="text-slate-600 dark:text-slate-400">Замена подтверждена.</p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 dark:border-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="min-h-11 flex-1 rounded-lg border border-concentration bg-concentration/10 px-3 font-medium text-concentration-strong dark:text-concentration"
          >
            Заменить концентрацию
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Итоговый экран: что сделать, что сказать мастеру, отыгрыш — три раздельных блока
 *
 * Первым идёт «Что сделать»: за столом нужен не пересказ правил, а числа этого персонажа —
 * «бросьте d20 + 8», а не «атака заклинанием, модификатор +8».
 */
function SummaryStep({
  draft,
  character,
  onRoleplay,
}: {
  draft: CastDraft;
  character: CharacterState;
  onRoleplay: (category: RoleplayCategory) => void;
}) {
  const context = {
    character,
    mode: draft.mode,
    payment: draft.payment,
    ...(draft.targetLabel === null ? {} : { targetLabel: draft.targetLabel }),
    ...(draft.rune === null ? {} : { rune: draft.rune }),
  };
  const announcement = renderAnnouncement(draft.spell, context);
  const instructions = castInstructions(draft.spell, context);
  const shownGaps = announcement.gaps.filter((gap) => gap.placeholder !== "target");
  const [diagramOpen, setDiagramOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Что сделать" className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Что сделать</h3>
        <ol className="flex flex-col gap-1 text-sm">
          {instructions.map((step) => (
            <li
              key={step}
              className="rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-800"
            >
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label={ANNOUNCEMENT_LABEL} className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Сказать мастеру
        </h3>
        <p className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
          {announcement.text}
        </p>
        {/* Отсутствие цели — решение, а не пробел: мастер её не спрашивает. */}
        {shownGaps.length === 0 ? null : (
          <ul className="flex flex-col gap-1 text-xs text-slate-500">
            {shownGaps.map((gap) => (
              <li key={gap.placeholder ?? gap.reasonRu}>{gap.reasonRu}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Схема только в ритуальном режиме: рисовать десять минут в бою нельзя. */}
      {draft.mode === "ritual" && draft.spell.ritualDiagram !== undefined ? (
        <button
          type="button"
          onClick={() => setDiagramOpen(true)}
          className="min-h-11 rounded-lg border border-ritual/60 px-3 text-sm font-medium text-ritual"
        >
          Схема ритуала
        </button>
      ) : null}

      {diagramOpen ? (
        <RitualDiagramView spell={draft.spell} onClose={() => setDiagramOpen(false)} />
      ) : null}

      <RoleplaySection
        spell={draft.spell}
        category={draft.roleplayCategory}
        onCategory={onRoleplay}
      />
    </div>
  );
}

export function CastWizard({
  character,
  casting,
  economy,
  onConfirm,
  error,
}: {
  character: CharacterState;
  casting: CastingView;
  economy: TurnEconomy;
  /** Подтверждение: единственное действие мастера, меняющее состояние персонажа. */
  onConfirm: (draft: CastDraft) => void;
  error: string | null;
}) {
  const { draft: draftStore } = useStores();
  const draft = useDraft((state) => state.draft);

  if (draft === null) return null;

  const context = { character, turn: economy };
  const steps = visibleSteps(draft, context);
  const availability = checkAvailability({
    spell: draft.spell,
    character,
    turn: economy,
    mode: draft.mode,
    payment: draft.payment,
  });

  const index = steps.indexOf(draft.step);
  const isLast = draft.step === "summary";
  const castingTime = castingTimeBadge(draft.spell.castingTime.type);
  const actions = draftStore.getState();

  // Замена концентрации требует явного выбора: без него дальше не пускаем. Согласие своё, а не
  // общее с «Применить всё равно»: иначе брошенное заклинание молча разрешало бы и перерасход.
  const concentrationBlocked =
    draft.step === "concentration" &&
    character.concentration !== undefined &&
    !draft.replaceConcentration;
  const availabilityBlocked = draft.step === "availability" && !draft.allowAnyway;
  // Кости: пока число не выбрано или выпавшее вне возможного, дальше не пускаем. Костей может не
  // остаться вовсе — тогда выбирать нечего, и шаг не задерживает.
  const hitDiceBlocked = ((): boolean => {
    if (draft.step !== "hitDice") return false;
    const cost = draft.spell.hitDiceCost;
    if (cost === undefined) return false;
    const slotLevel = draft.payment.kind === "slot" ? draft.payment.slotLevel : draft.spell.level;
    const maximum = maximumHitDiceForCast(
      cost,
      draft.spell.level,
      slotLevel,
      character.hitDice?.remaining ?? 0,
    );
    if (maximum === 0) return false;
    const { hitDiceCount: count, hitDiceRolled: rolled } = draft;
    if (count === null || rolled === null) return true;
    const size = character.hitDice?.size ?? 0;
    return !isPossibleHitDiceRoll(rolled, count, size);
  })();

  const back = index > 0 ? { onBack: () => actions.back(steps) } : {};

  return (
    <WizardShell
      ariaLabel={`Применение «${draft.spell.nameRu}»`}
      title={draft.spell.nameRu}
      subtitle={levelLabel(draft.spell.level)}
      badge={{
        tone: castingTime.tone,
        icon: castingTime.icon,
        label: castingTimePhrase(draft.spell.castingTime),
      }}
      stepLabel={`Шаг ${index + 1} из ${steps.length}: ${STEP_TITLES[draft.step]}`}
      onCancel={() => actions.cancel()}
      footer={
        isLast
          ? { ...back, primaryLabel: "Подтвердить", onPrimary: () => onConfirm(draft) }
          : {
              ...back,
              primaryLabel: "Далее",
              onPrimary: () => actions.next(steps),
              primaryDisabled: availabilityBlocked || concentrationBlocked || hitDiceBlocked,
            }
      }
    >
      {draft.step === "availability" ? (
        <AvailabilityStep
          availability={availability}
          allowAnyway={draft.allowAnyway}
          onAllowAnyway={() => actions.allowAnyway()}
        />
      ) : null}
      {draft.step === "slot" ? (
        <>
          <SlotStep
            draft={draft}
            character={character}
            inCombat={economy.inFight}
            onChoose={(option) => actions.chooseCastOption(option)}
          />
          {/*
 Руна живёт на этом же шаге, а не на своём: её эффект зависит от выбранного уровня
 ячейки, и отдельный экран сделал бы типовое применение трёхшаговым — против
 бюджета в четыре шага, из которых боевое заклинание сегодня тратит два.
 */}
          {draft.spell.level === CANTRIP_LEVEL || draft.mode === "ritual" ? null : (
            <RuneStep
              draft={draft}
              character={character}
              onChoose={(rune) => actions.chooseRune(rune)}
              onChooseTarget={(target) => actions.chooseRuneTarget(target)}
            />
          )}
        </>
      ) : null}
      {draft.step === "hitDice" ? (
        <HitDiceStep
          draft={draft}
          character={character}
          casting={casting}
          onCount={(count) => actions.setHitDiceCount(count)}
          onRolled={(rolled) => actions.setHitDiceRolled(rolled)}
        />
      ) : null}
      {draft.step === "components" ? <ComponentsStep availability={availability} /> : null}
      {draft.step === "concentration" ? (
        <ConcentrationStep
          character={character}
          replaceConfirmed={draft.replaceConcentration}
          onReplace={() => actions.replaceConcentration()}
          onCancel={() => actions.cancel()}
        />
      ) : null}
      {draft.step === "summary" ? (
        <SummaryStep
          draft={draft}
          character={character}
          onRoleplay={(category) => actions.setRoleplayCategory(category)}
        />
      ) : null}

      {error === null ? null : (
        <p role="alert" className="rounded-lg border border-reaction bg-reaction/10 p-2 text-sm">
          {error}
        </p>
      )}
    </WizardShell>
  );
}
