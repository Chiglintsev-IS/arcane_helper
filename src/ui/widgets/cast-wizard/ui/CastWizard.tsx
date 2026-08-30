"use client";

import { RULE_MARK } from "@/ui/shared/ui/rule";
import type { CastOptionView, ChoicesView, ResourcesView, SpellRowView } from "@/contract/views";
import type { PreviewOf, Question } from "@/contract/questions";

import { WIZARD_STEP_TITLES, WizardShell } from "@/ui/shared/ui/WizardShell";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { castingTimeBadge, castingTimePhrase, levelLabel } from "@/ui/entities/spell/lib/format";
import {
  visibleSteps,
  CONCENTRATION_BUSY,
  NO_COMPONENT,
  type CastDraft,
  type WizardStep,
} from "@/ui/features/cast-spell/model/castDraftStore";
import { useDraft, useStores } from "@/ui/shared/model/storeContext";
import { withPlural } from "@/shared/language";
import { usePreview } from "@/ui/shared/model/usePreview";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP, SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";

type CastPreview = PreviewOf<"cast_preview">;

const RUNE_TARGET_LABELS: Readonly<Record<string, string>> = {
  self: "Себе",
  other: "Другому",
};

const STEP_TITLES: Record<WizardStep, string> = {
  availability: WIZARD_STEP_TITLES.availability,
  slot: "Чем сотворить",
  hitDice: "Кости хитов",
  components: "Компоненты",
  concentration: "Концентрация",
};

function RuneStep({
  draft,
  runes,
  targets,
  pool,
  onChoose,
  onChooseTarget,
}: {
  draft: CastDraft;
  runes: CastPreview["runes"];
  targets: ChoicesView["runeTargets"];
  pool: ResourcesView["runes"];
  onChoose: (rune: string, choosesTarget: boolean) => void;
  onChooseTarget: (target: string) => void;
}) {
  if (runes.unavailabilityRu !== undefined) {
    return (
      <section aria-label="Руна" className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-quiet">Руна</h3>
        <p className="text-xs text-ink-quiet">{runes.unavailabilityRu}</p>
      </section>
    );
  }

  return (
    <section aria-label="Руна" className="flex flex-col gap-2">
      <p className="text-xs text-ink-quiet">
        Руна не требует действия и не более одной на заклинание. Осталось рун: {pool.remaining} из{" "}
        {pool.maximum}.
      </p>
      <ul className="flex flex-col gap-1">
        {runes.effects.map((effect) => {
          const chosen = draft.rune === effect.rune;
          return (
            <li key={effect.rune}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() => onChoose(effect.rune, effect.choosesTarget)}
                className={`flex min-h-11 w-full flex-col items-start px-3 py-1 text-left ${
                  chosen
                    ? SURFACE_CHOSEN
                    : SURFACE_CONTROL
                }`}
              >
                <span className="text-sm font-medium leading-tight">{effect.nameRu}</span>
                <span className="text-xs leading-tight text-ink-quiet">
                  {effect.effectRu}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {runes.effects.some((effect) => effect.rune === draft.rune && effect.choosesTarget) ? (
        <div role="group" aria-label="Кому руна" className="flex gap-1">
          {targets.map((target) => (
            <button
              key={target}
              type="button"
              aria-pressed={draft.runeTarget === target}
              onClick={() => onChooseTarget(target)}
              className={`min-h-11 grow px-3 text-sm ${
                draft.runeTarget === target
                    ? SURFACE_CHOSEN
                    : SURFACE_CONTROL
              }`}
            >
              {RUNE_TARGET_LABELS[target] ?? target}
            </button>
          ))}
        </div>
      ) : null}
      {draft.rune === null ? (
        <p className="text-xs text-ink-quiet">
          Руна не выбрана — заклинание сотворится без неё.
        </p>
      ) : null}
    </section>
  );
}

function optionLabel(option: CastOptionView, resources: ResourcesView): string {
  if (option.mode === "ritual") {
    return `Ритуалом · +${option.extraMinutes} минут, ячейка не расходуется`;
  }
  if (option.payment.kind === "blood") {
    const cost = withPlural(option.hitPointCost ?? 0, ["хит", "хита", "хитов"]);
    return `Кровью · ячейка ${option.payment.castLevel} уровня, ${cost}`;
  }
  if (option.payment.kind === "slot") {
    const { slotLevel } = option.payment;
    const slot = resources.slots.find((candidate) => candidate.level === slotLevel);
    return `Ячейка ${slotLevel} уровня · осталось ${slot?.remaining ?? 0} из ${slot?.maximum ?? 0}`;
  }
  return "Без оплаты";
}

function AvailabilityStep({
  warnings,
  allowAnyway,
  onAllowAnyway,
}: {
  warnings: CastOptionView["warnings"];
  allowAnyway: boolean;
  onAllowAnyway: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {warnings
          .filter((warning) => warning.code !== CONCENTRATION_BUSY)
          .map((warning) => (
            <li
              key={warning.code}
              className={`${RULE_MARK.reaction} p-2 text-sm ${SURFACE_GROUP_BARE}`}
            >
              {warning.reasonRu}
            </li>
          ))}
      </ul>
      {allowAnyway ? (
        <p className="text-sm text-ink-quiet">
          Мастер разрешил исключение: предупреждения не мешают.
        </p>
      ) : (
        <button
          type="button"
          onClick={onAllowAnyway}
          className={`min-h-11 px-3 text-sm font-medium text-reaction ${SURFACE_CONTROL}`}
        >
          Применить всё равно
        </button>
      )}
    </div>
  );
}

function SlotStep({
  draft,
  row,
  resources,
  onChoose,
}: {
  draft: CastDraft;
  row: SpellRowView;
  resources: ResourcesView;
  onChoose: (option: CastOptionView) => void;
}) {
  const chosen = (option: CastOptionView): boolean =>
    option.mode === draft.option.mode &&
    option.payment.kind === draft.option.payment.kind &&
    option.castLevel === draft.option.castLevel;

  return (
    <ul className="flex flex-col gap-1">
      {row.castOptions.map((option) => {
        const key = `${option.mode}-${option.payment.kind}-${option.castLevel ?? 0}`;
        return (
          <li key={key}>
            <button
              type="button"
              aria-pressed={chosen(option)}
              onClick={() => onChoose(option)}
              className={`flex min-h-11 w-full flex-col items-start px-3 py-1 text-left text-sm ${
                chosen(option)
                    ? SURFACE_CHOSEN
                    : SURFACE_CONTROL
              }`}
            >
              <span>{optionLabel(option, resources)}</span>
              {option.damage === undefined ? null : (
                <span className="text-xs opacity-80">
                  урон {option.damage.formula} {option.damage.type}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function HitDiceStep({
  draft,
  hitDice,
  pool,
  onCount,
  onRolled,
}: {
  draft: CastDraft;
  hitDice: NonNullable<CastPreview["hitDice"]>;
  pool: { remaining: number; total: number; size: number } | undefined;
  onCount: (count: number) => void;
  onRolled: (rolled: number | null) => void;
}) {
  if (hitDice.maximum === 0) {
    return (
      <p className="text-sm opacity-80">
        Неистраченных Костей хитов не осталось — бросать нечего, и ячейка уйдёт впустую. Сотворить
        всё равно можно.
      </p>
    );
  }

  const count = draft.hitDiceCount;
  const size = pool?.size ?? 0;
  const rolled = draft.hitDiceRolled;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm">Сколько костей бросить</span>
        <ul className="flex flex-wrap gap-1">
          {Array.from({ length: hitDice.maximum }, (_, index) => index + 1).map((option) => (
            <li key={option}>
              <button
                type="button"
                aria-pressed={count === option}
                onClick={() => onCount(option)}
                className={`min-h-11 min-w-11 px-3 text-sm ${
                  count === option
                    ? SURFACE_CHOSEN
                    : SURFACE_CONTROL
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
        <div className="flex flex-col gap-1">
          <label className="text-sm" htmlFor="hit-dice-rolled">
            Что выпало на {count}d{size}
          </label>
          <input
            id="hit-dice-rolled"
            aria-describedby="hit-dice-rolled-hint"
            type="number"
            inputMode="numeric"
            min={hitDice.roll?.minimum}
            max={hitDice.roll?.maximum}
            value={rolled ?? ""}
            onChange={(event) =>
              onRolled(event.target.value === "" ? null : Number(event.target.value))
            }
            className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
          />
          {hitDice.rollPossible === false ? (
            <span id="hit-dice-rolled-hint" className="text-xs text-danger">
              На {count}d{size} может выпасть от {hitDice.roll?.minimum} до {hitDice.roll?.maximum}
            </span>
          ) : hitDice.restored === undefined ? (
            <span id="hit-dice-rolled-hint" className="text-xs opacity-80">
              Бросьте кости и введите сумму
            </span>
          ) : (
            <span id="hit-dice-rolled-hint" className="text-xs opacity-80">
              {rolled}
              {hitDice.modifier === 0 ? "" : ` + ${hitDice.modifier}`} — вернётся{" "}
              {hitDice.restored} хитов
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ComponentsStep({ row, warnings }: { row: SpellRowView; warnings: CastOptionView["warnings"] }) {
  const missing = warnings.filter((warning) => warning.code === NO_COMPONENT);

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {row.componentReminders.map((reminder) => (
        <li key={reminder} className={`p-2 ${SURFACE_GROUP}`}>
          {reminder}
        </li>
      ))}
      {missing.map((warning) => (
        <li
          key={warning.code}
          className={`${RULE_MARK.reaction} p-2 font-medium ${SURFACE_GROUP_BARE}`}
        >
          {warning.reasonRu}
        </li>
      ))}
      {missing.length === 0 ? (
        <li className="text-xs text-ink-quiet">Всё нужное есть.</li>
      ) : (
        <li className="text-xs text-ink-quiet">
          Купить и положить в сумку можно в режиме «Вне боя».
        </li>
      )}
    </ul>
  );
}

function ConcentrationStep({
  warnings,
  onReplace,
  onCancel,
  replaceConfirmed,
}: {
  warnings: CastOptionView["warnings"];
  onReplace: () => void;
  onCancel: () => void;
  replaceConfirmed: boolean;
}) {
  const busy = warnings.find((warning) => warning.code === CONCENTRATION_BUSY);
  if (busy === undefined) return null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className={`${RULE_MARK.concentration} p-2 ${SURFACE_GROUP_BARE}`}>
        {busy.reasonRu}
      </p>
      {replaceConfirmed ? (
        <p className="text-ink-quiet">Замена подтверждена.</p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`min-h-11 flex-1 px-3 ${SURFACE_CONTROL}`}
          >
            {BUTTON_LABELS.dismiss}
          </button>
          <button
            type="button"
            onClick={onReplace}
            className={`min-h-11 flex-1 px-3 font-medium text-concentration ${SURFACE_CONTROL}`}
          >
            Заменить концентрацию
          </button>
        </div>
      )}
    </div>
  );
}

function castQuestion(draft: CastDraft | null, row: SpellRowView | null): Question | null {
  if (draft === null || row === null) return null;
  return {
    kind: "cast_preview",
    spellId: row.id,
    mode: draft.option.mode,
    payment: draft.option.payment,
    ...(draft.rune === null ? {} : { rune: draft.rune }),
    ...(draft.hitDiceCount === null ? {} : { hitDiceCount: draft.hitDiceCount }),
    ...(draft.hitDiceRolled === null ? {} : { hitDiceRolled: draft.hitDiceRolled }),
  };
}

export function CastWizard({
  row,
  resources,
  choices,
  hitDice,
  onConfirm,
  error,
}: {
  row: SpellRowView | null;
  choices: ChoicesView;
  resources: ResourcesView;
  hitDice: { remaining: number; total: number; size: number } | undefined;
  onConfirm: (draft: CastDraft) => void;
  error: string | null;
}) {
  const { draft: draftStore } = useStores();
  const draft = useDraft((state) => state.draft);
  const answer = usePreview(castQuestion(draft, row));
  const preview: CastPreview | null = answer?.kind === "cast_preview" ? answer : null;

  if (draft === null || row === null) return null;

  const steps = visibleSteps(draft, row);
  const { warnings } = draft.option;

  const index = steps.indexOf(draft.step);
  const isLast = index === steps.length - 1;
  const castingTime = castingTimeBadge(row.castingTime.type);
  const actions = draftStore.getState();

  const concentrationBlocked =
    draft.step === "concentration" &&
    warnings.some((warning) => warning.code === CONCENTRATION_BUSY) &&
    !draft.replaceConcentration;
  const availabilityBlocked = draft.step === "availability" && !draft.allowAnyway;
  const hitDiceBlocked =
    draft.step === "hitDice" &&
    (preview === null ||
      (preview.hitDice !== undefined &&
        preview.hitDice.maximum > 0 &&
        preview.hitDice.rollPossible !== true));

  const back = index > 0 ? { onBack: () => actions.back(steps) } : {};

  return (
    <WizardShell
      ariaLabel={`Применение «${row.nameRu}»`}
      title={row.nameRu}
      subtitle={levelLabel(row.level)}
      badge={{
        tone: castingTime.tone,
        icon: castingTime.icon,
        label: castingTimePhrase(row.castingTime),
      }}
      stepLabel={`Шаг ${index + 1} из ${steps.length}: ${STEP_TITLES[draft.step]}`}
      onCancel={() => actions.cancel()}
      footer={{
        ...back,
        primaryLabel: isLast ? BUTTON_LABELS.confirm : "Далее",
        onPrimary: isLast ? () => onConfirm(draft) : () => actions.next(steps),
        primaryDisabled: availabilityBlocked || concentrationBlocked || hitDiceBlocked,
      }}
    >
      {draft.step === "availability" ? (
        <AvailabilityStep
          warnings={warnings}
          allowAnyway={draft.allowAnyway}
          onAllowAnyway={() => actions.allowAnyway()}
        />
      ) : null}
      {draft.step === "slot" ? (
        <>
          <SlotStep
            draft={draft}
            row={row}
            resources={resources}
            onChoose={(option) => actions.chooseCastOption(option)}
          />
          {row.cantrip || draft.option.mode === "ritual" || preview === null ? null : (
            <RuneStep
              draft={draft}
              runes={preview.runes}
              targets={choices.runeTargets}
              pool={resources.runes}
              onChoose={(rune, choosesTarget) => actions.chooseRune(rune, choosesTarget)}
              onChooseTarget={(target) => actions.chooseRuneTarget(target)}
            />
          )}
        </>
      ) : null}
      {draft.step === "hitDice" && preview?.hitDice !== undefined ? (
        <HitDiceStep
          draft={draft}
          hitDice={preview.hitDice}
          pool={hitDice}
          onCount={(count) => actions.setHitDiceCount(count)}
          onRolled={(rolled) => actions.setHitDiceRolled(rolled)}
        />
      ) : null}
      {draft.step === "components" ? <ComponentsStep row={row} warnings={warnings} /> : null}
      {draft.step === "concentration" ? (
        <ConcentrationStep
          warnings={warnings}
          replaceConfirmed={draft.replaceConcentration}
          onReplace={() => actions.replaceConcentration()}
          onCancel={() => actions.cancel()}
        />
      ) : null}

      {error === null ? null : (
        <p role="alert" className={`${RULE_MARK.reaction} p-2 text-sm ${SURFACE_GROUP_BARE}`}>
          {error}
        </p>
      )}
    </WizardShell>
  );
}
