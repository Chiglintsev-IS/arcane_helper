import type { Tone } from "@/ui/shared/ui/tone";
import type { ReactNode } from "react";

import { Badge } from "@/ui/shared/ui/Badge";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { SURFACE_CONTROL, SURFACE_DISABLED, SURFACE_PAGE, SURFACE_GROUP } from "@/ui/shared/ui/surface";

export const WIZARD_STEP_TITLES = {
  availability: "Проверьте условия",
} as const;

export type WizardFooter = {
  onBack?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
};

export function WizardShell({
  ariaLabel,
  title,
  subtitle,
  badge,
  stepLabel,
  onCancel,
  footer,
  children,
}: {
  ariaLabel: string;
  title: string;
  subtitle: string;
  badge: { tone: Tone; icon: string; label: string };
  stepLabel: string;
  onCancel: () => void;
  footer: WizardFooter;
  children: ReactNode;
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={`fixed inset-0 z-20 flex flex-col ${SURFACE_PAGE}`}
    >
      <header className={`flex flex-col gap-1 p-3 ${SURFACE_GROUP}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            <p className="text-xs text-ink-quiet">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-2 text-sm text-ink-quiet underline"
          >
            {BUTTON_LABELS.dismiss}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={badge.tone} icon={badge.icon}>
            {badge.label}
          </Badge>
          <p className="text-xs text-ink-quiet">{stepLabel}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {children}
      </div>

      <footer className={`flex gap-2 p-3 ${SURFACE_GROUP}`}>
        {footer.onBack === undefined ? null : (
          <button
            type="button"
            onClick={footer.onBack}
            className={`min-h-11 px-4 text-sm ${SURFACE_CONTROL}`}
          >
            Назад
          </button>
        )}
        <button
          type="button"
          disabled={footer.primaryDisabled === true}
          onClick={footer.onPrimary}
          className={`min-h-12 flex-1 bg-accent px-4 text-base font-semibold text-page disabled:text-off ${SURFACE_DISABLED}`}
        >
          {footer.primaryLabel}
        </button>
      </footer>
    </section>
  );
}
