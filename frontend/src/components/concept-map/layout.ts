import dagre from '@dagrejs/dagre';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { ConceptMapEdge, ConceptMapNode } from './types';

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 64;

/**
 * Deterministic top-down (Novak-style) layout via dagre — no force
 * simulation, so the same map always renders the same way.
 */
export function layoutConceptMap(
  nodes: ConceptMapNode[],
  edges: ConceptMapEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  // Guard against edges referencing unknown ids so one bad edge can't blank the panel.
  const known = new Set(nodes.map(n => n.id));
  const safeEdges = edges.filter(e => known.has(e.from) && known.has(e.to));
  safeEdges.forEach(e => g.setEdge(e.from, e.to));

  dagre.layout(g);

  const rfNodes: Node[] = nodes.map(n => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: 'concept',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { concept: n },
      draggable: false,
      connectable: false,
    };
  });

  const rfEdges: Edge[] = safeEdges.map(e => ({
    id: `${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}
