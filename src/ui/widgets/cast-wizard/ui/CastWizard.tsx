/**
 * Компонент меняет только черновик: состояние персонажа трогает лишь кнопка подтверждения.
 *
 * По правилам он не считает ничего. Способы сотворения с их ценой, уроном и вердиктом приезжают
 * строкой заклинания; объявление, шаги, эффект руны и границы броска костей — ответом на вопрос про
 * набранное. Здесь остаются слова, порядок и то, открыт ли шаг.
 */

"use client";

import { RULE_MARK } from "@/ui/shared/ui/rule";
import type { CastOptionView, ChoicesView, ResourcesView, SpellRowView } from "@/contract/views";
import type { PreviewOf, Question } from "@/contract/questions";

import { useState } from "react";

import {
  ANNOUNCEMENT_LABEL,
  WIZARD_STEP_TITLES,
  WizardShell,
} from "@/ui/shared/ui/WizardShell";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { RitualDiagramView } from "@/ui/features/ritual-diagram/ui/RitualDiagramView";
import { castingTimeBadge, castingTimePhrase, levelLabel } from "@/ui/entities/spell/lib/format";
import { RoleplaySection } from "@/ui/features/roleplay/ui/RoleplaySection";
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

/** Кому руна: перечень целей приезжает перечнем правил, а слово к слову выбирает экран. */
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
  summary: WIZARD_STEP_TITLES.summary,
};

/**
 * Шаг руны.
 *
 * Число показывается до подтверждения и по выбранному уровню ячейки: «половина уровня с округлением
 * вверх, минимум +1» — ровно то, что игрок иначе считает в уме в момент объявления мастеру. Считает
 * его ядро: посчитать здесь значило бы завести второе правило о том же.
 *
 * Недоступное показывается с причиной, а не исчезает: пропавший блок читается как «руны в этой игре
 * нет», а не как «не к этому сотворению».
 *
 * Руна необязательна: шаг проходится дальше без выбора, и это отдельная кнопка «Без руны», а не
 * молчание — иначе непонятно, ждёт ли мастер выбора.
 */
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
  /** Кому руна: перечень тех, между кем выбирают. */
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

/** Подпись способа сотворения: что именно спишется. Числа приехали посчитанными. */
function optionLabel(option: CastOptionView, resources: ResourcesView): string {
  if (option.mode === "ritual") {
    return `Ритуалом · +${option.extraMinutes} минут, ячейка не расходуется`;
  }
  if (option.payment.kind === "spell_points") {
    const points = withPlural(option.spellPointCost ?? 0, ["очко", "очка", "очков"]);
    // Хиты названы только там, где их придётся отдать: за покрытое запасом крови не платят.
    const price =
      option.hitPointCost === 0
        ? `${points} из запаса, есть ${resources.spellPoints}`
        : `${points}, ${withPlural(option.hitPointCost ?? 0, ["хит", "хита", "хитов"])}`;
    return `Кровью, ${option.payment.castLevel} уровень · ${price}`;
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
    (option.payment.kind !== "slot" ||
      draft.option.payment.kind !== "slot" ||
      option.payment.slotLevel === draft.option.payment.slotLevel);

  return (
    <ul className="flex flex-col gap-1">
      {row.castOptions.map((option) => {
        const key = `${option.mode}-${option.payment.kind}-${
          option.payment.kind === "slot" ? option.payment.slotLevel : 0
        }`;
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

/**
 * Сколько костей бросить и что выпало.
 *
 * Кубик бросает игрок, приложение принимает результат и складывает. Возможность выпавшего решают
 * правила: опечатку от броска приложение отличать обязано, а оспаривать возможный результат не
 * вправе.
 */
function HitDiceStep({
  draft,
  hitDice,
  pool,
  onCount,
  onRolled,
}: {
  draft: CastDraft;
  hitDice: NonNullable<CastPreview["hitDice"]>;
  /** Остаток костей: их считает лист, и вторым числом здесь он не заводится. */
  pool: { remaining: number; total: number; size: number } | undefined;
  onCount: (count: number) => void;
  onRolled: (rolled: number | null) => void;
}) {
  if (hitDice.maximum === 0) {
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
  // Вердикт, а не напоминание: приложение знает про фокусировку и про то, что лежит в сумке
  //. Пока был открыт, здесь стояла честная отговорка «проверьте по листу».
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

/**
 * Предупреждение о концентрации. Единственное место мастера, где нужен выбор из двух:
 * «Применить всё равно» здесь недостаточно, потому что цена ошибки — молча потерянный эффект.
 *
 * Шаг показывается, только когда концентрация занята:
 * без замены выбирать не из чего, а о самой концентрации напоминает итоговый экран.
 */
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
  // Чем именно занята концентрация, называет та же проверка, которая её и обнаружила: собранная
  // здесь заново фраза разошлась бы с отказом подтверждения.
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

/**
 * Итоговый экран: что сказать мастеру, отыгрыш, что сделать — три раздельных блока.
 *
 * Порядок — порядок хода за столом: сначала произносят, потом отыгрывают, потом действуют. Поэтому
 * объявление стоит первым и видно целиком, а инструкция — последней и напоминанием: числа этого
 * персонажа («бросьте d20 + 8», а не «атака заклинанием») нужны после ответа мастера, но нужны
 * целиком, и потому она не сворачивается.
 */
function SummaryStep({
  draft,
  row,
  preview,
  onRoleplay,
}: {
  draft: CastDraft;
  row: SpellRowView;
  preview: CastPreview | null;
  onRoleplay: (category: string) => void;
}) {
  const [diagramOpen, setDiagramOpen] = useState(false);
  // Отсутствие цели — решение, а не пробел: мастер её не спрашивает.
  const shownGaps = (preview?.announcement.gaps ?? []).filter(
    (gap) => gap.placeholder !== "target",
  );

  return (
    <div className="flex flex-col gap-3">
      <section aria-label={ANNOUNCEMENT_LABEL} className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-quiet">
          Сказать мастеру
        </h3>
        <p className={`p-2 text-base leading-snug ${SURFACE_GROUP}`}>
          {preview?.announcement.text ?? ""}
        </p>
        {shownGaps.length === 0 ? null : (
          <ul className="flex flex-col gap-1 text-xs text-ink-quiet">
            {shownGaps.map((gap) => (
              <li key={gap.placeholder ?? gap.reasonRu}>{gap.reasonRu}</li>
            ))}
          </ul>
        )}
      </section>

      <RoleplaySection
        spellId={row.id}
        category={draft.roleplayCategory}
        onCategory={onRoleplay}
      />

      <section aria-label="Что сделать" className="flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-quiet">Что сделать</h3>
        <ol className="flex list-inside list-decimal flex-col gap-1 text-sm text-ink-quiet">
          {(preview?.instructions ?? []).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {/* Схема только в ритуальном режиме: рисовать десять минут в бою нельзя. */}
      {draft.option.mode === "ritual" && row.card.ritualDiagram !== undefined ? (
        <button
          type="button"
          onClick={() => setDiagramOpen(true)}
          className={`min-h-11 px-3 text-sm font-medium text-ritual ${SURFACE_CONTROL}`}
        >
          Схема ритуала
        </button>
      ) : null}

      {diagramOpen ? (
        <RitualDiagramView row={row} onClose={() => setDiagramOpen(false)} />
      ) : null}
    </div>
  );
}

/**
 * Что спросить у ядра про набранное. `null` — мастер закрыт, и спрашивать не о чем.
 *
 * Вопрос везёт выбранный способ и всё, что игрок успел набрать: объявление, шаги, эффект руны и
 * границы броска зависят и от того, и от другого, и ответ на них один.
 */
function castQuestion(draft: CastDraft | null, row: SpellRowView | null): Question | null {
  if (draft === null || row === null) return null;
  return {
    kind: "cast_preview",
    spellId: row.id,
    mode: draft.option.mode,
    payment: draft.option.payment,
    ...(draft.targetLabel === null ? {} : { targetLabel: draft.targetLabel }),
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
  /** Строка выбранного заклинания; `null` — мастер закрыт либо строки для него нет. */
  row: SpellRowView | null;
  /** Из чего выбирают: кому достаётся руна, выбирающая цель. */
  choices: ChoicesView;
  /** Чем платить: остатки ячеек, рун и очков. Считать по ним мастер ничего не вправе. */
  resources: ResourcesView;
  /** Кости хитов персонажа; нет вовсе — состояние приехало из чужой сборки. */
  hitDice: { remaining: number; total: number; size: number } | undefined;
  /** Подтверждение: единственное действие мастера, меняющее состояние персонажа. */
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
  const isLast = draft.step === "summary";
  const castingTime = castingTimeBadge(row.castingTime.type);
  const actions = draftStore.getState();

  // Замена концентрации требует явного выбора: без него дальше не пускаем. Согласие своё, а не
  // общее с «Применить всё равно»: иначе брошенное заклинание молча разрешало бы и перерасход.
  const concentrationBlocked =
    draft.step === "concentration" &&
    warnings.some((warning) => warning.code === CONCENTRATION_BUSY) &&
    !draft.replaceConcentration;
  const availabilityBlocked = draft.step === "availability" && !draft.allowAnyway;
  // Кости: пока число не выбрано или выпавшее вне возможного, дальше не пускаем. Возможность
  // выпавшего решают правила, и ответ на этот шаг ещё может быть в пути. Костей может не остаться
  // вовсе — тогда выбирать нечего, и шаг не задерживает.
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
      footer={
        isLast
          ? { ...back, primaryLabel: BUTTON_LABELS.confirm, onPrimary: () => onConfirm(draft) }
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
          {/*
 Руна живёт на этом же шаге, а не на своём: её эффект зависит от выбранного уровня
 ячейки, и отдельный экран сделал бы типовое применение трёхшаговым — против
 бюджета в четыре шага, из которых боевое заклинание сегодня тратит два.
 */}
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
      {draft.step === "summary" ? (
        <SummaryStep
          draft={draft}
          row={row}
          preview={preview}
          onRoleplay={(category) => actions.setRoleplayCategory(category)}
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
