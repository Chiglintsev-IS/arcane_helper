/**
 * Краткая карточка — строка боевого списка.
 *
 * Задача строки — ответить на вопрос «что это для меня» без чтения: чем тратится, зачем нужно, кто
 * бросает, сколько урона и кончается ли эффект сразу. Числа подставлены под этого персонажа, а не
 * взяты из книги: 2d8 у заговора — это его уровень, а не общий случай.
 *
 * Три уровня подачи вместо одной россыпи значков:
 * роль — левой линейкой строки: полоса с краю не отнимает у списка ни одной строки;
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
import { ActionRow } from "@/ui/shared/ui/ActionRow";
import { Badge } from "@/ui/shared/ui/Badge";
import { SURFACE_CHOSEN, SURFACE_CONTROL } from "@/ui/shared/ui/surface";

/** Заговор кнопки подготовки не получает: он вне лимита. Цена, а не вид заклинания. */
const CANTRIP_LEVEL = 0;

/** Выделенное среди нейтрального: тем же весом на строке отмечена длительность. */
const STRONG = "font-medium text-ink";

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
  armorClass,
  onOpen,
  onTogglePrepared,
}: {
  spell: SpellRowView;
  /** Числа заклинателя: ими называется бросок. */
  casting: CastingView;
  /** Нынешний Класс Доспеха: с ним сравнивают тот, который заклинание обещает. */
  armorClass: number;
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
  const { active, unavailable, unavailableReason } = spell;
  const castingTime = castingTimeBadge(spell.castingTime.type);
  const ritualOnly = ritualOnlyBadge(spell);
  const resolution = resolutionBadge(spell.resolution, casting);
  const damage = damageLabel(spell.damage);
  const slotCost = slotCostLabel(spell);

  const role = combatRole(spell.role);
  const dimmed = unavailable || active;

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
  ];

  const marks = componentMarks(spell);

  /**
   * Обещанный Класс Доспеха — число, которое называют мастеру вслух, и потому стоит оно в громкой
   * строке, а не среди цены и дальности. Готовым, а не формулой: складывать базу, Ловкость,
   * предметы и два эффекта в чужой ход — ровно та работа, ради избавления от которой приложение и
   * существует.
   */
  const promisedArmorClass = spell.armorClassIfCast;

  // Громкая строка появляется, только когда есть что произнести: пустая заняла бы место молчанием.
  const loud = resolution.spoken || damage !== null || promisedArmorClass !== undefined;

  const preparable = onTogglePrepared !== undefined && spell.level !== CANTRIP_LEVEL;
  const isPrepared = spell.prepared;

  return (
    <ActionRow
      nameRu={spell.nameRu}
      role={role}
      dimmed={dimmed}
      onOpen={onOpen}
      corner={
        marks.length === 0 ? null : (
          <span
            role="img"
            aria-label={`Компоненты: ${marks.map((mark) => mark.wordRu).join(", ")}`}
            className="text-ink-quiet"
          >
            {marks.map((mark) => (
              <span key={mark.letter} className={mark.strong ? STRONG : ""}>
                {mark.letter}
              </span>
            ))}
          </span>
        )
      }
      aside={
        /*
 Подготовка — отдельная кнопка рядом со строкой, а не внутри карточки заклинания:
 собрать одиннадцать заклинаний открытием и закрытием одиннадцати карточек значит превратить
 подготовку после каждого отдыха в упражнение. Заговор кнопки не получает: он вне лимита.
 */
        !preparable ? null : (
          <button
            type="button"
            aria-pressed={isPrepared}
            onClick={onTogglePrepared}
            aria-label={`${isPrepared ? "Снять подготовку" : "Подготовить"}: ${spell.nameRu}`}
            className={`w-11 shrink-0 text-lg ${
              isPrepared
              ? SURFACE_CHOSEN
              : `text-ink-quiet ${SURFACE_CONTROL}`
            }`}
          >
            <span aria-hidden="true">{isPrepared ? "✓" : "+"}</span>
          </button>
        )
      }
    >
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
            <Badge tone="ritual">
              Уже действует
            </Badge>
          ) : null}
          {spell.concentration ? (
            <Badge tone="concentration">
              Концентрация
            </Badge>
          ) : null}
          {/* Броска нет — называть нечего, и строка остаётся значком среди прочих значков. */}
          {resolution.spoken ? null : (
            <Badge tone="muted" icon={resolution.icon}>
              {resolution.label}
            </Badge>
          )}
        </span>

        {/*
         * Громкая строка: то, что игрок назовёт мастеру вслух. Урон стоит здесь, а не среди цены и
         * дальности, по той же причине — его произносят. Ряд нейтральных сведений от этого
         * перестал переноситься на вторую строку, и карточка стала ниже, а не выше.
         */}
        {!loud ? null : (
          <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold tabular-nums">
            {resolution.spoken ? (
              <span className="whitespace-nowrap">
                <span aria-hidden="true" className="text-ink-quiet">
                  {resolution.icon}
                </span>{" "}
                {resolution.label}
              </span>
            ) : null}
            {damage === null ? null : <span className="whitespace-nowrap">Урон {damage}</span>}
            {promisedArmorClass === undefined ? null : (
              <span className="whitespace-nowrap">
                КД {promisedArmorClass} вместо {armorClass}
              </span>
            )}
          </span>
        )}

        {/*
 Нейтральные сведения — текстом через точку: рамка вокруг каждого не добавляла смысла.

 Разделитель своего тона не заводит и берёт тон ряда: тон ряда назван парой — свой у тёмной темы,
 свой у светлой, — а одиночный тон, светлый по тёмной подложке, на белой давал 2.63 при требуемых
 4.5.
 */}
        <span className="flex flex-wrap items-center gap-x-1 text-[0.6875rem] leading-4 text-ink-quiet">
          {facts.map((fact, index) => (
            <Fragment key={fact.text}>
              {index === 0 ? null : <span aria-hidden="true">·</span>}
              <span className={fact.strong ? STRONG : ""}>{fact.text}</span>
            </Fragment>
          ))}
        </span>

        {/* Две строки: список должен оставаться просматриваемым, полный пересказ — в карточке. */}
        <span className="line-clamp-2 text-xs text-ink-soft">
          {spell.shortRulesRu}
        </span>

        {unavailableReason === undefined ? null : (
          <span className="text-xs font-medium text-reaction">Недоступно: {unavailableReason}</span>
        )}
    </ActionRow>
  );
}
