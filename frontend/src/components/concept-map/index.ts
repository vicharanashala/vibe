import { lazy } from 'react';

/**
 * Lazy entry point — keeps @xyflow/react + @dagrejs/dagre out of the main
 * bundle. Render inside a <Suspense> boundary.
 */
export const ConceptMapPanel = lazy(() => import('./ConceptMapPanel'));

// Light (no React Flow) — safe to export eagerly.
export { StudyPlan } from './StudyPlan';
export { buildStudyPlan } from './study-plan';
export type { StudyStep } from './study-plan';

export type {
  ConceptMap,
  ConceptMapEdge,
  ConceptMapNode,
  ConceptMapPanelProps,
  ConceptNodeState,
} from './types';
