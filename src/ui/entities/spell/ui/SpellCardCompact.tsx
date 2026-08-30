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

const CANTRIP_LEVEL = 0;

const LOUD = "text-sm font-bold leading-snug text-ink";

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
  casting: CastingView;
  armorClass: number;
  onOpen: () => void;
  onTogglePrepared?: (() => void) | undefined;
}) {
  const { active, unavailable, unavailableReason, listCard } = spell;
  const castingTime = castingTimeBadge(spell.castingTime.type);
  const holds = holdsPhrase(spell);
  const roll = rollPhrase(spell, casting);
  const letters = componentLetters(spell);
  const role = combatRole(spell.role);
  const dimmed = unavailable || active;

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
