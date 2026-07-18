import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Lock, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import type { ConceptMapNode, ConceptNodeState } from './types';

export interface ConceptNodeData {
  concept: ConceptMapNode;
  state: ConceptNodeState;
  /** BKT mastery probability (0-1); undefined = concept not yet attempted. */
  mastery?: number;
  highlighted: boolean;
  readOnly: boolean;
  /** Teacher approval mode: remove this concept from the map. */
  onDelete?: () => void;
  [key: string]: unknown;
}

const STATE_CLASSES: Record<ConceptNodeState, string> = {
  locked:
    'border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground opacity-70 cursor-not-allowed',
  available:
    'border-border bg-card text-card-foreground hover:border-primary/60 hover:shadow-md cursor-pointer',
  current:
    'border-primary bg-primary/10 text-foreground ring-2 ring-primary/40 cursor-pointer',
  mastered:
    'border-emerald-500/60 bg-emerald-500/10 text-foreground cursor-pointer',
  weak:
    'border-amber-500/60 bg-amber-500/10 text-foreground cursor-pointer',
};

const StateBadge = ({ state }: { state: ConceptNodeState }) => {
  if (state === 'locked') return <Lock className="h-3 w-3 shrink-0" aria-label="Upcoming concept" />;
  if (state === 'mastered') return <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" aria-label="Mastered" />;
  if (state === 'weak') return <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-label="Revisit this" />;
  return null;
};

/**
 * Continuous mastery shading: hue slides from amber (38°, low mastery) to
 * emerald (152°, high mastery) with the BKT probability. Inline styles because
 * Tailwind can't express a continuous scale.
 */
const masteryHue = (p: number) => 38 + (152 - 38) * Math.min(Math.max(p, 0), 1);
const masteryStyles = (p: number) => ({
  borderColor: `hsl(${masteryHue(p)} 65% 42% / 0.65)`,
  backgroundColor: `hsl(${masteryHue(p)} 65% 42% / 0.12)`,
});

function ConceptNodeInner({ data }: NodeProps) {
  const { concept, state, mastery, highlighted, readOnly, onDelete } = data as ConceptNodeData;
  // The mastery gradient replaces the binary mastered/weak tint; current and
  // locked keep their stronger positional styling.
  const shaded = mastery !== undefined && state !== 'current' && state !== 'locked';
  return (
    <div
      title={concept.description || concept.label}
      style={shaded ? masteryStyles(mastery) : undefined}
      className={`group relative w-[220px] rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
        readOnly ? 'cursor-default' : ''
      } ${STATE_CLASSES[state]} ${highlighted ? 'ring-2 ring-primary shadow-lg' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-muted-foreground/50 !border-0" />
      {onDelete && (
        <button
          type="button"
          aria-label={`Remove concept: ${concept.label}`}
          title="Remove this concept"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-red-500 hover:text-white group-hover:flex"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <div className="flex items-start gap-1.5">
        <StateBadge state={state} />
        <span className="line-clamp-2 leading-snug">{concept.label}</span>
        {mastery !== undefined && state !== 'locked' && (
          <span
            aria-label={`Estimated mastery ${Math.round(mastery * 100)} percent`}
            title="Estimated mastery (Bayesian Knowledge Tracing)"
            style={{
              color: `hsl(${masteryHue(mastery)} 70% 32%)`,
              backgroundColor: `hsl(${masteryHue(mastery)} 65% 42% / 0.18)`,
            }}
            className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
          >
            {Math.round(mastery * 100)}%
          </span>
        )}
      </div>
      {state === 'locked' && (
        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">Upcoming</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-muted-foreground/50 !border-0" />
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeInner);
