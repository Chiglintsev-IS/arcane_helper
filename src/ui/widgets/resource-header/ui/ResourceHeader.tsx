/**
 * Шапка ресурсов: чем платить и сколько осталось.
 *
 * Стоит там, где тратят и восстанавливают, — в «Игре». Хиты и ячейки закреплены и остаются на месте
 * при прокрутке: на них смотрят в каждый ход. Прочие значки уезжают вместе со списком — иначе
 * каждый новый значок отодвигал бы первую карточку за край экрана. Имени, класса и уровня в шапке
 * нет: за столом их не спрашивают, а место они занимают постоянно — их дом «Лист».
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

import type { ResourcesView, SheetView, TurnView } from "@/contract/views";

import { DERIVED_LABELS, skillLabel } from "@/ui/entities/character/lib/labels";
import { RESOURCES_EDIT_LABEL } from "@/ui/features/edit-resources/ui/ResourcesSheet";
import { Badge } from "@/ui/shared/ui/Badge";
import type { Tone } from "@/ui/shared/ui/tone";
import { hitDiceLabel } from "@/ui/widgets/resource-header/lib/hitDiceLabel";
import { signed } from "@/shared/language";

/**
 * Ярлык того, чем платят: ресурса хода и пула с остатком.
 *
 * Подпись одна и та же в обоих состояниях: израсходованность несут знак и пониженная контрастность,
 * а словами её называет доступное имя, которое ставит вызывающий. Цвет отвечает на вопрос «есть ли
 * ещё»: постоянный отвечал бы «да» и при нуле, и пустой пул был бы неотличим от полного.
 */
function SpendableResource({
  available,
  tone,
  icon,
  children,
}: {
  available: boolean;
  tone: Tone;
  /** Знак ресурса, пока им есть чем платить: кончившийся носит знак отказа. */
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Badge tone={available ? tone : "muted"} icon={available ? icon : "✗"}>
      {children}
    </Badge>
  );
}

/**
 * Плитка КД — кнопка, как и плитка хитов: временная поправка правится там же, где она видна.
 */
function ArmorClassStat({
  value,
  adjustment,
  onOpen,
}: {
  value: string;
  adjustment: number;
  onOpen: () => void;
}) {
  // Обёртка `div` обязательна: `button` не может быть прямым потомком `dl` (axe: only-dlitems).
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800">
      <dt className="sr-only">КД</dt>
      <dd>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`КД ${value}. Правка: поправка`}
          className="w-full px-2 py-1 text-left"
        >
          <span className="block text-[0.625rem] leading-tight text-slate-600 dark:text-slate-400">
            КД{adjustment !== 0 ? ` ${signed(adjustment)}` : ""}
          </span>
          <span className="block text-base font-semibold leading-tight tabular-nums">{value}</span>
        </button>
      </dd>
    </div>
  );
}

/**
 * Плитка хитов — кнопка: урон, лечение и временные хиты правятся отсюда. Число, которое
 * чаще всего меняется, и место, где его меняют, — одно и то же.
 */
function HitPointsStat({
  value,
  temporary,
  onOpen,
}: {
  value: string;
  temporary: number;
  onOpen: () => void;
}) {
  // Обёртка `div` обязательна: `button` не может быть прямым потомком `dl` (axe: only-dlitems).
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800">
      <dt className="sr-only">Хиты</dt>
      <dd>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Хиты ${value}. Правка: урон, лечение, временные`}
          className="w-full px-2 py-1 text-left"
        >
          <span className="block text-[0.625rem] leading-tight text-slate-600 dark:text-slate-400">
            Хиты{temporary > 0 ? ` +${temporary}` : ""}
          </span>
          <span className="block text-base font-semibold leading-tight tabular-nums">{value}</span>
        </button>
      </dd>
    </div>
  );
}

/**
 * Ячейка уровня: остаток и максимум. Минус — долг, разрешённый «Применить всё равно».
 *
 * Плитка — кнопка правки, как и плитка хитов: место, где число видно, и место, где его меняют, —
 * одно и то же.
 */
function SlotCounter({
  level,
  remaining,
  maximum,
  onEdit,
}: {
  level: number;
  remaining: number;
  maximum: number;
  onEdit: () => void;
}) {
  const exhausted = remaining <= 0;
  return (
    <li className="flex-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Ячейки ${level} уровня: ${remaining} из ${maximum}. ${RESOURCES_EDIT_LABEL}`}
        className={`w-full rounded-md border px-1 py-1 text-center ${
          exhausted
            ? "border-slate-200 text-slate-500 dark:border-slate-800"
            : "border-action/40 bg-action/5"
        }`}
      >
        <span className="block text-[0.625rem] leading-tight text-slate-600 dark:text-slate-400">
          {level} ур.
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {remaining}/{maximum}
        </span>
      </button>
    </li>
  );
}

/**
 * Закреплённая часть: КД, хиты и ячейки по уровням.
 *
 * Экономии хода она не знает намеренно — то, что остаётся на месте при прокрутке, не должно
 * перестраиваться от начала боя.
 */
export function ResourceHeader({
  sheet,
  resources,
  onOpenArmorClass,
  onOpenHitPoints,
  onEditResources,
}: {
  /** Хиты и защита приезжают листом: то же число, что на «Листе», а не второй его счёт. */
  sheet: SheetView;
  resources: ResourcesView;
  onOpenArmorClass: () => void;
  onOpenHitPoints: () => void;
  /** Ручная правка ячеек и рун. */
  onEditResources: () => void;
}) {
  const { hitPoints } = sheet;

  return (
    <section aria-label="Ресурсы" className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-1">
        <ArmorClassStat
          value={`${sheet.armorClass}`}
          adjustment={resources.armorClassAdjustment}
          onOpen={onOpenArmorClass}
        />
        <HitPointsStat
          value={`${hitPoints.current}/${hitPoints.maximum}`}
          temporary={hitPoints.temporary}
          onOpen={onOpenHitPoints}
        />
      </dl>

      <ul aria-label="Ячейки заклинаний" className="flex gap-1">
        {resources.slots.map((slot) => (
          <SlotCounter
            key={slot.level}
            level={slot.level}
            remaining={slot.remaining}
            maximum={slot.maximum}
            onEdit={onEditResources}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * Прочие значки: чем ещё располагают и что мешает. Уезжают вместе со списком — их число растёт от
 * ситуации, и закрепить их значило бы отдать прокрутке первую карточку.
 */
export function ResourceBadges({
  sheet,
  resources,
  turn,
  bookCastingTimes,
}: {
  sheet: SheetView;
  resources: ResourcesView;
  turn: TurnView;
  /** Виды действий, встречающиеся в книге: чем нечего потратить, того и не показываем. */
  bookCastingTimes: ReadonlySet<string>;
}) {
  const { hitPoints } = sheet;
  const { inFight } = turn;
  const { hitDice } = hitPoints;
  const diceLeft = hitDice !== undefined && hitDice.remaining > 0;

  return (
    <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-1 text-xs">
        {/*
         * Постоянная часть ряда идёт первой и одинаково в бою и вне его: кости хитов, пассивная
         * внимательность, руны, очки. Значок, исчезающий с началом боя, сдвинул бы соседей, и глаз
         * искал бы число заново там, где секунду назад стояло другое.
         */}
        <li aria-label={`Кости хитов ${hitDiceLabel(hitPoints.hitDice)}`}>
          <SpendableResource available={diceLeft} tone="muted" icon="✚">
            Кости {hitDiceLabel(hitPoints.hitDice)}
          </SpendableResource>
        </li>
        {/*
         * Подпись короткая, доступное имя полное: на 320 пикселях полное имя забирает целый ряд
         * значков, а ряд здесь стоит четверти карточки списка. Оба слова приходят от владельца
         * подписей: величина выведена из навыка и зовётся его именем.
         */}
        <li aria-label={`${DERIVED_LABELS.passivePerception} ${resources.passivePerception}`}>
          <Badge tone="muted" icon="◉">
            {skillLabel("perception")} {resources.passivePerception}
          </Badge>
        </li>
        {/*
         * Значок рун — не кнопка: правило 44 пикселей на зону нажатия сделало бы весь ряд значков
         * вдвое выше. Правка рун открывается плиткой ячейки — там же, где правятся ячейки.
         */}
        <li>
          <SpendableResource available={resources.runes.remaining > 0} tone="ritual" icon="❖">
            Руны {resources.runes.remaining}/{resources.runes.maximum}
          </SpendableResource>
        </li>
        <li>
          <SpendableResource available={resources.spellPoints > 0} tone="muted" icon="✚">
            Очки {resources.spellPoints}
          </SpendableResource>
        </li>
        {/*
         * Приходящее с боем встаёт за постоянной частью, ничего не сдвигая: инициатива, затем
         * номер раунда. Вне боя раунда нет вовсе — число застыло бы на последнем.
         */}
        {inFight ? (
          <>
            <li>
              <Badge tone="muted" icon="◔">
                Инициатива {signed(resources.initiative)}
              </Badge>
            </li>
            <li>
              <Badge tone="action" icon="◷">
                Раунд {turn.round}
              </Badge>
            </li>
          </>
        ) : null}
        {hitPoints.maximumReduction > 0 ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Максимум снижен на {hitPoints.maximumReduction}
            </Badge>
          </li>
        ) : null}
        {/*
         * Ступень названа числом и словом, а не одним цветом. Отсутствующего в ряду нет вовсе:
         * «Истощение 0» занимало бы место сообщением о том, чего не происходит.
         */}
        {sheet.exhaustion > 0 ? (
          <li aria-label={`Истощение: ступень ${sheet.exhaustion}`}>
            <Badge tone="reaction" icon="✖">
              Истощение {sheet.exhaustion}
            </Badge>
          </li>
        ) : null}
        {sheet.inspiration ? (
          <li aria-label="Вдохновение">
            <Badge tone="action" icon="✦">
              Вдохновение
            </Badge>
          </li>
        ) : null}
        {resources.suppression.firedUpon ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Особенности подавлены: урон огнём
            </Badge>
          </li>
        ) : null}
        {resources.suppression.underDirectSunlight ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Особенности подавлены: солнечный свет
            </Badge>
          </li>
        ) : null}
        {/*
         * Экономия хода показывается только в бою: вне боя ходов нет, и правила отвечают «всё
         * доступно» независимо от журнала. Три вечно зелёные галочки не сообщали бы ничего.
         *
         * Подпись на экране короткая, а доступное имя — полное: на iPhone SE места нет, но
         * «Действие» без пояснения незрячему пользователю ничего не говорит.
         */}
        {inFight ? (
          <>
            <li aria-label={turn.actionAvailable ? "Действие доступно" : "Действие израсходовано"}>
              <SpendableResource available={turn.actionAvailable} tone="action" icon="✓">
                Действие
              </SpendableResource>
            </li>
            {/* Бонусного действия нет ни у одной карточки — тратить его не на что. */}
            {bookCastingTimes.has("bonus_action") ? (
              <li
                aria-label={
                  turn.bonusActionAvailable
                    ? "Бонусное действие доступно"
                    : "Бонусное действие израсходовано"
                }
              >
                <SpendableResource available={turn.bonusActionAvailable} tone="bonus" icon="✓">
                  Бонусное
                </SpendableResource>
              </li>
            ) : null}
            <li aria-label={turn.reactionAvailable ? "Реакция доступна" : "Реакция израсходована"}>
              <SpendableResource available={turn.reactionAvailable} tone="reaction" icon="✓">
                Реакция
              </SpendableResource>
            </li>
          </>
        ) : null}
    </ul>
  );
}
