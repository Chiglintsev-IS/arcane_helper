/**
 * Шапка ресурсов экрана боя (FR-001, FR-082, FR-090, FR-144).
 *
 * Отвечает на вопросы, которые возникают чаще всего: что у меня осталось, чем я занят, могу ли я
 * ответить реакцией. Не прокручивается и потому обязана быть плотной: на iPhone SE ключевая механика
 * должна быть видна целиком (ux.md#иерархия-экрана-боя).
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

import { ConcentrationCard } from "@/components/combat/ConcentrationCard";
import type { CastingTimeType } from "@/components/spell/format";
import { Badge } from "@/components/ui/Badge";
import { hitDiceLabel } from "@/rules/hitDice";
import type { ActiveEffect, CharacterState } from "@/data/schemas/character";
import { effectiveArmorClass } from "@/rules/armorClass";
import type { ConcentrationSummary } from "@/rules/concentration";
import { turnTracked, type TurnEconomy } from "@/store/session";

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
 * Плитка хитов — кнопка: урон, лечение и временные хиты правятся отсюда (FR-205). Число, которое
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
 * Подпись вклада эффекта в КД: отвечает на вопрос «почему КД 17, а не 14» (FR-093).
 *
 * Приложение не хранит цель эффекта, поэтому «Доспехи мага» на союзника поднимут КД Торна
 * (OQ-19). Подпись делает это видимым: неверный эффект снимается вручную (FR-091).
 */
function armorClassNote(effect: ActiveEffect, armorClass: number): string {
  return effect.armorClass === undefined ? "" : ` · КД ${armorClass}`;
}

/**
 * Ячейка уровня: остаток и максимум. Минус — долг, разрешённый «Применить всё равно» (FR-031).
 *
 * Плитка — кнопка правки, как и плитка хитов: место, где число видно, и место, где его меняют, —
 * одно и то же (FR-071, FR-142).
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
  concentration,
  bookCastingTimes,
  onOpenHitPoints,
  onEditResources,
  onOpenConcentration,
  onEndEffect,
}: {
  character: CharacterState;
  economy: TurnEconomy;
  concentration: ConcentrationSummary | null;
  /** Виды действий, встречающиеся в книге: чем нечего потратить, того и не показываем (FR-001). */
  bookCastingTimes: ReadonlySet<CastingTimeType>;
  onOpenHitPoints: () => void;
  /** Ручная правка ячеек и рун (FR-071, FR-142, FR-155). */
  onEditResources: () => void;
  onOpenConcentration: () => void;
  onEndEffect: (effectId: string) => void;
}) {
  const slots = Object.entries(character.spellSlots)
    .map(([level, slot]) => ({ level: Number.parseInt(level, 10), ...slot }))
    .sort((left, right) => left.level - right.level);

  const concentrationEffect = character.activeEffects.find((effect) => effect.isConcentration);
  const otherEffects = character.activeEffects.filter((effect) => !effect.isConcentration);
  // Слагаемые состояния не складываются здесь: итог с учётом эффектов считает движок (FR-093).
  const armorClass = effectiveArmorClass(character);
  const inBook = character.screenMode === "book";
  const inJournal = character.screenMode === "journal";
  /**
   * Числа боя — везде, кроме «Книги»: там выбирают состав на день, и КС спасброска, модификатор
   * атаки, КД и остаток хитов на вопрос «чем сегодня платить» не отвечают (FR-217).
   *
   * Тем же доводом в «Книге» скрыта и строка с именем, классом и уровнем персонажа (ниже): игрок
   * назвал её лишней для книги, «чтобы читать её, подготавливать заклинания и применять их вне боя»,
   * а имя на вопрос «чем сегодня платить» отвечает не больше, чем КС или КД.
   */
  const combatNumbers = !inBook;

  return (
    <section aria-label="Ресурсы" className="flex flex-col gap-2">
      {combatNumbers ? (
        <header className="flex items-baseline justify-between gap-2">
          <h1 className="text-lg font-semibold leading-tight">{character.name}</h1>
          {/*
            Счётчик раундов — в бою и в журнале, пока бой идёт (FR-220). Вне боя раундов не идёт, и
            число застыло бы; журнал же открывают посреди боя, и «какой сейчас раунд» — тот же
            вопрос, ради которого туда пришли.
          */}
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {character.className}, {character.level} уровень
            {turnTracked(character) || (inJournal && economy.inFight)
              ? ` · раунд ${economy.round}`
              : ""}
          </p>
        </header>
      ) : null}

      {combatNumbers ? (
        <dl className="grid grid-cols-4 gap-1">
          <Stat label="КС закл." value={`${character.spellSaveDc}`} />
          <Stat label="Атака" value={signed(character.spellAttackModifier)} />
          <Stat label="КД" value={`${armorClass}`} />
          <HitPointsStat
            value={`${character.hitPoints.current}/${character.hitPoints.maximum}`}
            temporary={character.temporaryHitPoints}
            onOpen={onOpenHitPoints}
          />
        </dl>
      ) : null}

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

      {/*
        Ряд прочих ресурсов есть во всех режимах, но в «Книге» он состоит из одного значка — очков
        (FR-217). Очки заклинаний это способ оплаты, а в «Книге» их с недавних пор ещё и покупают
        строкой «Магия крови» (FR-207): вопрос «сколько их стало» там теперь возникает. Руны в книге
        не покупают и отдельно не тратят — их значок остаётся вне её.
      */}
      <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-1 text-xs">
        {/*
          Кости хитов — вне боя: тратятся они коротким отдыхом, а в бою о них нечего решать
          (FR-134). Значок стоит первым, потому что вне боя это главный вопрос — чем лечиться.

          В «Журнале» они тоже видны, хотя открывают его посреди боя: шапка там полная по доводу
          FR-220 — отмена возвращает в том числе потраченную кость, и результат обязан быть виден
          на том же экране, где нажали кнопку.
        */}
        {turnTracked(character) || inBook ? null : (
          <li>
            <Badge tone="muted" icon="✚">
              Кости хитов {hitDiceLabel(character.hitDice)}
            </Badge>
          </li>
        )}
        {/*
          Значок рун — не кнопка: правило 44 пикселей на зону нажатия сделало бы весь ряд значков
          вдвое выше. Правка рун открывается плиткой ячейки — там же, где правятся ячейки (FR-155).
        */}
        {inBook ? null : (
          <li>
            <Badge tone="ritual" icon="❖">
              Руны {character.runes.remaining}/{character.runes.maximum}
            </Badge>
          </li>
        )}
        <li>
          <Badge tone="muted" icon="✚">
            Очки {character.spellPoints.remaining}
          </Badge>
        </li>
        {combatNumbers && character.hitPoints.maximumReduction > 0 ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Максимум снижен на {character.hitPoints.maximumReduction}
            </Badge>
          </li>
        ) : null}
        {combatNumbers && character.suppression.firedUpon ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Особенности подавлены: урон огнём
            </Badge>
          </li>
        ) : null}
        {/*
          Солнце показывается наравне с огнём: подавление одинаковое, а молчал экран только о нём
          (FR-183). Переключается признак в правке ресурсов — значок остаётся значком.
        */}
        {combatNumbers && character.suppression.underDirectSunlight ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Особенности подавлены: солнечный свет
            </Badge>
          </li>
        ) : null}
        {/*
          Экономия хода показывается только в бою: вне боя ходов нет, и `deriveTurnEconomy`
          возвращает «всё доступно» независимо от журнала (FR-143). Три вечно зелёные галочки не
          сообщали бы ничего, кроме неправды (FR-001).

          Подпись на экране короткая, а доступное имя — полное: на iPhone SE места нет, но
          «Действие» без пояснения незрячему пользователю ничего не говорит.
        */}
        {turnTracked(character) ? (
          <>
            <li aria-label={economy.actionAvailable ? "Действие доступно" : "Действие израсходовано"}>
              {economy.actionAvailable ? (
                <Badge tone="action" icon="✓">
                  Действие
                </Badge>
              ) : (
                <Badge tone="muted" icon="✗">
                  Действие израсходовано
                </Badge>
              )}
            </li>
            {/* Бонусного действия нет ни у одной карточки — тратить его не на что (FR-001). */}
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
                    Бонусное израсходовано
                  </Badge>
                )}
              </li>
            ) : null}
            <li
              aria-label={
                economy.reactionAvailable
                  ? "Реакция доступна"
                  : `Реакция израсходована, вернётся ${economy.reactionReturns}`
              }
            >
              {economy.reactionAvailable ? (
                <Badge tone="reaction" icon="✓">
                  Реакция
                </Badge>
              ) : (
                <Badge tone="muted" icon="✗">
                  Реакция израсходована, вернётся {economy.reactionReturns}
                </Badge>
              )}
            </li>
          </>
        ) : null}
      </ul>

      <ConcentrationCard
        summary={concentration}
        armorClassNote={
          concentrationEffect === undefined ? "" : armorClassNote(concentrationEffect, armorClass)
        }
        onOpen={onOpenConcentration}
      />

      {otherEffects.length > 0 ? (
        <ul aria-label="Активные эффекты" className="flex flex-col gap-0.5 text-xs">
          {otherEffects.map((effect) => (
            <li
              key={effect.id}
              className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
            >
              <span>
                <span aria-hidden="true">◈</span> {effect.nameRu}
                {armorClassNote(effect, armorClass)} · {effect.endConditionRu}
                {/*
                  Что придётся делать каждый ход, пока эффект держится (FR-092). Приложение бросок
                  не делает и таймера не ведёт — оно напоминает, что бросок нужен: «Мерцание» без
                  напоминания забывают на втором раунде.
                */}
                {effect.repeatableAction === undefined ? null : (
                  <span
                    className="block text-[0.6875rem] text-action-strong dark:text-action"
                    title={effect.repeatableAction.description}
                  >
                    ↻ {effect.repeatableAction.label}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onEndEffect(effect.id)}
                aria-label={`Завершить: ${effect.nameRu}`}
                className="min-h-11 shrink-0 px-2 text-slate-500"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
