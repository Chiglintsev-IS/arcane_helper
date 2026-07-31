/**
 * Мастер применения (FR-020…FR-023, FR-031, FR-040, FR-041).
 *
 * Шаги берутся из черновика: показывается только то, где есть выбор или предупреждение
 * ([FR-021](../../../docs/features/F-03-cast-wizard.md#fr-021)). Объявление, отыгрыш и подтверждение
 * живут на одном экране раздельными блоками (ADR-0010).
 *
 * Инвариант FR-022 держится структурой: этот компонент меняет только черновик. Единственное действие,
 * меняющее состояние персонажа, — кнопка подтверждения, и она вызывает переданный обработчик.
 */

"use client";

import { useState } from "react";

import { WizardShell } from "@/components/cast/WizardShell";
import { RitualDiagramView } from "@/components/ritual/RitualDiagramView";
import { CASTING_TIME, castingTimeLabel, levelLabel } from "@/components/spell/format";
import { RoleplaySection } from "@/components/spell/RoleplaySection";
import { Badge } from "@/components/ui/Badge";
import type { CharacterState } from "@/data/schemas/character";
import { checkAvailability, type Availability } from "@/rules/availability";
import { castOptions, type CastOption } from "@/rules/filters";
import { castInstructions, renderAnnouncement } from "@/rules/announcement";
import { effectiveDamage } from "@/rules/scaling";
import { hitPointCost, spellPointCost } from "@/rules/bloodMagic";
import { CANTRIP_LEVEL } from "@/rules/slots";
import {
  visibleSteps,
  type CastDraft,
  type RoleplayCategory,
  type WizardStep,
} from "@/store/castDraftStore";
import { RUNES, RUNE_LABEL, runeEffect, type Rune } from "@/rules/runes";
import { useDraft, useStores } from "@/store/provider";
import type { TurnEconomy } from "@/store/session";

const STEP_TITLES: Record<WizardStep, string> = {
  availability: "Проверьте условия",
  slot: "Чем сотворить",
  components: "Компоненты",
  concentration: "Концентрация",
  summary: "Объявление и подтверждение",
};

/**
 * Причина, по которой руну сейчас не приложить, — словами. `null` — приложить можно.
 *
 * Недоступное показывается с причиной, а не исчезает ([ux.md](../../../docs/ux.md#цветовая-система)):
 * пропавший блок читается как «руны в этой игре нет», а не как «не к этому сотворению».
 */
function runeUnavailable(draft: CastDraft, character: CharacterState): string | null {
  // Руна прикладывается только к заклинанию, оплаченному ячейкой (FR-151, OQ-17).
  if (draft.payment.kind !== "slot") return "При оплате кровью руна не применяется";
  if (character.runes.remaining <= 0) return "Рун не осталось, вернутся долгим отдыхом";
  return null;
}

/**
 * Шаг руны (FR-151, FR-152).
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
}: {
  draft: CastDraft;
  character: CharacterState;
  onChoose: (rune: Rune) => void;
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

/** Результат повышения уровня показывается до подтверждения, а не после списания (FR-071). */
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
  onChoose,
}: {
  draft: CastDraft;
  character: CharacterState;
  onChoose: (option: CastOption) => void;
}) {
  const options = castOptions(draft.spell, character);
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

function ComponentsStep({ availability }: { availability: Availability }) {
  // Вердикт, а не напоминание: приложение знает про фокусировку и про то, что лежит в сумке
  // (FR-030). Пока OQ-06 был открыт, здесь стояла честная отговорка «проверьте по листу».
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
 * Предупреждение о концентрации (FR-081). Единственное место мастера, где нужен выбор из двух:
 * «Применить всё равно» здесь недостаточно, потому что цена ошибки — молча потерянный эффект.
 *
 * Шаг показывается, только когда концентрация занята ([FR-021](../../../docs/features/F-03-cast-wizard.md#fr-021)):
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
 * (ADR-0010, AC-20).
 *
 * Первым идёт «Что сделать»: за столом нужен не пересказ правил, а числа этого персонажа —
 * «бросьте d20 + 8», а не «атака заклинанием, модификатор +8» (FR-032).
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

      <section aria-label="Объявление мастеру" className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Сказать мастеру
        </h3>
        <p className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
          {announcement.text}
        </p>
        {/* Отсутствие цели — решение, а не пробел: мастер её не спрашивает (OQ-10). */}
        {shownGaps.length === 0 ? null : (
          <ul className="flex flex-col gap-1 text-xs text-slate-500">
            {shownGaps.map((gap) => (
              <li key={gap.placeholder ?? gap.reasonRu}>{gap.reasonRu}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Схема только в ритуальном режиме: рисовать десять минут в бою нельзя (FR-192). */}
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
  economy,
  onConfirm,
  error,
}: {
  character: CharacterState;
  economy: TurnEconomy;
  /** Подтверждение: единственное действие мастера, меняющее состояние персонажа (FR-023). */
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
  const castingTime = CASTING_TIME[draft.spell.castingTime.type];
  const actions = draftStore.getState();

  // Замена концентрации требует явного выбора: без него дальше не пускаем (FR-081).
  const concentrationBlocked =
    draft.step === "concentration" &&
    character.concentration !== undefined &&
    !draft.allowAnyway;
  const availabilityBlocked = draft.step === "availability" && !draft.allowAnyway;

  const back = index > 0 ? { onBack: () => actions.back(steps) } : {};

  return (
    <WizardShell
      ariaLabel={`Применение «${draft.spell.nameRu}»`}
      title={draft.spell.nameRu}
      subtitle={levelLabel(draft.spell.level)}
      badge={{
        tone: castingTime.tone,
        icon: castingTime.icon,
        label: castingTimeLabel(draft.spell.castingTime),
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
              primaryDisabled: availabilityBlocked || concentrationBlocked,
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
            onChoose={(option) => actions.chooseCastOption(option)}
          />
          {/*
            Руна живёт на этом же шаге, а не на своём: её эффект зависит от выбранного уровня
            ячейки (FR-152), и отдельный экран сделал бы типовое применение трёхшаговым — против
            бюджета M-03 в четыре шага, из которых боевое заклинание сегодня тратит два.
          */}
          {draft.spell.level === CANTRIP_LEVEL || draft.mode === "ritual" ? null : (
            <RuneStep
              draft={draft}
              character={character}
              onChoose={(rune) => actions.chooseRune(rune)}
            />
          )}
        </>
      ) : null}
      {draft.step === "components" ? <ComponentsStep availability={availability} /> : null}
      {draft.step === "concentration" ? (
        <ConcentrationStep
          character={character}
          replaceConfirmed={draft.allowAnyway}
          onReplace={() => actions.allowAnyway()}
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
