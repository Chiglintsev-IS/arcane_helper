import { RULE_GROUP, RULE_ROLE } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP, SURFACE_PAGE } from "@/ui/shared/ui/surface";
import type { Tone } from "@/ui/shared/ui/tone";

/** Прозрачностью строку гасить нельзя: контраст падает до 2.8 при требуемых 4.5 — ловит axe. */
const DIMMED_SURFACE = `${SURFACE_PAGE} ${RULE_GROUP}`;

export function ActionRow({
  nameRu,
  role,
  dimmed = false,
  corner,
  aside,
  onOpen,
  children,
}: {
  nameRu: string;
  role: { tone: Tone; label: string };
  dimmed?: boolean;
  corner?: React.ReactNode;
  aside?: React.ReactNode;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onOpen}
        className={`relative flex flex-1 flex-col items-start gap-1 p-2 text-left ${
          dimmed ? DIMMED_SURFACE : SURFACE_GROUP
        } ${RULE_ROLE[role.tone]}`}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="text-[1.0625rem] font-bold leading-tight">{nameRu}</span>
          <span className="sr-only">{role.label}</span>
          {corner === null || corner === undefined ? null : (
            <span className="shrink-0 font-mono text-[0.625rem] tracking-[0.1em] text-ink-quiet">
              {corner}
            </span>
          )}
        </span>
        {children}
      </button>
      {aside}
    </li>
  );
}
