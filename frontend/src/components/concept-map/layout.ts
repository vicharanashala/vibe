import dagre from '@dagrejs/dagre';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { ConceptMapEdge, ConceptMapNode } from './types';
import { HAND_FONT } from './palette';

export const NODE_WIDTH = 270;
export const NODE_HEIGHT = 116;

const RADIAL_GAP = 40;

/**
 * Radial (mind-map) layout: the root sits at the centre, every spoke sits on
 * a ring around it. Unlike a stacked/rowed layout, every root->spoke edge is
 * then a single direct hop with nothing else in between at any spoke count,
 * and spoke->spoke "chord" edges can arc around the ring instead of cutting
 * across the crowded centre.
 */
function layoutRadial(
  nodes: ConceptMapNode[],
  rootId: string,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(rootId, { x: 0, y: 0 });

  const spokes = nodes.filter(n => n.id !== rootId);
  const n = spokes.length;
  if (n === 0) return positions;
  const angleStep = (2 * Math.PI) / n;
  // Radius large enough that adjacent boxes (kept axis-aligned, not rotated
  // to face the centre) never overlap regardless of where they land.
  const radius = Math.max(
    (NODE_WIDTH + RADIAL_GAP) / (2 * Math.sin(angleStep / 2)),
    NODE_HEIGHT * 2 + RADIAL_GAP,
  );
  spokes.forEach((s, i) => {
    const angle = -Math.PI / 2 + i * angleStep; // start at 12 o'clock, go clockwise
    positions.set(s.id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  });
  return positions;
}

/** Point where the straight line from `from` to `to` crosses `from`'s box edge. */
function boxBoundaryPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  halfW: number,
  halfH: number,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { ...from };
  const tx = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/**
 * Deterministic layout — no force simulation, so the same map always
 * renders the same way. A single-root map (everything connects directly
 * back to one foundational concept) uses a radial hub-and-spoke layout so
 * it reads as an actual concept map; anything else falls back to a dagre
 * top-down hierarchy.
 */
export function layoutConceptMap(
  nodes: ConceptMapNode[],
  edges: ConceptMapEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const known = new Set(nodes.map(n => n.id));
  // Guard against edges referencing unknown ids so one bad edge can't blank the panel.
  const safeEdges = edges.filter(e => known.has(e.from) && known.has(e.to));

  const inDegree = new Map(nodes.map(n => [n.id, 0]));
  const outDegree = new Map(nodes.map(n => [n.id, 0]));
  for (const e of safeEdges) {
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
  }
  const roots = nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0);
  const isHub =
    nodes.length > 2 &&
    roots.length === 1 &&
    (outDegree.get(roots[0].id) ?? 0) === nodes.length - 1;
  const rootId = roots[0]?.id;

  let positions: Map<string, { x: number; y: number }>;
  if (isHub) {
    positions = layoutRadial(nodes, rootId);
  } else {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 84, marginx: 20, marginy: 20 });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
    safeEdges.forEach(e => g.setEdge(e.from, e.to));
    dagre.layout(g);
    positions = new Map(nodes.map(n => [n.id, g.node(n.id) as { x: number; y: number }]));
  }

  const rfNodes: Node[] = nodes.map(n => {
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'concept',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { concept: n },
      draggable: false,
      connectable: false,
    };
  });

  // Linking phrases render at the edge's midpoint. In a radial layout every
  // edge — spoke or chord — is a curve that starts and ends clear of every
  // other node's box, so there's never an unrelated node hiding the phrase.
  // In the dagre fallback, an edge that skips a rank puts its midpoint
  // behind an intermediate node, so only rank-adjacent edges print theirs.
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const rfEdges: Edge[] = safeEdges.map(e => {
    const span = Math.abs((order.get(e.to) ?? 0) - (order.get(e.from) ?? 0));
    if (isHub) {
      const from = positions.get(e.from)!;
      const to = positions.get(e.to)!;
      const halfW = NODE_WIDTH / 2;
      const halfH = NODE_HEIGHT / 2;
      const sp = boxBoundaryPoint(from, to, halfW, halfH);
      const tp = boxBoundaryPoint(to, from, halfW, halfH);
      const midX = (sp.x + tp.x) / 2;
      const midY = (sp.y + tp.y) / 2;
      const dx = tp.x - sp.x;
      const dy = tp.y - sp.y;
      const len = Math.hypot(dx, dy) || 1;
      let px = -dy / len;
      let py = dx / len;
      // Bulge the curve away from the root (the origin) — a spoke->spoke
      // chord then arcs around the crowded centre instead of through it.
      if (midX * px + midY * py < 0) {
        px = -px;
        py = -py;
      }
      // A root->spoke edge only needs a gentle hand-drawn curve (nothing
      // sits between root and any one spoke by construction); a chord
      // between two spokes needs a wider arc to clear the centre.
      const bow = e.from === rootId || e.to === rootId ? 20 : 55;
      const cx = midX + px * bow;
      const cy = midY + py * bow;
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        type: 'radialCurve',
        data: { sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y, cx, cy },
        style: { strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
        // Novak linking phrase: the pair reads as "<from> <label> <to>".
        label: e.label,
        labelStyle: { fontSize: 15, fontWeight: 700, fontFamily: HAND_FONT },
        labelBgPadding: [8, 5] as [number, number],
        labelBgBorderRadius: 6,
      };
    }
    return {
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      style: { strokeWidth: 2.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
      label: span <= 1 ? e.label : undefined,
      labelStyle: { fontSize: 15, fontWeight: 700, fontFamily: HAND_FONT },
      labelBgPadding: [8, 5] as [number, number],
      labelBgBorderRadius: 6,
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}
