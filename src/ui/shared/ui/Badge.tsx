import { RULE_MARK } from "@/ui/shared/ui/rule";
import { SURFACE_GROUP_BARE } from "@/ui/shared/ui/surface";
import { TONE_GLYPH, TONE_TEXT, type Tone } from "@/ui/shared/ui/tone";

export function Badge({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1 text-[0.6875rem] font-medium leading-5 ${SURFACE_GROUP_BARE} ${RULE_MARK[tone]}`}
    >
      <span aria-hidden="true" className={TONE_TEXT[tone]}>
        {icon ?? TONE_GLYPH[tone]}
      </span>
      {children}
    </span>
  );
}
