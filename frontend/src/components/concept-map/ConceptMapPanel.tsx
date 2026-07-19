import { useCallback, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from 'next-themes';
import { CheckCircle2, AlertTriangle, Lock, MapPin } from 'lucide-react';
import { ConceptNode, type ConceptNodeData } from './ConceptNode';
import { layoutConceptMap } from './layout';
import type { ConceptMapPanelProps } from './types';

const nodeTypes: NodeTypes = { concept: ConceptNode };

const LEGEND_ITEMS = [
  { icon: <MapPin className="h-3.5 w-3.5 text-primary" />, label: 'Current' },
  { icon: <Lock className="h-3.5 w-3.5 text-muted-foreground" />, label: 'Upcoming' },
  { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Mastered' },
  { icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />, label: 'Revisit' },
  {
    icon: (
      <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold leading-tight text-emerald-600">
        %
      </span>
    ),
    label: 'Estimated mastery',
  },
];

/** MiniMap node colour follows the node's visual state. */
const MINIMAP_COLORS: Record<string, string> = {
  current: 'hsl(221 83% 53% / 0.9)',
  mastered: 'hsl(152 65% 42% / 0.8)',
  weak: 'hsl(38 85% 50% / 0.8)',
  locked: 'hsl(0 0% 60% / 0.35)',
  available: 'hsl(0 0% 60% / 0.55)',
};

/**
 * The one shared concept-map surface (teacher preview + student navigator).
 * Layout is deterministic (dagre top-down); interaction semantics come
 * entirely from the props, so the panel itself stays presentation-only.
 *
 * Heavy deps (@xyflow/react, @dagrejs/dagre) are isolated here — always
 * import this component through the lazy wrapper in ./index.ts.
 */
export default function ConceptMapPanel({
  nodes,
  edges,
  highlightNodeId,
  nodeState,
  nodeMastery,
  onNodeClick,
  onNodeDelete,
  readOnly = false,
  showLegend = false,
  className,
}: ConceptMapPanelProps) {
  const { resolvedTheme } = useTheme();

  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const laidOut = layoutConceptMap(nodes, edges);
    const decorated = laidOut.nodes.map(rfNode => {
      const index = nodes.findIndex(n => n.id === rfNode.id);
      const concept = nodes[index]!;
      const state = nodeState?.(concept) ?? 'available';
      return {
        ...rfNode,
        data: {
          concept,
          state,
          mastery: nodeMastery?.(concept),
          order: index + 1,
          highlighted: rfNode.id === highlightNodeId,
          readOnly,
          onDelete: onNodeDelete ? () => onNodeDelete(concept) : undefined,
        } satisfies ConceptNodeData,
      };
    });
    return { nodes: decorated, edges: laidOut.edges };
  }, [nodes, edges, highlightNodeId, nodeState, nodeMastery, readOnly, onNodeDelete]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, rfNode: Node) => {
      if (readOnly || !onNodeClick) return;
      const data = rfNode.data as ConceptNodeData;
      if (data.state === 'locked') return;
      onNodeClick(data.concept);
    },
    [onNodeClick, readOnly],
  );

  return (
    <div className={`flex flex-col ${className ?? 'h-[420px] w-full'}`}>
      {showLegend && (
        <div className="flex flex-wrap items-center gap-4 border-b border-border/40 bg-muted/20 px-3 py-1.5">
          {LEGEND_ITEMS.map(item => (
            <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {item.icon}
              {item.label}
            </span>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={24} size={1.5} />
          <Controls showInteractive={false} />
          {nodes.length > 8 && (
            <MiniMap
              pannable
              zoomable
              className="!h-24 !w-36 rounded-lg border border-border/40"
              nodeColor={(n) => MINIMAP_COLORS[(n.data as ConceptNodeData | undefined)?.state ?? 'available']}
              nodeBorderRadius={8}
            />
          )}
        </ReactFlow>
      </div>
    </div>
  );
}
