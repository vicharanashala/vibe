import type { components } from '@/types/schema';

export type ConceptMap = components['schemas']['ConceptMapResponse'];
export type ConceptMapNode = components['schemas']['ConceptMapNodeResponse'];
export type ConceptMapEdge = components['schemas']['ConceptMapEdgeResponse'];

/**
 * Visual state of a concept node.
 * - locked:   ahead of the student's progression (rendered "upcoming", not navigable)
 * - available: reachable — clicking navigates to its video item
 * - current:  anchored to the item the student is currently viewing
 * - mastered / weak: quiz-outcome overlay (week-3 enrichment; styled now, fed later)
 */
export type ConceptNodeState =
  | 'locked'
  | 'available'
  | 'current'
  | 'mastered'
  | 'weak';

export interface ConceptMapPanelProps {
  nodes: ConceptMapNode[];
  edges: ConceptMapEdge[];
  /** Node to visually emphasize (usually the one anchored to the current item). */
  highlightNodeId?: string;
  /** Resolves each node's visual state; defaults to 'available'. */
  nodeState?: (node: ConceptMapNode) => ConceptNodeState;
  /**
   * Resolves each node's BKT mastery probability (0-1); undefined = not yet
   * attempted. Attempted nodes render a percentage badge and shade from
   * amber (low) to emerald (high).
   */
  nodeMastery?: (node: ConceptMapNode) => number | undefined;
  /** Invoked on click of a non-locked node. */
  onNodeClick?: (node: ConceptMapNode) => void;
  /** Teacher approval mode: renders a delete affordance on every node. */
  onNodeDelete?: (node: ConceptMapNode) => void;
  /** Teacher preview / no navigation semantics. */
  readOnly?: boolean;
  /** Render the node-state legend row (student view). */
  showLegend?: boolean;
  className?: string;
}
