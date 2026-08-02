/**
 * Краткая карточка — строка боевого списка.
 *
 * Задача строки — ответить на вопрос «что это для меня» без чтения: чем тратится, зачем нужно, кто
 * бросает, сколько урона и кончается ли эффект сразу. Числа подставлены под этого персонажа, а не
 * взяты из книги: 2d8 у заговора — это его уровень, а не общий случай.
 *
 * Три уровня подачи вместо одной россыпи значков:
 * роль — цветом самой карточки: место, которое уже занято рамкой, ничего не стоит списку;
 * срочное — цветными значками: чем тратится ход, какое число называть, держит ли концентрацию;
 * прочее — простым текстом через точку: цена, дальность, длительность, урон читают уже после
 * того, как строку нашли, и рамка вокруг каждого была бы шумом.
 *
 * Причина недоступности пишется словами: серый цвет без объяснения оставляет игрока в тупике
 */

import { Fragment } from "react";

import {
  CASTING_TIME,
  COMBAT_ROLE,
  castingTimePhrase,
  damageLabel,
  durationPhrase,
  ritualOnlyBadge,
  rangeLabel,
  resolutionBadge,
  slotCostLabel,
} from "@/ui/entities/spell/lib/format";
import { Badge } from "@/ui/shared/ui/Badge";
import { Sheet } from "@/core/domain/sheet/sheet";
import type { CharacterState } from "@/core/domain/character/state";
import { CANTRIP_LEVEL, type Spell } from "@/core/domain/catalog/spell";
import { combatRoleOf } from "@/core/domain/catalog/combatRole";

/** Цвет рамки по роли. «Другое» цвета не получает: серое и означает «ни то, ни другое». */
const ROLE_FRAME = {
  offense: "border-offense/60 bg-offense/5",
  defense: "border-defense/60 bg-defense/5",
  other: "border-slate-200 dark:border-slate-800",
} as const;

/**
 * Цвет подписи роли. Тёмные варианты — не украшение: на подкрашенной подложке серый слишком светлый
 * и даёт 4.31 вместо требуемых WCAG 4.5 — это ловит прогон axe-core.
 */
const ROLE_WORD = {
  offense: "text-offense-strong dark:text-offense",
  defense: "text-defense-strong dark:text-defense",
  other: "text-slate-600 dark:text-slate-400",
} as const;

export function SpellCardCompact({
  spell,
  character,
  unavailableReason,
  onOpen,
  onTogglePrepared,
}: {
  spell: Spell;
  character: CharacterState;
  /** Первая причина недоступности или `null`, если применить можно. */
  unavailableReason: string | null;
  onOpen: () => void;
  /**
   * Переключение подготовки. Передаётся только там, где подготовка уместна, — в «Книге»:
   * в бою состав уже определён, и кнопка предлагала бы менять его под чужой ход.
   */
  onTogglePrepared?: (() => void) | undefined;
}) {
  // Карточка одна на все режимы: роль красит рамку и стоит в углу везде, цена называется везде.
  // «Только ритуалом» — единственный значок, который зависит от режима: в бою ритуалом не творят.
  const inBook = character.screenMode === "book";
  // Эффект уже висит — строка перестаёт претендовать на внимание, но из списка не уходит: повторное
  // применение бывает нужно.
  const active = character.activeEffects.some((effect) => effect.spellId === spell.id);
  const castingTime = CASTING_TIME[spell.castingTime.type];
  const ritualOnly = inBook ? ritualOnlyBadge(spell, character.preparedSpellIds) : null;
  const resolution = resolutionBadge(spell.resolution, Sheet.of(character));
  const damage = damageLabel(spell, spell.level, character.level);
  const slotCost = slotCostLabel(spell);

  /**
   * Роль красит рамку, а не занимает отдельный значок. Цвет один ничего не сообщает
   *, поэтому слово стоит там, где вне боя стоит английское название: место уже
   * занято, и подпись достаётся списку бесплатно.
   */
  const role = combatRoleOf(spell);
  const frame = ROLE_FRAME[role];

  /**
   * Нейтральные сведения строки. Длительность выделена контрастом: рядом с ней в значке стоит время
   * накладывания, и два времени на одной строке обязаны отличаться не только словом.
   *
   * Девятого смыслового цвета для неё не заводится: все восемь заняты, и девятый превратил бы шкалу
   * в радугу, в которой не выделяется ничего. Контраст внутри нейтрального
   * такого запрета не нарушает — он не обещает нового смысла.
   */
  const facts: { text: string; strong: boolean }[] = [
    { text: slotCost, strong: false },
    { text: rangeLabel(spell.range), strong: false },
    { text: durationPhrase(spell.duration), strong: true },
    ...(damage === null ? [] : [{ text: `Урон ${damage}`, strong: false }]),
  ];

  const preparable = onTogglePrepared !== undefined && spell.level !== CANTRIP_LEVEL;
  const isPrepared = character.preparedSpellIds.includes(spell.id);

  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onOpen}
        className={`flex flex-1 flex-col items-start gap-1 rounded-lg border p-2 text-left ${frame} ${
          unavailableReason === null && !active ? "" : "opacity-60"
        }`}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="font-medium leading-tight">{spell.nameRu}</span>
          {/*
 Английское название нужно, чтобы найти заклинание в чужой книге, — а в бою по книгам не
 ищут. В «Бою» тот же угол занимает роль, и строка не становится выше.
 */}
          <span className={`shrink-0 text-[0.625rem] ${ROLE_WORD[role]}`}>
            {COMBAT_ROLE[role].label}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <Badge tone={castingTime.tone} icon={castingTime.icon}>
            {castingTimePhrase(spell.castingTime)}
          </Badge>
          {ritualOnly === null ? null : (
            <Badge tone={ritualOnly.tone} icon={ritualOnly.icon}>
              {ritualOnly.label}
            </Badge>
          )}
          {active ? (
            <Badge tone="ritual" icon="✦">
              Уже действует
            </Badge>
          ) : null}
          <Badge tone={resolution.tone} icon={resolution.icon}>
            {resolution.label}
          </Badge>
          {spell.concentration ? (
            <Badge tone="concentration" icon="✦">
              Концентрация
            </Badge>
          ) : null}
        </span>

        {/* Нейтральные сведения — текстом через точку: рамка вокруг каждого не добавляла смысла. */}
        <span className="flex flex-wrap items-center gap-x-1 text-[0.6875rem] leading-4 text-slate-600 dark:text-slate-400">
          {facts.map((fact, index) => (
            <Fragment key={fact.text}>
              {index === 0 ? null : (
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
              )}
              <span className={fact.strong ? "font-medium text-slate-800 dark:text-slate-200" : ""}>
                {fact.text}
              </span>
            </Fragment>
          ))}
        </span>

        {/* Две строки: список должен оставаться просматриваемым, полный пересказ — в карточке. */}
        <span className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
          {spell.shortRulesRu}
        </span>

        {unavailableReason === null ? null : (
          <span className="text-xs font-medium text-reaction-strong dark:text-reaction">Недоступно: {unavailableReason}</span>
        )}
      </button>

      {/*
 Подготовка — отдельная кнопка рядом со строкой, а не внутри карточки заклинания:
 собрать одиннадцать заклинаний открытием и закрытием одиннадцати карточек значит превратить
 подготовку после каждого отдыха в упражнение. Заговор кнопки не получает: он вне лимита.
 */}
      {preparable ? (
        <button
          type="button"
          aria-pressed={isPrepared}
          onClick={onTogglePrepared}
          aria-label={`${isPrepared ? "Снять подготовку" : "Подготовить"}: ${spell.nameRu}`}
          className={`w-11 shrink-0 rounded-lg border text-lg ${
            isPrepared
              ? "border-ritual bg-ritual/10 text-ritual-strong dark:text-ritual"
              : "border-slate-200 text-slate-400 dark:border-slate-800"
          }`}
        >
          <span aria-hidden="true">{isPrepared ? "✓" : "+"}</span>
        </button>
      ) : null}
    </li>
  );
}
