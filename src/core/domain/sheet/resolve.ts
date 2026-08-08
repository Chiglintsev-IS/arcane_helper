/**
 * Свёртка вкладов в число — одна на все величины.
 *
 * Источника движок не знает: он принимает пары «источник и вклад» и возвращает разбор с тем же
 * источником, ни разу не заглянув внутрь. Поэтому кольцо, заклинание и слово мастера считаются
 * одинаково, а показать разницу между ними может тот, кто разбор читает.
 *
 * Цикл здесь невыразим: величина строится из объектов своих зависимостей, а не из их имён, и
 * назвать зависимостью себя значит использовать объявление до объявления — ошибка компиляции.
 */

import { DomainError } from "@/core/domain/shared/errors";
import type { StatContribution, StatId, StatMethod } from "@/core/domain/shared/stats";

/** Допустимый диапазон величины: свойство самой величины, применяется в конце счёта. */
export type StatRange = { readonly minimum?: number; readonly maximum?: number };

/** Значение уже посчитанной зависимости. */
export type StatReader = (stat: Stat) => number;

/**
 * Посчитанный способ счёта и принесённый вклад, из которого он вырос.
 *
 * Собственный способ величины ни из чего не вырос и приносящего не имеет: «без доспехов» действует
 * и тогда, когда не принесли ничего.
 */
export type StatCandidate = {
  readonly value: number;
  readonly grownFrom: StatMethod | undefined;
};

export type Stat = {
  readonly id: StatId;
  readonly range: StatRange | undefined;
  /**
   * Зависимости величины — объектами, и потому вычисленными раньше неё.
   *
   * Список читает движок: прочитать в формуле можно только то, что здесь названо.
   */
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

/** Способ счёта, ни из чего не выросший: собственная формула величины. */
export function ownCandidate(value: number): StatCandidate {
  return { value, grownFrom: undefined };
}

export type Sourced<TSource> = {
  readonly source: TSource;
  readonly contribution: StatContribution;
};

/**
 * Вклад в разборе: тот же источник, тот же вклад и признак «вошёл в итог».
 *
 * Непринятый способ счёта из разбора не пропадает: «кольчуга спорит с „Доспехами мага“ и
 * побеждает» — это ответ на «почему число такое», а исчезнувший проигравший ответом не был бы.
 */
export type BreakdownPart<TSource> = Sourced<TSource> & { readonly applied: boolean };

export type Breakdown<TSource> = {
  readonly value: number;
  readonly parts: readonly BreakdownPart<TSource>[];
};

function clamped(value: number, range: StatRange | undefined): number {
  if (range === undefined) return value;
  const atLeast = range.minimum === undefined ? value : Math.max(value, range.minimum);
  return range.maximum === undefined ? atLeast : Math.min(atLeast, range.maximum);
}

/**
 * Итог величины и разбор: назначение, иначе наибольший применимый способ плюс прибавки; затем
 * диапазон.
 *
 * Порядок вкладов на итог не влияет: наибольшее и сумма его не замечают, а назначение единственно —
 * это инвариант того, кто вклады хранит, и второе назначение сюда не доходит.
 */
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
  if (sourced.contribution.kind === "bonus") return true;
  if (sourced.contribution.kind === "assignment") return false;
  return best?.grownFrom === sourced.contribution.method;
}

/**
 * Разбор каждой величины по принесённым вкладам.
 *
 * Величины считаются в порядке зависимости: прочитать можно только то, что уже посчитано, и потому
 * названо в списке зависимостей. Прочитанное мимо списка — отказ, а не тихая единица.
 */
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

/** Величины в порядке зависимости: сначала то, из чего считают, потом то, что считают. */
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
