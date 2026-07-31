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
import type { ActiveEffect, CharacterState } from "@/data/schemas/character";
import { effectiveArmorClass } from "@/rules/armorClass";
import type { ConcentrationSummary } from "@/rules/concentration";
import type { TurnEconomy } from "@/store/session";

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
 * Подпись вклада эффекта в КД: отвечает на вопрос «почему КД 17, а не 14» (FR-093).
 *
 * Приложение не хранит цель эффекта, поэтому «Доспехи мага» на союзника поднимут КД Торна
 * (OQ-19). Подпись делает это видимым: неверный эффект снимается вручную (FR-091).
 */
function armorClassNote(effect: ActiveEffect, armorClass: number): string {
  return effect.armorClass === undefined ? "" : ` · КД ${armorClass}`;
}

/** Ячейка уровня: остаток и максимум. Минус — долг, разрешённый «Применить всё равно» (FR-031). */
function SlotCounter({ level, remaining, maximum }: { level: number; remaining: number; maximum: number }) {
  const exhausted = remaining <= 0;
  return (
    <li
      className={`flex-1 rounded-md border px-1 py-1 text-center ${
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
    </li>
  );
}

export function ResourceHeader({
  character,
  economy,
  concentration,
  bookCastingTimes,
  onOpenConcentration,
  onEndEffect,
}: {
  character: CharacterState;
  economy: TurnEconomy;
  concentration: ConcentrationSummary | null;
  /** Виды действий, встречающиеся в книге: чем нечего потратить, того и не показываем (FR-001). */
  bookCastingTimes: ReadonlySet<CastingTimeType>;
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

  return (
    <section aria-label="Ресурсы" className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold leading-tight">{character.name}</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {character.className}, {character.level} уровень · раунд {economy.round}
        </p>
      </header>

      <dl className="grid grid-cols-4 gap-1">
        <Stat label="КС закл." value={`${character.spellSaveDc}`} />
        <Stat label="Атака" value={signed(character.spellAttackModifier)} />
        <Stat label="КД" value={`${armorClass}`} />
        <Stat label="Хиты" value={`${character.hitPoints.current}/${character.hitPoints.maximum}`} />
      </dl>

      <ul aria-label="Ячейки заклинаний" className="flex gap-1">
        {slots.map((slot) => (
          <SlotCounter
            key={slot.level}
            level={slot.level}
            remaining={slot.remaining}
            maximum={slot.maximum}
          />
        ))}
      </ul>

      <ul aria-label="Прочие ресурсы" className="flex flex-wrap items-center gap-1 text-xs">
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
        {character.hitPoints.maximumReduction > 0 ? (
          <li>
            <Badge tone="reaction" icon="✖">
              Максимум снижен на {character.hitPoints.maximumReduction}
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
        {/*
          Экономия хода показывается только когда её ведут. С выключенным учётом
          `deriveTurnEconomy` возвращает «всё доступно» независимо от журнала, и три вечно зелёные
          галочки не сообщали бы ничего, кроме неправды (FR-001).

          Подпись на экране короткая, а доступное имя — полное: на iPhone SE места нет, но
          «Действие» без пояснения незрячему пользователю ничего не говорит.
        */}
        {character.turnTracking.enabled ? (
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
