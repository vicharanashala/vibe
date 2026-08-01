import { BaseEdge, type EdgeProps } from '@xyflow/react';

interface RadialCurveData {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  cx: number;
  cy: number;
}

/**
 * A quadratic-bezier curve between two points precomputed in layout.ts
 * (radial hub layout only). Using our own geometry — rather than react-flow's
 * handle-direction-based curvature — is what lets the curve start/end
 * exactly on each box's edge and bow around the centre, regardless of which
 * direction the other node happens to be in.
 */
export function RadialCurveEdge({
  data,
  style,
  markerEnd,
  label,
  labelStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const d = data as RadialCurveData | undefined;
  if (!d) return null;
  const path = `M ${d.sx} ${d.sy} Q ${d.cx} ${d.cy} ${d.tx} ${d.ty}`;
  // Point on the quadratic bezier at t=0.5.
  const labelX = 0.25 * d.sx + 0.5 * d.cx + 0.25 * d.tx;
  const labelY = 0.25 * d.sy + 0.5 * d.cy + 0.25 * d.ty;
  return (
    <BaseEdge
      path={path}
      style={style}
      markerEnd={markerEnd}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelShowBg
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  );
}
