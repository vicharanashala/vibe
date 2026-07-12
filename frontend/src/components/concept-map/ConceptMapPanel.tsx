import { useCallback, useMemo } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from 'next-themes';
import { ConceptNode, type ConceptNodeData } from './ConceptNode';
import { layoutConceptMap } from './layout';
import type { ConceptMapPanelProps } from './types';

const nodeTypes: NodeTypes = { concept: ConceptNode };

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
  onNodeClick,
  readOnly = false,
  className,
}: ConceptMapPanelProps) {
  const { resolvedTheme } = useTheme();

  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const laidOut = layoutConceptMap(nodes, edges);
    const decorated = laidOut.nodes.map(rfNode => {
      const concept = nodes.find(n => n.id === rfNode.id)!;
      const state = nodeState?.(concept) ?? 'available';
      return {
        ...rfNode,
        data: {
          concept,
          state,
          highlighted: rfNode.id === highlightNodeId,
          readOnly,
        } satisfies ConceptNodeData,
      };
    });
    return { nodes: decorated, edges: laidOut.edges };
  }, [nodes, edges, highlightNodeId, nodeState, readOnly]);

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
    <div className={className ?? 'h-[340px] w-full'}>
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
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
