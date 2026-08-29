/**
 * Краткая карточка — строка боевого списка.
 *
 * Задача строки — ответить на вопрос «что это для меня» без чтения: чем тратится, во что обойдётся,
 * сколько держится, куда целить, что случится и кто бросает. Числа подставлены под этого
 * персонажа: 2d8 у заговора — это его уровень, КС 16 и d20+8 — его листа.
 *
 * У каждого свойства своё место и свой канал, а не чип среди чипов: тип каста — единственный
 * сильный цвет строки; цена — серым за ним; срок — правым краем той же строки; роль — линейкой с
 * края; бросок — янтарём; исходы — подписанными строками. Рамок вокруг фактов нет: рамка вокруг
 * каждого была шумом, в котором не выделялось ничего.
 *
 * Причина недоступности пишется словами: серый цвет без объяснения оставляет игрока в тупике.
 */

import type { CastingView, SpellRowView } from "@/contract/views";
import {
  castCostPhrase,
  castTypePhrase,
  castingTimeBadge,
  combatRole,
  componentLetters,
  holdsPhrase,
  rollPhrase,
} from "@/ui/entities/spell/lib/format";
import { ActionRow } from "@/ui/shared/ui/ActionRow";
import { SURFACE_CHOSEN, SURFACE_CONTROL } from "@/ui/shared/ui/surface";
import { TONE_GLYPH, TONE_TEXT } from "@/ui/shared/ui/tone";

/** Заговор кнопки подготовки не получает: он вне лимита. Цена, а не вид заклинания. */
const CANTRIP_LEVEL = 0;

/** Громкое: то, что произносят вслух и что случится. */
const LOUD = "text-sm font-bold leading-snug text-ink";

/** Метки исходов — тем же способом, что и подписи разделов: моно, разрядка, приглушённо. */
const OUTCOME_LABELS = { hit: "ПОПАЛ", fail: "ПРОВАЛ", success: "УСПЕХ" } as const;

function Outcome({ label, lines, loud }: { label: string; lines: readonly string[]; loud: boolean }) {
  return (
    <span className="grid grid-cols-[3.25rem_1fr] items-baseline gap-2">
      <span className="text-right font-mono text-[0.5625rem] tracking-[0.1em] text-ink-quiet">
        {label}
      </span>
      <span className="flex flex-col gap-0.5">
        {lines.map((line) => (
          <span
            key={line}
            className={loud ? "text-[0.84375rem] font-semibold leading-snug text-ink" : "text-[0.84375rem] leading-snug text-ink-quiet"}
          >
            {line}
          </span>
        ))}
      </span>
    </span>
  );
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
  const { active, unavailable, unavailableReason, listCard } = spell;
  const castingTime = castingTimeBadge(spell.castingTime.type);
  const holds = holdsPhrase(spell);
  const roll = rollPhrase(spell, casting);
  const letters = componentLetters(spell);
  const role = combatRole(spell.role);
  const dimmed = unavailable || active;

  /**
   * Обещанный Класс Доспеха — число, которое называют мастеру вслух: готовым, а не формулой.
   * Складывать базу, Ловкость, предметы и два эффекта в чужой ход — ровно та работа, ради
   * избавления от которой приложение и существует.
   */
  const effectLines = [
    ...(spell.armorClassIfCast === undefined ? [] : [`КД ${spell.armorClassIfCast} вместо ${armorClass}`]),
    ...(listCard?.effectLinesRu ?? []),
  ];

  const preparable = onTogglePrepared !== undefined && spell.level !== CANTRIP_LEVEL;
  const isPrepared = spell.prepared;

  return (
    <ActionRow
      nameRu={spell.nameRu}
      role={role}
      dimmed={dimmed}
      onOpen={onOpen}
      corner={letters === "" ? null : <span aria-label={`Компоненты: ${letters}`}>{letters}</span>}
      aside={
        /*
         * Подготовка — отдельная кнопка рядом со строкой, а не внутри карточки заклинания:
         * собрать одиннадцать заклинаний открытием и закрытием одиннадцати карточек значит превратить
         * подготовку после каждого отдыха в упражнение. Заговор кнопки не получает: он вне лимита.
         */
        !preparable ? null : (
          <button
            type="button"
            aria-pressed={isPrepared}
            onClick={onTogglePrepared}
            aria-label={`${isPrepared ? "Снять подготовку" : "Подготовить"}: ${spell.nameRu}`}
            className={`w-11 shrink-0 text-lg ${
              isPrepared ? SURFACE_CHOSEN : `text-ink-quiet ${SURFACE_CONTROL}`
            }`}
          >
            <span aria-hidden="true">{isPrepared ? "✓" : "+"}</span>
          </button>
        )
      }
    >
      {/* Строка каста: тип цветом, цена серым, срок правым краем. Левая часть не переносится. */}
      <span className="flex w-full items-baseline justify-between gap-3 text-[0.84375rem]">
        <span className="whitespace-nowrap">
          <span className={`font-semibold ${TONE_TEXT[castingTime.tone]}`}>
            <span aria-hidden="true">{castingTime.icon}</span> {castTypePhrase(spell.castingTime)}
          </span>
          <span className="text-ink-quiet"> · {castCostPhrase(spell)}</span>
        </span>
        {holds === null ? null : (
          <span
            className={`shrink-0 font-semibold ${holds.tone === null ? "text-ink-soft" : TONE_TEXT[holds.tone]}`}
          >
            {holds.text}
          </span>
        )}
      </span>

      {/* Триггер — вплотную к реакции и в её цвете: «когда …». */}
      {spell.card.reaction === undefined ? null : (
        <span className={`-mt-1 text-[0.8125rem] leading-snug ${TONE_TEXT[castingTime.tone]}`}>
          когда {spell.card.reaction.textRu}
        </span>
      )}

      {listCard === undefined ? null : (
        <span className="text-[0.78125rem] text-ink-quiet">{listCard.whereRu}</span>
      )}

      {effectLines.length === 0 ? null : (
        <span className="flex flex-col gap-0.5">
          {effectLines.map((line) => (
            <span key={line} className={LOUD}>
              {line}
            </span>
          ))}
        </span>
      )}

      {roll === null ? null : (
        <span className="flex flex-col gap-1">
          <span className={`text-[0.8125rem] font-semibold leading-snug ${TONE_TEXT.roll}`}>
            <span aria-hidden="true">{TONE_GLYPH.roll}</span> {roll}
          </span>
          {listCard?.rollNoteRu === undefined ? null : (
            <span className={`-mt-0.5 text-[0.78125rem] leading-snug ${TONE_TEXT.roll}`}>
              {listCard.rollNoteRu}
            </span>
          )}
          {listCard?.hitLinesRu === undefined ? null : (
            <Outcome label={OUTCOME_LABELS.hit} lines={listCard.hitLinesRu} loud />
          )}
          {listCard?.failLinesRu === undefined ? null : (
            <Outcome label={OUTCOME_LABELS.fail} lines={listCard.failLinesRu} loud />
          )}
          {listCard?.successLinesRu === undefined ? null : (
            <Outcome label={OUTCOME_LABELS.success} lines={listCard.successLinesRu} loud={false} />
          )}
        </span>
      )}

      {/* Без готовых фраз строка отвечает кратким пересказом: контент ещё не размечен. */}
      {listCard === undefined ? (
        <span className="line-clamp-2 text-xs text-ink-soft">{spell.shortRulesRu}</span>
      ) : listCard.noteRu === undefined ? null : (
        <span className="text-[0.78125rem] leading-normal text-ink-quiet">{listCard.noteRu}</span>
      )}

      {active ? <span className="text-xs font-medium text-ink-quiet">Уже действует</span> : null}

      {unavailableReason === undefined ? null : (
        <span className="text-xs font-medium text-reaction">Недоступно: {unavailableReason}</span>
      )}
    </ActionRow>
  );
}
