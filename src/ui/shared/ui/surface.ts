import { RULE_ACTIVE, RULE_EDGE_TOP, RULE_GROUP } from "@/ui/shared/ui/rule";

export const SURFACE_PAGE = "bg-page";

export const SURFACE_GROUP = `bg-group ${RULE_GROUP}`;

export const SURFACE_GROUP_BARE = "bg-group";

export const SURFACE_CONTROL = `bg-control ${RULE_GROUP}`;

export const SURFACE_PANEL = `bg-sheet ${RULE_EDGE_TOP}`;

export const SURFACE_DISABLED = "disabled:bg-control";

/** Белая подпись на золоте даёт 2.15 при требуемых 4.5; цвет страницы годится в обеих темах. */
export const SURFACE_PRIMARY = "bg-accent text-page";

export const SURFACE_CHOSEN = `bg-group text-accent ${RULE_ACTIVE}`;
