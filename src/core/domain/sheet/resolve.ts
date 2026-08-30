import { DomainError } from "@/core/domain/shared/errors";
import type { StatContribution, StatId, StatMethod } from "@/core/domain/shared/stats";

type StatRange = { readonly minimum?: number; readonly maximum?: number };

type StatReader = (stat: Stat) => number;

type StatCandidate = {
  readonly value: number;
  readonly grownFrom: StatMethod | undefined;
};

export type Stat = {
  readonly id: StatId;
  readonly range: StatRange | undefined;
  readonly from: readonly Stat[];
  readonly methods: (
    read: StatReader,
    brought: readonly StatMethod[],
  ) => readonly StatCandidate[];
};

export function defineStat(definition: {
  readonly id: StatId;
  readonly from?: readonly Stat[];
  readonly range?: StatRange;
  readonly methods: (
    read: StatReader,
    brought: readonly StatMethod[],
  ) => readonly StatCandidate[];
}): Stat {
  return {
    id: definition.id,
    range: definition.range,
    from: definition.from ?? [],
    methods: definition.methods,
  };
}

export function ownCandidate(value: number): StatCandidate {
  return { value, grownFrom: undefined };
}

type Sourced<TSource> = {
  readonly source: TSource;
  readonly contribution: StatContribution;
};

type BreakdownPart<TSource> = Sourced<TSource> & { readonly applied: boolean };

export type Breakdown<TSource> = {
  readonly value: number;
  readonly parts: readonly BreakdownPart<TSource>[];
};

function clamped(value: number, range: StatRange | undefined): number {
  if (range === undefined) return value;
  const atLeast = range.minimum === undefined ? value : Math.max(value, range.minimum);
  return range.maximum === undefined ? atLeast : Math.min(atLeast, range.maximum);
}

function fold<TSource>(
  stat: Stat,
  read: StatReader,
  brought: readonly Sourced<TSource>[],
): Breakdown<TSource> {
  const assignment = brought.find(({ contribution }) => contribution.kind === "assignment");
  const assigned =
    assignment?.contribution.kind === "assignment" ? assignment.contribution.value : undefined;

  const candidates = stat.methods(
    read,
    brought.map(broughtMethod).filter((method) => method !== undefined),
  );
  const best = candidates.reduce<StatCandidate | undefined>(
    (highest, candidate) =>
      highest === undefined || candidate.value > highest.value ? candidate : highest,
    undefined,
  );

  const bonuses = brought.reduce(
    (sum, { contribution }) => (contribution.kind === "bonus" ? sum + contribution.value : sum),
    0,
  );

  return {
    value: clamped(assigned ?? (best?.value ?? 0) + bonuses, stat.range),
    parts: brought.map((sourced) => ({
      ...sourced,
      applied: isApplied(sourced, assignment, best),
    })),
  };
}

function broughtMethod<TSource>({ contribution }: Sourced<TSource>): StatMethod | undefined {
  return contribution.kind === "method" ? contribution.method : undefined;
}

function isApplied<TSource>(
  sourced: Sourced<TSource>,
  assignment: Sourced<TSource> | undefined,
  best: StatCandidate | undefined,
): boolean {
  if (assignment !== undefined) return sourced === assignment;
  if (sourced.contribution.kind === "method") return best?.grownFrom === sourced.contribution.method;
  return true;
}

export function resolveStats<TSource>(
  stats: readonly Stat[],
  brought: readonly Sourced<TSource>[],
): ReadonlyMap<StatId, Breakdown<TSource>> {
  const resolved = new Map<StatId, Breakdown<TSource>>();

  const read: StatReader = (stat) => {
    const known = resolved.get(stat.id);
    if (known === undefined) {
      throw new DomainError(
        `Величина «${stat.id}» прочитана до того, как посчитана: её нет среди объявленных зависимостей`,
      );
    }
    return known.value;
  };

  for (const stat of ordered(stats)) {
    resolved.set(
      stat.id,
      fold(
        stat,
        read,
        brought.filter(({ contribution }) => contribution.stat === stat.id),
      ),
    );
  }
  return resolved;
}

export function breakdownOf<TSource>(
  resolved: ReadonlyMap<StatId, Breakdown<TSource>>,
  stat: StatId,
): Breakdown<TSource> {
  const known = resolved.get(stat);
  if (known === undefined) {
    throw new DomainError(`Величины «${stat}» лист не считает: сборщик её пропустил`);
  }
  return known;
}

function ordered(stats: readonly Stat[]): readonly Stat[] {
  const placed = new Set<Stat>();
  const order: Stat[] = [];

  function place(stat: Stat): void {
    if (placed.has(stat)) return;
    placed.add(stat);
    for (const dependency of stat.from) place(dependency);
    order.push(stat);
  }

  for (const stat of stats) place(stat);
  return order;
}
