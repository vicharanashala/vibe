import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

import { ChartPanel } from './chart-panel';
import { count } from './format';
import type { CourseInsights, ProgressBand } from './types';

const BAND_LABELS: Record<ProgressBand, string> = {
  '0': 'Not started',
  '1-24': '1–24%',
  '25-49': '25–49%',
  '50-74': '50–74%',
  '75-99': '75–99%',
  finished: 'Finished',
};
const BAND_ORDER: ProgressBand[] = ['0', '1-24', '25-49', '50-74', '75-99', 'finished'];

const bandsConfig = { students: { label: 'Students', color: 'var(--chart-1)' } } satisfies ChartConfig;

/** How far students have got, in bands. */
export function ProgressBands({ bands }: { bands: NonNullable<CourseInsights['progressBands']> }) {
  const data = BAND_ORDER.map((band) => ({
    band,
    label: BAND_LABELS[band],
    students: bands.find((b) => b.band === band)?.students ?? 0,
  }));
  const total = data.reduce((s, d) => s + d.students, 0);
  const notStarted = data[0].students;
  const finished = data[5].students;
  return (
    <ChartPanel
      title="Progress"
      summary={
        total
          ? `${count(finished, 'student')} finished and ${notStarted.toLocaleString()} haven’t started, out of ${total.toLocaleString()}.`
          : 'No students yet.'
      }
      table={{ caption: 'Students by progress', columns: ['Progress', 'Students'], rows: data.map((d) => [d.label, d.students]) }}
    >
      <ChartContainer config={bandsConfig} className="aspect-auto h-52 w-full">
        <BarChart data={data} margin={{ top: 20, left: 4, right: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={11} />
          <YAxis hide allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
          <Bar dataKey="students" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.band} fill={d.band === 'finished' ? 'var(--chart-3)' : d.band === '0' ? 'var(--muted-foreground)' : 'var(--color-students)'} fillOpacity={d.band === '0' ? 0.35 : 1} />
            ))}
            <LabelList dataKey="students" position="top" className="fill-foreground" fontSize={11} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export interface FunnelDrop {
  /** Index of the module students were lost after. */
  from: number;
  lost: number;
}

/** The largest fall from "finished module i" to "reached module i+1", if any students were lost. */
export function biggestDrop(funnel: { reached: number; completed: number }[]): FunnelDrop | null {
  let best: FunnelDrop | null = null;
  for (let i = 0; i + 1 < funnel.length; i++) {
    const lost = funnel[i].completed - funnel[i + 1].reached;
    if (lost > 0 && (!best || lost > best.lost)) best = { from: i, lost };
  }
  return best;
}

const funnelConfig = {
  reached: { label: 'Reached', color: 'color-mix(in oklch, var(--chart-1) 35%, transparent)' },
  completed: { label: 'Finished', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Module by module: how many students reached it and how many finished it. */
export function ModuleFunnel({ funnel }: { funnel: NonNullable<CourseInsights['funnel']> }) {
  const drop = biggestDrop(funnel);
  const data = funnel.map((m, i) => ({ ...m, label: `${i + 1}. ${m.name}` }));
  return (
    <ChartPanel
      title="Module by module"
      summary={
        drop
          ? `The biggest drop is after “${funnel[drop.from].name}”: ${count(drop.lost, 'student')} finished it but haven’t reached “${funnel[drop.from + 1].name}”.`
          : funnel.length
            ? 'No module loses students on the way to the next.'
            : 'This course has no modules yet.'
      }
      table={{
        caption: 'Students who reached and finished each module',
        columns: ['Module', 'Reached', 'Finished'],
        rows: data.map((m) => [m.label, m.reached, m.completed]),
      }}
    >
      {drop && (
        <p
          className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-300"
          data-testid="funnel-drop"
        >
          −{drop.lost.toLocaleString()} between module {drop.from + 1} and module {drop.from + 2}
        </p>
      )}
      <ChartContainer config={funnelConfig} className="aspect-auto w-full" style={{ height: Math.max(120, data.length * 44 + 24) }}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36 }} barGap={2} accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={120}
            fontSize={11}
            tickFormatter={(v: string) => truncate(v, 18)}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="reached" fill="var(--color-reached)" radius={4} barSize={12}>
            {data.map((m, i) => (
              <Cell
                key={m.moduleId}
                fill={drop && i === drop.from + 1 ? 'color-mix(in oklch, var(--color-rose-500, #f43f5e) 45%, transparent)' : 'var(--color-reached)'}
              />
            ))}
            <LabelList dataKey="reached" position="right" className="fill-muted-foreground" fontSize={10} />
          </Bar>
          <Bar dataKey="completed" fill="var(--color-completed)" radius={4} barSize={12}>
            <LabelList dataKey="completed" position="right" className="fill-foreground" fontSize={10} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}
