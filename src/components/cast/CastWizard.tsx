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

import { CASTING_TIME, levelLabel } from "@/components/spell/format";
import { RoleplaySection } from "@/components/spell/RoleplaySection";
import { Badge } from "@/components/ui/Badge";
import type { CharacterState } from "@/data/schemas/character";
import { checkAvailability, type Availability } from "@/rules/availability";
import { castOptions, type CastOption } from "@/rules/filters";
import { castInstructions, renderAnnouncement } from "@/rules/announcement";
import { effectiveDamage } from "@/rules/scaling";
import { hitPointCost, spellPointCost } from "@/rules/bloodMagic";
import {
  visibleSteps,
  type CastDraft,
  type RoleplayCategory,
  type WizardStep,
} from "@/store/castDraftStore";
import { useDraft, useStores } from "@/store/provider";
import type { TurnEconomy } from "@/store/session";

const STEP_TITLES: Record<WizardStep, string> = {
  availability: "Проверьте условия",
  slot: "Чем сотворить",
  components: "Компоненты",
  concentration: "Концентрация",
  summary: "Объявление и подтверждение",
};

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
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {availability.componentReminders.map((reminder) => (
        <li key={reminder} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
          {reminder}
        </li>
      ))}
      <li className="text-xs text-slate-500">
        Наличие компонентов приложение не отслеживает: проверьте по листу персонажа.
      </li>
    </ul>
  );
}

/**
 * Предупреждение о концентрации (FR-081). Единственное место мастера, где нужен выбор из двух:
 * «Применить всё равно» здесь недостаточно, потому что цена ошибки — молча потерянный эффект.
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
  const current = character.activeEffects.find((effect) => effect.isConcentration);

  if (current === undefined) {
    return (
      <p className="text-sm">
        Заклинание требует концентрации. Она прервётся от урона при провале проверки Телосложения.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="rounded-lg border border-concentration/50 bg-concentration/10 p-2">
        Идёт концентрация: «{current.nameRu}». Новое заклинание её завершит, и эффект закроется.
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
  };
  const announcement = renderAnnouncement(draft.spell, context);
  const instructions = castInstructions(draft.spell, context);
  const shownGaps = announcement.gaps.filter((gap) => gap.placeholder !== "target");

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

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Применение «${draft.spell.nameRu}»`}
      className="fixed inset-0 z-20 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <header className="flex flex-col gap-1 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold leading-tight">{draft.spell.nameRu}</h2>
            <p className="text-xs text-slate-500">{levelLabel(draft.spell.level)}</p>
          </div>
          <button
            type="button"
            onClick={() => actions.cancel()}
            className="px-2 text-sm text-slate-500 underline"
          >
            Отмена
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={castingTime.tone} icon={castingTime.icon}>
            {castingTime.label}
          </Badge>
          <p className="text-xs text-slate-500">
            Шаг {index + 1} из {steps.length}: {STEP_TITLES[draft.step]}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {draft.step === "availability" ? (
          <AvailabilityStep
            availability={availability}
            allowAnyway={draft.allowAnyway}
            onAllowAnyway={() => actions.allowAnyway()}
          />
        ) : null}
        {draft.step === "slot" ? (
          <SlotStep
            draft={draft}
            character={character}
            onChoose={(option) => actions.chooseCastOption(option)}
          />
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
      </div>

      <footer className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => actions.back(steps)}
            className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm dark:border-slate-800"
          >
            Назад
          </button>
        ) : null}
        {isLast ? (
          <button
            type="button"
            onClick={() => onConfirm(draft)}
            className="min-h-12 flex-1 rounded-xl bg-action-strong px-4 text-base font-semibold text-white"
          >
            Подтвердить
          </button>
        ) : (
          <button
            type="button"
            disabled={availabilityBlocked || concentrationBlocked}
            onClick={() => actions.next(steps)}
            className="min-h-12 flex-1 rounded-xl bg-action-strong px-4 text-base font-semibold text-white disabled:bg-slate-300 disabled:text-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-300"
          >
            Далее
          </button>
        )}
      </footer>
    </section>
  );
}
