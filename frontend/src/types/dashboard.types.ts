import { SectorProps } from 'recharts';
export type Task = {
  id: number;
  text: string;
  completed: boolean;
};

export interface ActiveShapeProps extends SectorProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: {
    name: string;
    value: number;
  };
  percent: number;
  value: number;
}

export interface ChartLabelProps {
  name: string;
  percent: number;
}

export interface DashboardSidebarProps {
  enrollments: Array<Record<string, unknown>>;
  className?: string;
}
