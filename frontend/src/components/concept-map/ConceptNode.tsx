import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Lock, CheckCircle2, AlertTriangle, MapPin, X } from 'lucide-react';
import type { ConceptMapNode, ConceptNodeState } from './types';
import { HAND_FONT } from './palette';

export interface ConceptNodeData {
  concept: ConceptMapNode;
  state: ConceptNodeState;
  /** Best raw quiz score (0-100); undefined = not yet attempted. */
  score?: number;
  /** 1-based position of the concept in lecture order (chip on the node). */
  order?: number;
  /** Fixed categorical color for this node (see ./palette.ts) — keeps every
   *  node visually distinct even before any quiz attempt exists. */
  categoryColor?: string;
  highlighted: boolean;
  /** Focus mode: another node is hovered and this one is not connected to it. */
  dimmed?: boolean;
  readOnly: boolean;
  /** Teacher approval mode: remove this concept from the map. */
  onDelete?: () => void;
  [key: string]: unknown;
}

const STATE_CLASSES: Record<ConceptNodeState, string> = {
  locked:
    'border-dashed border-muted-foreground/50 bg-muted/30 text-foreground/90 cursor-not-allowed',
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
  if (state === 'locked') return <Lock className="h-4 w-4 shrink-0" aria-label="Upcoming concept" />;
  if (state === 'current') return <MapPin className="h-4 w-4 shrink-0 text-primary" aria-label="You are here" />;
  if (state === 'mastered') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Mastered" />;
  if (state === 'weak') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-label="Revisit this" />;
  return null;
};

/** Before mastered/weak is known, tint the card with the node's own category
 *  color so the map reads as distinct concepts, not blank cards. */
const categoryStyles = (hex: string, muted: boolean) => ({
  borderColor: `${hex}${muted ? '55' : '99'}`,
  backgroundColor: `${hex}${muted ? '14' : '1f'}`,
  // The 'available'/'locked' state classes paint a background-image
  // (gradient), which would otherwise sit on top of and hide this flat tint.
  backgroundImage: 'none',
});

function ConceptNodeInner({ data }: NodeProps) {
  const { concept, state, score, order, categoryColor, highlighted, dimmed, readOnly, onDelete } = data as ConceptNodeData;
  const categorized = (state === 'available' || state === 'locked') && !!categoryColor;
  return (
    <div
      title={concept.description || concept.label}
      style={{
        fontFamily: HAND_FONT,
        ...(categorized ? categoryStyles(categoryColor!, state === 'locked') : undefined),
      }}
      className={`group relative w-[270px] overflow-hidden rounded-2xl border-2 px-4 pb-3.5 pt-3 text-base font-medium shadow-md transition-all duration-200 ${
        readOnly ? 'cursor-default' : 'hover:-translate-y-0.5 hover:shadow-xl'
      } ${STATE_CLASSES[state]} ${highlighted ? 'ring-2 ring-primary shadow-xl' : ''} ${
        dimmed ? 'opacity-25' : ''
      }`}
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
            style={categoryColor ? { backgroundColor: categoryColor } : undefined}
            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-sm font-bold leading-none ${
              categoryColor ? 'text-white shadow-sm' : 'bg-foreground/10'
            }`}
          >
            {order}
          </span>
        )}
        <span className="line-clamp-2 flex-1 leading-snug">{concept.label}</span>
        <StateBadge state={state} />
      </div>
      {/* Secondary line, Novak-style content — hidden when it would just
          repeat the label (fallback maps derive both from the same text). */}
      {concept.description && state !== 'locked' &&
        !concept.description.startsWith(concept.label) && (
        <p className="mt-1 line-clamp-1 text-[13px] font-normal leading-snug text-muted-foreground">
          {concept.description}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {state === 'locked' ? (
          <span className="text-xs font-normal text-muted-foreground">Upcoming</span>
        ) : score !== undefined ? (
          <>
            {/* raw quiz score: best attempt, as a percentage */}
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <span
                className={`block h-full rounded-full transition-all duration-500 ${
                  state === 'mastered' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </span>
            <span
              aria-label={`Quiz score ${score} percent`}
              title="Best quiz score"
              className={`shrink-0 text-sm font-bold leading-none ${
                state === 'mastered' ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {score}%
            </span>
          </>
        ) : (
          <span className="text-xs font-normal text-muted-foreground/70">
            {state === 'current' ? 'Now playing' : 'Click to watch'}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-background !bg-muted-foreground/60" />
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeInner);
