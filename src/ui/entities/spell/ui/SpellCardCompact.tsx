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
 * Компоненты стоят буквами в углу имени: свой ряд стоил бы списку экрана прокрутки, а ряд фактов у
 * половины строк уже перенесён.
 *
 * Причина недоступности пишется словами: серый цвет без объяснения оставляет игрока в тупике
 */

import { Fragment } from "react";

import type { CastingView, SpellRowView } from "@/contract/views";
import {
  castingTimeBadge,
  castingTimePhrase,
  combatRole,
  damageLabel,
  durationPhrase,
  ritualOnlyBadge,
  slotCostLabel,
} from "@/ui/entities/spell/lib/format";
import { rangePhrase, resolutionBadge } from "@/ui/shared/lib/spellLabels";
import { Badge } from "@/ui/shared/ui/Badge";

/** Заговор кнопки подготовки не получает: он вне лимита. Цена, а не вид заклинания. */
const CANTRIP_LEVEL = 0;

/** Цвет рамки по роли. «Другое» цвета не получает: серое и означает «ни то, ни другое». */
const ROLE_BORDER: Record<string, string> = {
  offense: "border-offense/60",
  defense: "border-defense/60",
  other: "border-slate-200 dark:border-slate-800",
};

/** Подложка по роли — отдельно от рамки: приглушённая строка меняет её, не трогая рамку. */
const ROLE_BACKGROUND: Record<string, string> = {
  offense: "bg-offense/5",
  defense: "bg-defense/5",
  other: "",
};

/**
 * Подложка приглушённой строки.
 *
 * Прозрачностью строку гасить нельзя: она гасит и текст, и значки вместе с ним — контраст падает до
 * 2.8 при требуемых 4.5, и это ловит прогон axe. Приглушение живёт в подложке, а причина, по которой
 * строка приглушена, написана на ней словами.
 */
const DIMMED_BACKGROUND = "bg-slate-100 dark:bg-slate-900";

/**
 * Цвет подписи роли. Тёмные варианты — не украшение: на подкрашенной подложке серый слишком светлый
 * и даёт 4.31 вместо требуемых WCAG 4.5 — это ловит прогон axe-core.
 */
const ROLE_WORD: Record<string, string> = {
  offense: "text-offense-strong dark:text-offense",
  defense: "text-defense-strong dark:text-defense",
  other: "text-slate-600 dark:text-slate-400",
};

/** Оформление по слову правил: незнакомая роль выглядит как «ни то, ни другое». */
function roleClass(classes: Record<string, string>, role: string): string {
  return classes[role] ?? classes.other ?? "";
}

/** Выделенное среди нейтрального: тем же весом на строке отмечена длительность. */
const STRONG = "font-medium text-slate-800 dark:text-slate-200";

type ComponentMark = { letter: string; wordRu: string; strong: boolean };

/**
 * Компоненты буквами: по букве на требуемое и слово к ней для тех, кто строку слушает.
 *
 * Не требуемое буквы не получает вовсе. Погасить лишнюю букву цветом вышло бы ровнее, но тогда
 * единственным носителем смысла остался бы цвет, а за столом при свече он не носитель.
 *
 * Материал, которого фокусировка не заменяет, выделен весом: своя вещь кончается, и узнать об этом
 * лучше до чужого хода. Девятого смыслового цвета для него не заводится — контраст внутри
 * нейтрального нового смысла не обещает.
 */
function componentMarks(spell: SpellRowView): ComponentMark[] {
  const { verbal, somatic, material } = spell.card.components;
  const marks: ComponentMark[] = [];

  if (verbal) marks.push({ letter: "В", wordRu: "голос", strong: false });
  if (somatic) marks.push({ letter: "С", wordRu: "жест", strong: false });
  if (material !== undefined) {
    marks.push(
      spell.ownComponentRequired
        ? { letter: "М", wordRu: "свой предмет", strong: true }
        : { letter: "М", wordRu: "материал", strong: false },
    );
  }

  return marks;
}

export function SpellCardCompact({
  spell,
  casting,
  onOpen,
  onTogglePrepared,
}: {
  spell: SpellRowView;
  /** Числа заклинателя: ими называется бросок. */
  casting: CastingView;
  onOpen: () => void;
  /**
   * Переключение подготовки. Передаётся только там, где подготовка уместна, — в «Книге»:
   * в бою состав уже определён, и кнопка предлагала бы менять его под чужой ход.
   */
  onTogglePrepared?: (() => void) | undefined;
}) {
  // Карточка одна на все режимы: роль красит рамку и стоит в углу везде, цена называется везде.
  // Эффект уже висит — строка перестаёт претендовать на внимание, но из списка не уходит: повторное
  // применение бывает нужно.
  const { active, unavailableReason } = spell;
  const castingTime = castingTimeBadge(spell.castingTime.type);
  const ritualOnly = ritualOnlyBadge(spell);
  const resolution = resolutionBadge(spell.resolution, casting);
  const damage = damageLabel(spell.damage);
  const slotCost = slotCostLabel(spell);

  /**
   * Роль красит рамку, а не занимает отдельный значок. Цвет один ничего не сообщает
   *, поэтому слово стоит там, где вне боя стоит английское название: место уже
   * занято, и подпись достаётся списку бесплатно.
   */
  const role = combatRole(spell.role);
  const dimmed = unavailableReason !== undefined || active;
  const frame = `${roleClass(ROLE_BORDER, spell.role)} ${dimmed ? DIMMED_BACKGROUND : roleClass(ROLE_BACKGROUND, spell.role)}`;

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
    { text: rangePhrase(spell.range), strong: false },
    { text: durationPhrase(spell.duration), strong: true },
    ...(damage === null ? [] : [{ text: `Урон ${damage}`, strong: false }]),
  ];

  const marks = componentMarks(spell);

  const preparable = onTogglePrepared !== undefined && spell.level !== CANTRIP_LEVEL;
  const isPrepared = spell.prepared;

  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onOpen}
        className={`flex flex-1 flex-col items-start gap-1 rounded-lg border p-2 text-left ${frame}`}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="font-medium leading-tight">{spell.nameRu}</span>
          <span className="flex shrink-0 items-baseline gap-1.5 text-[0.625rem]">
            {marks.length === 0 ? null : (
              <span
                role="img"
                aria-label={`Компоненты: ${marks.map((mark) => mark.wordRu).join(", ")}`}
                className="text-slate-600 dark:text-slate-400"
              >
                {marks.map((mark) => (
                  <span key={mark.letter} className={mark.strong ? STRONG : ""}>
                    {mark.letter}
                  </span>
                ))}
              </span>
            )}
            {/*
 Английское название нужно, чтобы найти заклинание в чужой книге, — а в бою по книгам не
 ищут. В «Бою» тот же угол занимает роль, и строка не становится выше.
 */}
            <span className={roleClass(ROLE_WORD, spell.role)}>{role.label}</span>
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
          <Badge tone="muted" icon={resolution.icon}>
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
              <span className={fact.strong ? STRONG : ""}>{fact.text}</span>
            </Fragment>
          ))}
        </span>

        {/* Две строки: список должен оставаться просматриваемым, полный пересказ — в карточке. */}
        <span className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
          {spell.shortRulesRu}
        </span>

        {unavailableReason === undefined ? null : (
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
