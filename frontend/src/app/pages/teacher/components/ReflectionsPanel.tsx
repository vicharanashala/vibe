import {Loader2} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Badge} from '@/components/ui/badge';
import {
  useInstructorReflectionStats,
  useInstructorReflections,
} from '@/hooks/peer-review-hooks';
import {cn} from '@/utils/utils';

interface ReflectionsPanelProps {
  courseId: string;
  courseVersionId: string;
  /** Optional: narrow every figure on the panel to one reflection item. */
  itemId?: string;
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Instructor view of peer-reviewed reflections for a course version.
 *
 * The column that earns its place here is the confidence gap: a student who
 * rated themselves highly and was scored low by peers is the one to intervene
 * with, and that pairing is invisible in either number on its own.
 */
export default function ReflectionsPanel({
  courseId,
  courseVersionId,
  itemId,
}: ReflectionsPanelProps) {
  const {items, isLoading} = useInstructorReflections(
    courseId,
    courseVersionId,
    itemId,
  );
  const {data: stats} = useInstructorReflectionStats(
    courseId,
    courseVersionId,
    itemId,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading reflections
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Reflections"
          value={String(stats?.reflectionCount ?? 0)}
        />
        <StatTile label="Peer reviews" value={String(stats?.reviewCount ?? 0)} />
        <StatTile
          label="Average peer score"
          value={
            stats?.averageScore != null ? stats.averageScore.toFixed(1) : '—'
          }
          hint={`${stats?.scoredCount ?? 0} scored`}
        />
        <StatTile
          label="Average self-rating"
          value={
            stats?.averageConfidence != null
              ? stats.averageConfidence.toFixed(1)
              : '—'
          }
        />
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No reflections have been submitted yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Reflection</TableHead>
                <TableHead className="w-20 text-right">Self</TableHead>
                <TableHead className="w-24 text-right">Peer avg</TableHead>
                <TableHead className="w-20 text-right">Gap</TableHead>
                <TableHead className="w-28 text-right">Reviews</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.reflectionId}>
                  <TableCell className="align-top">
                    <p className="text-sm font-medium leading-tight">
                      {item.studentName}
                    </p>
                    {item.studentEmail ? (
                      <p className="text-xs text-muted-foreground">
                        {item.studentEmail}
                      </p>
                    ) : null}
                  </TableCell>

                  <TableCell className="max-w-md align-top">
                    <p className="line-clamp-2 text-sm">{item.text}</p>
                    {item.helpfulCount > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {item.helpfulCount} found this helpful
                      </span>
                    ) : null}
                  </TableCell>

                  <TableCell className="text-right align-top tabular-nums">
                    {item.confidence}
                  </TableCell>

                  <TableCell className="text-right align-top tabular-nums">
                    {item.averageScore != null ? (
                      <>
                        {item.averageScore.toFixed(1)}
                        {item.isProvisional ? (
                          <span
                            className="ml-1 text-xs text-muted-foreground"
                            title="Fewer reviews than the reveal threshold — the student cannot see this yet"
                          >
                            *
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right align-top">
                    {item.confidenceGap == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant={
                          item.confidenceGap >= 3 ? 'destructive' : 'secondary'
                        }
                        className={cn('tabular-nums')}
                      >
                        {item.confidenceGap > 0
                          ? `+${item.confidenceGap}`
                          : item.confidenceGap}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right align-top text-xs tabular-nums text-muted-foreground">
                    <div>got {item.reviewsReceived}</div>
                    <div>gave {item.reviewsGiven}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Gap is the student's self-rating minus their peer average — a large
        positive gap flags overconfidence, usually the most useful place to step
        in. An asterisk marks an average resting on fewer reviews than the reveal
        threshold, so the student cannot see it yet.
      </p>
    </div>
  );
}
