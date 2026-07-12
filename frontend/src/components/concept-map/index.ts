import { lazy } from 'react';

/**
 * Lazy entry point — keeps @xyflow/react + @dagrejs/dagre out of the main
 * bundle. Render inside a <Suspense> boundary.
 */
export const ConceptMapPanel = lazy(() => import('./ConceptMapPanel'));

export type {
  ConceptMap,
  ConceptMapEdge,
  ConceptMapNode,
  ConceptMapPanelProps,
  ConceptNodeState,
} from './types';
