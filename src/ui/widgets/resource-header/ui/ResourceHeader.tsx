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

import { Character } from "@/core/domain/assembly/character";
import type { TurnEconomy } from "@/core/domain/encounter/encounter";
import type { CastingTimeType } from "@/ui/entities/spell/lib/format";
import { Badge } from "@/ui/shared/ui/Badge";
import type { Tone } from "@/ui/shared/ui/tone";
import { hitDiceLabel } from "@/ui/widgets/resource-header/lib/hitDiceLabel";
import { Sheet } from "@/core/domain/sheet/sheet";
import type { CharacterState } from "@/core/domain/assembly/state";
import { Vitality } from "@/core/domain/vitality/vitality";
import { signed } from "@/core/shared/language";
import { slotsInOrder } from "@/core/domain/arcana/slots";

/**
 * Ярлык ресурса хода. Подпись одна и та же в обоих состояниях: израсходованность несут знак и
 * пониженная контрастность, а словами её называет доступное имя, которое ставит вызывающий.
 */
function TurnResource({
  available,
  tone,
  children,
}: {
  available: boolean;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <Badge tone={available ? tone : "muted"} icon={available ? "✓" : "✗"}>
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
        aria-label={`Ячейки ${level} уровня: ${remaining} из ${maximum}. Правка ресурсов`}
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
  character,
  onOpenArmorClass,
  onOpenHitPoints,
  onEditResources,
}: {
  character: CharacterState;
  onOpenArmorClass: () => void;
  onOpenHitPoints: () => void;
  /** Ручная правка ячеек и рун. */
  onEditResources: () => void;
}) {
  const slots = slotsInOrder(character.spellSlots);

  // Слагаемые состояния не складываются здесь: итог с учётом эффектов считает движок.
  const vitality = Vitality.of(character);
  const armorClass = Character.of(character).sheet.value("armorClass");

  return (
    <section aria-label="Ресурсы" className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-1">
        <ArmorClassStat
          value={`${armorClass}`}
          adjustment={Character.of(character).effects.manualAdjustment("armorAdjustment")}
          onOpen={onOpenArmorClass}
        />
        <HitPointsStat
          value={`${vitality.current}/${vitality.maximum}`}
          temporary={character.temporaryHitPoints}
          onOpen={onOpenHitPoints}
        />
      </dl>

      <ul aria-label="Ячейки заклинаний" className="flex gap-1">
        {slots.map((slot) => (
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
  character,
  economy,
  bookCastingTimes,
}: {
  character: CharacterState;
  economy: TurnEconomy;
  /** Виды действий, встречающиеся в книге: чем нечего потратить, того и не показываем. */
  bookCastingTimes: ReadonlySet<CastingTimeType>;
}) {
  const totals = Sheet.of(character);
  const vitality = Vitality.of(character);
  // Игроку важен разрыв с базой листа, а не то, чем он вызван: цифра одна.
  const maximumReduction = vitality.maximumReduction;
  const { inFight } = economy;

  return (
    <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-1 text-xs">
        {/*
         * Постоянная часть ряда идёт первой и одинаково в бою и вне его: кости хитов, пассивное
         * восприятие, руны, очки. Значок, исчезающий с началом боя, сдвинул бы соседей, и глаз
         * искал бы число заново там, где секунду назад стояло другое.
         */}
        <li aria-label={`Кости хитов ${hitDiceLabel(character.hitDice)}`}>
          <Badge tone="muted" icon="✚">
            Кости {hitDiceLabel(character.hitDice)}
          </Badge>
        </li>
        {/*
         * Подпись короткая, доступное имя полное: на 320 пикселях «Пассивное восприятие» забирает
         * целый ряд значков, а ряд здесь стоит четверти карточки списка.
         */}
        <li aria-label={`Пассивное восприятие ${totals.value("passivePerception")}`}>
          <Badge tone="muted" icon="◉">
            Восприятие {totals.value("passivePerception")}
          </Badge>
        </li>
        {/*
         * Значок рун — не кнопка: правило 44 пикселей на зону нажатия сделало бы весь ряд значков
         * вдвое выше. Правка рун открывается плиткой ячейки — там же, где правятся ячейки.
         */}
        <li>
          <Badge tone="ritual" icon="❖">
            Руны {character.runes.remaining}/{character.runes.maximum}
          </Badge>
        </li>
        <li>
          <Badge tone="muted" icon="✚">
            Очки {character.spellPoints.remaining}
          </Badge>
        </li>
        {/*
         * Приходящее с боем встаёт за постоянной частью, ничего не сдвигая: инициатива, затем
         * номер раунда. Вне боя раунда нет вовсе — число застыло бы на последнем.
         */}
        {inFight ? (
          <>
            <li>
              <Badge tone="muted" icon="◔">
                Инициатива {signed(totals.value("initiative"))}
              </Badge>
            </li>
            <li>
              <Badge tone="action" icon="◷">
                Раунд {economy.round}
              </Badge>
            </li>
          </>
        ) : null}
        {maximumReduction > 0 ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Максимум снижен на {maximumReduction}
            </Badge>
          </li>
        ) : null}
        {/*
         * Ступень названа числом и словом, а не одним цветом. Отсутствующего в ряду нет вовсе:
         * «Истощение 0» занимало бы место сообщением о том, чего не происходит.
         */}
        {character.exhaustion > 0 ? (
          <li aria-label={`Истощение: ступень ${character.exhaustion}`}>
            <Badge tone="reaction" icon="✖">
              Истощение {character.exhaustion}
            </Badge>
          </li>
        ) : null}
        {character.inspiration ? (
          <li aria-label="Вдохновение">
            <Badge tone="action" icon="✦">
              Вдохновение
            </Badge>
          </li>
        ) : null}
        {character.suppression.firedUpon ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Особенности подавлены: урон огнём
            </Badge>
          </li>
        ) : null}
        {character.suppression.underDirectSunlight ? (
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
            <li aria-label={economy.actionAvailable ? "Действие доступно" : "Действие израсходовано"}>
              <TurnResource available={economy.actionAvailable} tone="action">
                Действие
              </TurnResource>
            </li>
            {/* Бонусного действия нет ни у одной карточки — тратить его не на что. */}
            {bookCastingTimes.has("bonus_action") ? (
              <li
                aria-label={
                  economy.bonusActionAvailable
                    ? "Бонусное действие доступно"
                    : "Бонусное действие израсходовано"
                }
              >
                <TurnResource available={economy.bonusActionAvailable} tone="bonus">
                  Бонусное
                </TurnResource>
              </li>
            ) : null}
            <li aria-label={economy.reactionAvailable ? "Реакция доступна" : "Реакция израсходована"}>
              <TurnResource available={economy.reactionAvailable} tone="reaction">
                Реакция
              </TurnResource>
            </li>
          </>
        ) : null}
    </ul>
  );
}
