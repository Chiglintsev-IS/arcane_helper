/**
 * Шапка ресурсов: чем платить и сколько осталось.
 *
 * Стоит там, где тратят и восстанавливают, — в «Бою» и «Вне боя». Не прокручивается и потому обязана
 * быть плотной: на iPhone SE ключевая механика должна быть видна целиком.
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

import { turnTracked, type TurnEconomy } from "@/core/application/useCases/turn";
import type { CastingTimeType } from "@/ui/entities/spell/lib/format";
import { Badge } from "@/ui/shared/ui/Badge";
import { hitDiceLabel } from "@/ui/widgets/resource-header/lib/hitDiceLabel";
import { Sheet } from "@/core/domain/sheet/sheet";
import type { CharacterState } from "@/core/domain/character/state";
import { effectiveArmorClass } from "@/core/domain/effects/armorClass";
import { Vitality } from "@/core/domain/vitality/vitality";

function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-800">
      <dt className="text-[0.625rem] leading-tight text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-base font-semibold leading-tight tabular-nums">{value}</dd>
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

export function ResourceHeader({
  character,
  economy,
  bookCastingTimes,
  onOpenHitPoints,
  onEditResources,
}: {
  character: CharacterState;
  economy: TurnEconomy;
  /** Виды действий, встречающиеся в книге: чем нечего потратить, того и не показываем. */
  bookCastingTimes: ReadonlySet<CastingTimeType>;
  onOpenHitPoints: () => void;
  /** Ручная правка ячеек и рун. */
  onEditResources: () => void;
}) {
  const slots = Object.entries(character.spellSlots)
    .map(([level, slot]) => ({ level: Number.parseInt(level, 10), ...slot }))
    .sort((left, right) => left.level - right.level);

  // Слагаемые состояния не складываются здесь: итог с учётом эффектов считает движок.
  const totals = Sheet.of(character);
  const vitality = Vitality.of(character);
  // Игроку важен разрыв с базой листа, а не то, чем он вызван: цифра одна.
  const maximumReduction = vitality.bloodReduction + vitality.masterReduction;
  const armorClass = effectiveArmorClass(character);
  const inFight = turnTracked(character);

  return (
    <section aria-label="Ресурсы" className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold leading-tight">{character.name}</h1>
        {/* Номер раунда — только там, где раунды идут: вне боя число застыло бы. */}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {character.className}, {character.level} уровень
          {inFight ? ` · раунд ${economy.round}` : ""}
        </p>
      </header>

      <dl className="grid grid-cols-4 gap-1">
        <Stat label="КС закл." value={`${totals.spellSaveDc}`} />
        <Stat label="Атака" value={signed(totals.spellAttackModifier)} />
        <Stat label="КД" value={`${armorClass}`} />
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

      <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-1 text-xs">
        {/*
         * Кости хитов — вне боя: тратятся они коротким отдыхом, а в бою о них нечего решать. Значок
         * стоит первым, потому что вне боя это главный вопрос — чем лечиться.
         */}
        {inFight ? null : (
          <li>
            <Badge tone="muted" icon="✚">
              Кости хитов {hitDiceLabel(character.hitDice)}
            </Badge>
          </li>
        )}
        {/*
         * Инициатива — в бою, пассивное восприятие — вне его: первое бросают в начале схватки,
         * второе спрашивают в разведке. Каждое число стоит там, где его называют.
         */}
        {inFight ? (
          <li>
            <Badge tone="muted" icon="◔">
              Инициатива {signed(totals.initiative)}
            </Badge>
          </li>
        ) : (
          <li>
            <Badge tone="muted" icon="◉">
              Пассивное восприятие {totals.passivePerception}
            </Badge>
          </li>
        )}
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
              {economy.actionAvailable ? (
                <Badge tone="action" icon="✓">
                  Действие
                </Badge>
              ) : (
                <Badge tone="muted" icon="✗">
                  Действие
                </Badge>
              )}
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
                {economy.bonusActionAvailable ? (
                  <Badge tone="bonus" icon="✓">
                    Бонусное
                  </Badge>
                ) : (
                  <Badge tone="muted" icon="✗">
                    Бонусное
                  </Badge>
                )}
              </li>
            ) : null}
            <li
              aria-label={
                economy.reactionAvailable
                  ? "Реакция доступна"
                  : `Реакция израсходована`
              }
            >
              {economy.reactionAvailable ? (
                <Badge tone="reaction" icon="✓">
                  Реакция
                </Badge>
              ) : (
                <Badge tone="muted" icon="✗">
                  Реакция
                </Badge>
              )}
            </li>
          </>
        ) : null}
      </ul>
    </section>
  );
}
