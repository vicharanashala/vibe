import { ListChecks, Play } from 'lucide-react';
import type { StudyStep } from './study-plan';
import type { ConceptMapNode } from './types';

interface StudyPlanProps {
  steps: StudyStep[];
  /** Navigate to the step's video moment (same semantics as a node click). */
  onStepClick?: (node: ConceptMapNode) => void;
  className?: string;
}

/**
 * Student remediation path: an ordered "revisit these, in this order" list
 * derived from the concept DAG + BKT mastery (see study-plan.ts). Light
 * component — safe to import eagerly, unlike the React Flow panel.
 */
export function StudyPlan({ steps, onStepClick, className }: StudyPlanProps) {
  if (!steps.length) return null;
  return (
    <div className={`rounded-xl border border-border/40 bg-muted/20 p-3 ${className ?? ''}`}>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <ListChecks className="h-4 w-4 text-primary" />
        Recommended review path
        <span className="font-normal text-muted-foreground">
          — watch in this order, then retry the quizzes
        </span>
      </div>
      <ol className="space-y-1">
        {steps.map((step, i) => (
          <li key={step.node.id}>
            <button
              type="button"
              onClick={() => onStepClick?.(step.node)}
              className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/60"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{step.node.label}</span>
              {step.mastery !== undefined && (
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                  {Math.round(step.mastery * 100)}%
                </span>
              )}
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  step.reason === 'weak'
                    ? 'bg-amber-500/15 text-amber-600'
                    : 'bg-sky-500/15 text-sky-600'
                }`}
              >
                {step.reason === 'weak' ? 'Revisit' : 'Prerequisite'}
              </span>
              <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
