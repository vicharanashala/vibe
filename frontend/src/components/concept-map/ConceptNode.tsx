import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Lock, CheckCircle2, AlertTriangle, MapPin, X } from 'lucide-react';
import type { ConceptMapNode, ConceptNodeState } from './types';

export interface ConceptNodeData {
  concept: ConceptMapNode;
  state: ConceptNodeState;
  /** BKT mastery probability (0-1); undefined = concept not yet attempted. */
  mastery?: number;
  /** 1-based position of the concept in lecture order (chip on the node). */
  order?: number;
  highlighted: boolean;
  readOnly: boolean;
  /** Teacher approval mode: remove this concept from the map. */
  onDelete?: () => void;
  [key: string]: unknown;
}

const STATE_CLASSES: Record<ConceptNodeState, string> = {
  locked:
    'border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground opacity-75 cursor-not-allowed',
  available:
    'border-border bg-gradient-to-br from-card to-muted/40 text-card-foreground hover:border-primary/60 cursor-pointer',
  current:
    'border-primary bg-gradient-to-br from-primary/15 to-primary/5 text-foreground ring-2 ring-primary/40 cursor-pointer',
  mastered:
    'border-emerald-500/60 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-foreground cursor-pointer',
  weak:
    'border-amber-500/60 bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-foreground cursor-pointer',
};

const StateBadge = ({ state }: { state: ConceptNodeState }) => {
  if (state === 'locked') return <Lock className="h-3.5 w-3.5 shrink-0" aria-label="Upcoming concept" />;
  if (state === 'current') return <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="You are here" />;
  if (state === 'mastered') return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Mastered" />;
  if (state === 'weak') return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Revisit this" />;
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
  const { concept, state, mastery, order, highlighted, readOnly, onDelete } = data as ConceptNodeData;
  // The mastery gradient replaces the binary mastered/weak tint; current and
  // locked keep their stronger positional styling.
  const shaded = mastery !== undefined && state !== 'current' && state !== 'locked';
  return (
    <div
      title={concept.description || concept.label}
      style={shaded ? masteryStyles(mastery) : undefined}
      className={`group relative w-[250px] overflow-hidden rounded-2xl border-2 px-3.5 pb-3 pt-2.5 text-sm font-medium shadow-md transition-all duration-200 ${
        readOnly ? 'cursor-default' : 'hover:-translate-y-0.5 hover:shadow-xl'
      } ${STATE_CLASSES[state]} ${highlighted ? 'ring-2 ring-primary shadow-xl' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-background !bg-muted-foreground/60" />
      {onDelete && (
        <button
          type="button"
          aria-label={`Remove concept: ${concept.label}`}
          title="Remove this concept"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -right-0.5 -top-0.5 z-10 hidden h-6 w-6 items-center justify-center rounded-bl-xl rounded-tr-2xl border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-red-500 hover:text-white group-hover:flex"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex items-start gap-2">
        {order !== undefined && (
          <span
            aria-hidden
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-foreground/10 text-[11px] font-bold leading-none"
          >
            {order}
          </span>
        )}
        <span className="line-clamp-2 flex-1 leading-snug">{concept.label}</span>
        <StateBadge state={state} />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {state === 'locked' ? (
          <span className="text-[11px] font-normal text-muted-foreground">Upcoming</span>
        ) : mastery !== undefined ? (
          <>
            {/* mastery meter: instantly readable progress toward mastery */}
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <span
                className="block h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(mastery * 100)}%`,
                  backgroundColor: `hsl(${masteryHue(mastery)} 70% 45%)`,
                }}
              />
            </span>
            <span
              aria-label={`Estimated mastery ${Math.round(mastery * 100)} percent`}
              title="Estimated mastery (Bayesian Knowledge Tracing)"
              style={{ color: `hsl(${masteryHue(mastery)} 75% 34%)` }}
              className="shrink-0 text-[11px] font-bold leading-none"
            >
              {Math.round(mastery * 100)}%
            </span>
          </>
        ) : (
          <span className="text-[11px] font-normal text-muted-foreground/70">
            {state === 'current' ? 'Now playing' : 'Click to watch'}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-background !bg-muted-foreground/60" />
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeInner);
