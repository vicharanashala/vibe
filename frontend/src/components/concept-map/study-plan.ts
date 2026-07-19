import type { ConceptMapEdge, ConceptMapNode } from './types';

/**
 * Remediation path ("study plan") over the concept DAG.
 *
 * Weak concepts (failed quiz / low BKT mastery) rarely stand alone — they sit
 * on top of prerequisites the student may also be shaky on. The plan is the
 * prerequisite closure of every weak concept, minus what the student has
 * already shown strength in, ordered by the map's own prerequisite ordering
 * (topological sort). Pure function — trivially testable, no I/O.
 */

export interface StudyStep {
  node: ConceptMapNode;
  /** BKT mastery probability at plan time, when the concept was attempted. */
  mastery?: number;
  /** Why the step is in the plan. */
  reason: 'weak' | 'prerequisite';
}

/** Below this BKT probability an attempted concept counts as weak. */
export const WEAK_THRESHOLD = 0.5;
/** At or above this BKT probability a concept counts as strong (skipped). */
export const STRONG_THRESHOLD = 0.8;

export function buildStudyPlan(
  nodes: ConceptMapNode[],
  edges: ConceptMapEdge[],
  mastery: Record<string, number> | undefined,
  outcomes: Record<string, 'mastered' | 'weak'> | undefined,
): StudyStep[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const parents = new Map<string, string[]>();
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    (parents.get(e.to) ?? parents.set(e.to, []).get(e.to)!).push(e.from);
  }

  const masteryOf = (id: string) => mastery?.[id];
  const isWeak = (id: string) => {
    const p = masteryOf(id);
    if (p !== undefined) return p < WEAK_THRESHOLD;
    return outcomes?.[id] === 'weak';
  };
  const isStrong = (id: string) => {
    const p = masteryOf(id);
    if (p !== undefined) return p >= STRONG_THRESHOLD;
    return outcomes?.[id] === 'mastered';
  };

  const weakIds = nodes.filter(n => isWeak(n.id)).map(n => n.id);
  if (!weakIds.length) return [];

  // Prerequisite closure of the weak set, skipping already-strong concepts
  // (a strong ancestor needs no revisit, but its own ancestors are
  // unreachable through it by design — strength cuts the chain).
  const inPlan = new Set<string>(weakIds);
  const stack = [...weakIds];
  while (stack.length) {
    const id = stack.pop()!;
    for (const parent of parents.get(id) ?? []) {
      if (inPlan.has(parent) || isStrong(parent)) continue;
      inPlan.add(parent);
      stack.push(parent);
    }
  }

  // Kahn topological sort restricted to the plan members, tie-broken by the
  // original node order (which follows lecture time) for a stable plan.
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const id of inPlan) indegree.set(id, 0);
  for (const e of edges) {
    if (!inPlan.has(e.from) || !inPlan.has(e.to)) continue;
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    (children.get(e.from) ?? children.set(e.from, []).get(e.from)!).push(e.to);
  }
  const ready = [...inPlan].filter(id => (indegree.get(id) ?? 0) === 0);
  const sorted: string[] = [];
  while (ready.length) {
    ready.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    const id = ready.shift()!;
    sorted.push(id);
    for (const child of children.get(id) ?? []) {
      const d = (indegree.get(child) ?? 1) - 1;
      indegree.set(child, d);
      if (d === 0) ready.push(child);
    }
  }
  // The map is validated as a DAG at generation time; if a cycle ever slipped
  // through, fall back to lecture order rather than dropping steps.
  if (sorted.length !== inPlan.size) {
    sorted.length = 0;
    sorted.push(...[...inPlan].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)));
  }

  return sorted.map(id => ({
    node: byId.get(id)!,
    mastery: masteryOf(id),
    reason: isWeak(id) ? 'weak' : 'prerequisite',
  }));
}
