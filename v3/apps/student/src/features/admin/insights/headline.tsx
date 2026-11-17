import { StatStrip } from '../studio-ui';

import { days, hours } from './format';
import { TrendBadge } from './trend';
import type { CourseInsights, Metric } from './types';

const show = (m: Metric, f: (n: number) => string) =>
  m.current == null ? '–' : f(m.current);

/** The six headline figures, each with its change against the previous period. */
export function Headline({
  headline,
}: {
  headline: NonNullable<CourseInsights['headline']>;
}) {
  const num = (n: number) => n.toLocaleString();
  const pct = (n: number) => `${Math.round(n)}%`;
  const pts = (n: number) => `${Math.round(n)} pts`;
  const d = (n: number) => days(n);
  return (
    <StatStrip
      layout="grid"
      stats={[
        {
          label: 'Students',
          value: show(headline.students, num),
          trend: <TrendBadge metric={headline.students} />,
        },
        {
          label: 'Active this week',
          value: show(headline.activeThisWeek, num),
          trend: <TrendBadge metric={headline.activeThisWeek} />,
        },
        {
          label: 'Average progress',
          value: show(headline.averageProgress, pct),
          trend: <TrendBadge metric={headline.averageProgress} format={pts} />,
        },
        {
          label: 'Finished',
          value: show(headline.finished, num),
          trend: <TrendBadge metric={headline.finished} />,
        },
        {
          label: 'Median time to finish',
          value: show(headline.medianDaysToFinish, d),
          trend: (
            <TrendBadge
              metric={headline.medianDaysToFinish}
              format={d}
              lowerIsBetter
            />
          ),
        },
        {
          label: 'Learning hours',
          value: show(headline.learningHours, hours),
          trend: <TrendBadge metric={headline.learningHours} format={hours} />,
        },
      ]}
    />
  );
}
