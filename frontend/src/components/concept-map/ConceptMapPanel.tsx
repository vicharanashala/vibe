import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type EdgeTypes,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from 'next-themes';
import { CheckCircle2, AlertTriangle, Lock, MapPin } from 'lucide-react';
import { ConceptNode, type ConceptNodeData } from './ConceptNode';
import { RadialCurveEdge } from './RadialCurveEdge';
import { layoutConceptMap } from './layout';
import { categoryColor } from './palette';
import type { ConceptMapPanelProps } from './types';

const nodeTypes: NodeTypes = { concept: ConceptNode };
const edgeTypes: EdgeTypes = { radialCurve: RadialCurveEdge };

const LEGEND_ITEMS = [
  { icon: <MapPin className="h-3.5 w-3.5 text-primary" />, label: 'Current' },
  { icon: <Lock className="h-3.5 w-3.5 text-muted-foreground" />, label: 'Upcoming' },
  { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, label: 'Mastered' },
  { icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />, label: 'Revisit' },
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
  nodeScore,
  onNodeClick,
  onNodeDelete,
  readOnly = false,
  showLegend = false,
  className,
}: ConceptMapPanelProps) {
  const { resolvedTheme } = useTheme();
  // Focus mode: hovering a node spotlights it, its neighbours, and the
  // linking phrases between them; everything else fades back.
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const isDark = resolvedTheme === 'dark';

  // Layout (dagre / radial-hub trig) only depends on the graph shape, not on
  // hover state — memoized separately so mousing over a node (which only
  // toggles dimming/animation) never re-runs the layout algorithm.
  const laidOut = useMemo(() => layoutConceptMap(nodes, edges), [nodes, edges]);
  const nodeIndex = useMemo(
    () => new Map(nodes.map((n, i) => [n.id, i])),
    [nodes],
  );

  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const inFocus = new Set<string>();
    if (focusedId) {
      inFocus.add(focusedId);
      for (const e of edges) {
        if (e.from === focusedId) inFocus.add(e.to);
        if (e.to === focusedId) inFocus.add(e.from);
      }
    }
    const decorated = laidOut.nodes.map(rfNode => {
      const index = nodeIndex.get(rfNode.id) ?? 0;
      const concept = nodes[index]!;
      const state = nodeState?.(concept) ?? 'available';
      return {
        ...rfNode,
        data: {
          concept,
          state,
          score: nodeScore?.(concept),
          order: index + 1,
          categoryColor: categoryColor(index, isDark),
          highlighted: rfNode.id === highlightNodeId,
          dimmed: focusedId !== null && !inFocus.has(rfNode.id),
          readOnly,
          onDelete: onNodeDelete ? () => onNodeDelete(concept) : undefined,
        } satisfies ConceptNodeData,
      };
    });
    const decoratedEdges = laidOut.edges.map(rfEdge => {
      // Bold, colored edges (matching the target concept's own color) so the
      // map reads as a set of connected ideas, not gray wiring.
      const color = categoryColor(nodeIndex.get(rfEdge.target) ?? 0, isDark);
      const colored = {
        ...rfEdge,
        style: { ...rfEdge.style, stroke: color },
        markerEnd: typeof rfEdge.markerEnd === 'object' ? { ...rfEdge.markerEnd, color } : rfEdge.markerEnd,
        labelStyle: { ...rfEdge.labelStyle, fill: color },
      };
      if (!focusedId) return colored;
      const incident =
        rfEdge.source === focusedId || rfEdge.target === focusedId;
      return incident
        ? {
            ...colored,
            animated: true,
            style: { ...colored.style, strokeWidth: 3 },
          }
        : {
            ...colored,
            style: { ...colored.style, opacity: 0.12 },
            labelStyle: { ...colored.labelStyle, opacity: 0.12 },
            labelBgStyle: { opacity: 0.12 },
          };
    });
    return { nodes: decorated, edges: decoratedEdges };
  }, [laidOut, nodes, edges, nodeIndex, highlightNodeId, nodeState, nodeScore, readOnly, onNodeDelete, focusedId, isDark]);

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
          edgeTypes={edgeTypes}
          colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={(_e, n) => setFocusedId(n.id)}
          onNodeMouseLeave={() => setFocusedId(null)}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 2.2 }}
          minZoom={0.3}
          maxZoom={2.2}
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
