/**
 * Шапка ресурсов экрана боя (FR-001, FR-082, FR-090, FR-144).
 *
 * Отвечает на вопросы, которые возникают чаще всего: что у меня осталось, чем я занят, могу ли я
 * ответить реакцией. Не прокручивается и потому обязана быть плотной: на iPhone SE ключевая механика
 * должна быть видна целиком (ux.md#иерархия-экрана-боя).
 *
 * Компонент презентационный: состояние приходит параметрами, действия — из экрана.
 */

import { Badge } from "@/components/ui/Badge";
import type { CharacterState } from "@/data/schemas/character";
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
}: {
  character: CharacterState;
  economy: TurnEconomy;
}) {
  const slots = Object.entries(character.spellSlots)
    .map(([level, slot]) => ({ level: Number.parseInt(level, 10), ...slot }))
    .sort((left, right) => left.level - right.level);

  const concentrationEffect = character.activeEffects.find((effect) => effect.isConcentration);
  const otherEffects = character.activeEffects.filter((effect) => !effect.isConcentration);
  const armorClass =
    character.armorClass.base + character.armorClass.dexterityModifier + character.armorClass.itemBonus;

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
        {/*
          Подпись на экране короткая, а доступное имя — полное: на iPhone SE места нет, но
          «Действие» без пояснения незрячему пользователю ничего не говорит.
        */}
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
      </ul>

      <section aria-label="Концентрация" className="text-xs">
        {concentrationEffect === undefined ? (
          <p className="text-slate-600 dark:text-slate-400">
            <span aria-hidden="true">✦</span> Концентрации нет
          </p>
        ) : (
          <p className="text-concentration-strong dark:text-concentration">
            <span aria-hidden="true">✦</span> Концентрация: «{concentrationEffect.nameRu}» ·{" "}
            {concentrationEffect.endConditionRu}
          </p>
        )}
      </section>

      {otherEffects.length > 0 ? (
        <ul aria-label="Активные эффекты" className="flex flex-col gap-0.5 text-xs">
          {otherEffects.map((effect) => (
            <li key={effect.id} className="text-slate-700 dark:text-slate-300">
              <span aria-hidden="true">◈</span> {effect.nameRu} · {effect.endConditionRu}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
