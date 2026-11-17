import { useId, type ReactNode } from 'react';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A chart's figures as a table only screen readers see. */
export function SrTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    // sr-only on the <table> itself doesn't stop it widening the page; on a wrapper it does.
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {v}
                  </th>
                ) : (
                  <td key={j}>{v}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One chart or list on the Overview: a titled card whose main takeaway is a
 * short sentence (visible, and the chart's accessible description), plus an
 * optional screen-reader table of the chart's data.
 */
export function ChartPanel({
  title,
  summary,
  action,
  table,
  children,
  className,
}: {
  title: string;
  /** The one-sentence takeaway. Also describes the chart to assistive technology. */
  summary: ReactNode;
  action?: ReactNode;
  /** The chart's figures as rows, read by screen readers instead of the drawing. */
  table?: { caption: string; columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <Card
      size="sm"
      className={cn('min-w-0 gap-3 rounded-2xl bg-card sm:py-5', className)}
      role="figure"
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
    >
      <CardHeader className="gap-0.5 sm:px-5">
        <CardTitle id={`${id}-t`} className="text-sm font-semibold">
          {title}
        </CardTitle>
        <CardDescription id={`${id}-d`} className="text-xs leading-5">
          {summary}
        </CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="sm:px-5">
        {children}
        {table && <SrTable {...table} />}
      </CardContent>
    </Card>
  );
}
