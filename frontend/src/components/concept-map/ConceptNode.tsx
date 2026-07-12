import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ConceptMapNode, ConceptNodeState } from './types';

export interface ConceptNodeData {
  concept: ConceptMapNode;
  state: ConceptNodeState;
  highlighted: boolean;
  readOnly: boolean;
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

function ConceptNodeInner({ data }: NodeProps) {
  const { concept, state, highlighted, readOnly } = data as ConceptNodeData;
  return (
    <div
      title={concept.description || concept.label}
      className={`w-[190px] rounded-xl border px-3 py-2 text-xs font-medium shadow-sm transition-all duration-200 ${
        readOnly ? 'cursor-default' : ''
      } ${STATE_CLASSES[state]} ${highlighted ? 'ring-2 ring-primary shadow-lg' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !bg-muted-foreground/50 !border-0" />
      <div className="flex items-start gap-1.5">
        <StateBadge state={state} />
        <span className="line-clamp-2 leading-snug">{concept.label}</span>
      </div>
      {state === 'locked' && (
        <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">Upcoming</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !bg-muted-foreground/50 !border-0" />
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeInner);
