import React, { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetPeerReviewAssessment,
  useListPeerReviewSubmissions,
  useListPeerReviewReviews,
  useTeacherOverrideReview,
  useClosePeerReviewAssessment,
} from '@/hooks/hooks';

/**
 * Teacher manage page for a single peer-review assessment.
 *
 * Route: /teacher/peer-review/:assessmentId
 *
 * One-stop for the teacher to:
 *   - See assessment metadata (title, deadlines, rubric summary).
 *   - See all student submissions + their review status.
 *   - See all submitted reviews and the per-criterion scores.
 *   - Override any review (PATCH /peer-reviews/:id/teacher-override).
 *   - Close the assessment (POST /peer-review-assessments/:id/close).
 *
 * Backed entirely by existing backend endpoints; this page is the
 * missing UI glue the peer-review feature never had wired up.
 */
export function PeerReviewManagePage() {
  const { assessmentId } = useParams({ strict: false }) as {
    assessmentId?: string;
  };
  const navigate = useNavigate();

  const { data: assessment, isLoading: assessmentLoading } =
    useGetPeerReviewAssessment(assessmentId);
  const { data: submissions, isLoading: submissionsLoading, refetch: refetchSubmissions } =
    useListPeerReviewSubmissions(assessmentId);
  const { data: reviews, isLoading: reviewsLoading, refetch: refetchReviews } =
    useListPeerReviewReviews(assessmentId);

  const overrideHook = useTeacherOverrideReview();
  const closeHook = useClosePeerReviewAssessment();

  const [overrideTarget, setOverrideTarget] = useState<{
    reviewId: string;
    criterionId: string;
    currentScore: number;
    maxPoints: number;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideScore, setOverrideScore] = useState<number | ''>('');

  if (!assessmentId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No assessment id in URL.
      </div>
    );
  }
  if (assessmentLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading assessment…
      </div>
    );
  }
  if (!assessment) {
    return (
      <div className="p-6 text-sm text-destructive">
        Assessment not found.
      </div>
    );
  }

  const isClosed = Boolean((assessment as any).closedAt);
  const totalMax = (assessment as any).totalMaxPoints ?? 0;
  const rubric: any[] = (assessment as any).rubric ?? [];

  async function submitOverride() {
    if (!overrideTarget) return;
    if (overrideReason.trim().length < 20) {
      toast.error('Override reason must be at least 20 characters.');
      return;
    }
    try {
      await overrideHook.mutateAsync({
        params: { path: { id: overrideTarget.reviewId } },
        body: {
          scores: [
            {
              criterionId: overrideTarget.criterionId,
              score:
                overrideScore === ''
                  ? overrideTarget.currentScore
                  : Number(overrideScore),
            },
          ],
          reason: overrideReason,
        },
      });
      toast.success('Review overridden.');
      setOverrideTarget(null);
      setOverrideReason('');
      setOverrideScore('');
      refetchReviews();
      refetchSubmissions();
    } catch (e: any) {
      toast.error(`Override failed: ${e?.message ?? 'Unknown error'}`);
    }
  }

  async function closeAssessment() {
    if (!assessmentId) return;
    if (!confirm('Close this assessment? This stops the assignment runner and locks final scores.')) {
      return;
    }
    try {
      await closeHook.mutateAsync({ params: { path: { id: assessmentId } } });
      toast.success('Assessment closed.');
      refetchSubmissions();
    } catch (e: any) {
      toast.error(`Close failed: ${e?.message ?? 'Unknown error'}`);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/teacher' as any })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {isClosed && (
          <Badge variant="secondary" className="ml-2">
            Closed
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{(assessment as any).title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>{(assessment as any).description}</div>
          <div>
            <strong>Total max points:</strong> {totalMax}
          </div>
          <div>
            <strong>Submission deadline:</strong>{' '}
            {(assessment as any).submissionDeadline
              ? new Date((assessment as any).submissionDeadline).toLocaleString()
              : '—'}
          </div>
          <div>
            <strong>Review deadline:</strong>{' '}
            {(assessment as any).reviewDeadline
              ? new Date((assessment as any).reviewDeadline).toLocaleString()
              : '—'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submissions ({submissions?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {submissionsLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!submissionsLoading && (submissions?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground">
              No submissions yet.
            </div>
          )}
          {!submissionsLoading && (submissions?.length ?? 0) > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Final Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions!.map((s: any) => (
                  <TableRow key={s.submissionId}>
                    <TableCell className="font-mono text-xs">
                      {s.studentId}
                    </TableCell>
                    <TableCell>
                      {s.submittedAt
                        ? new Date(s.submittedAt).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {s.isLate ? (
                        <Badge variant="destructive">Late</Badge>
                      ) : (
                        <Badge variant="default">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          On time
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.reviewsCompleted}/{s.reviewsTotal}
                    </TableCell>
                    <TableCell>
                      {s.finalScore != null
                        ? `${s.finalScore} / ${totalMax}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviews ({reviews?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewsLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!reviewsLoading && (reviews?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground">
              No reviews yet.
            </div>
          )}
          {!reviewsLoading &&
            (reviews?.length ?? 0) > 0 &&
            reviews!.map((r: any) => (
              <div
                key={r.reviewId}
                className="border-b last:border-b-0 py-3 space-y-2"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Reviewer: <span className="font-mono">{r.reviewerId}</span></span>
                  <span>·</span>
                  <span>Submission: <span className="font-mono">{r.submissionId}</span></span>
                  <span>·</span>
                  <span>Submitted: {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</span>
                  {r.teacherOverridden && (
                    <Badge variant="secondary" className="ml-2">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Overridden
                    </Badge>
                  )}
                </div>
                <div className="text-sm">
                  <strong>Total:</strong> {r.totalScore} / {totalMax}
                </div>
                {(r.scores ?? []).map((sc: any) => {
                  const crit = rubric.find(
                    (c: any) =>
                      (c._id?.toString?.() ?? c.criterionId) === sc.criterionId,
                  );
                  const label = crit?.label ?? sc.criterionId;
                  const max = sc.maxPoints ?? crit?.maxPoints ?? 0;
                  return (
                    <div
                      key={sc.criterionId}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="flex-1">{label}</span>
                      <span className="font-mono">
                        {sc.score} / {max}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isClosed}
                        onClick={() => {
                          setOverrideTarget({
                            reviewId: r.reviewId,
                            criterionId: sc.criterionId,
                            currentScore: sc.score,
                            maxPoints: max,
                          });
                          setOverrideScore(sc.score);
                          setOverrideReason('');
                        }}
                      >
                        Override
                      </Button>
                    </div>
                  );
                })}
                {r.overallComment && (
                  <div className="text-sm text-muted-foreground italic">
                    "{r.overallComment}"
                  </div>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      {overrideTarget && (
        <Card>
          <CardHeader>
            <CardTitle>Override review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              Current score: {overrideTarget.currentScore} /{' '}
              {overrideTarget.maxPoints}
            </div>
            <div>
              <Label>New score</Label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-32 ml-2"
                min={0}
                max={overrideTarget.maxPoints}
                value={overrideScore}
                onChange={(e) =>
                  setOverrideScore(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
              />
            </div>
            <div>
              <Label>Reason (≥ 20 chars)</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why are you overriding this score? (visible to student)"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setOverrideTarget(null);
                  setOverrideReason('');
                  setOverrideScore('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={submitOverride}
                disabled={overrideHook.isPending}
              >
                {overrideHook.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                Submit override
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isClosed && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={closeAssessment}
            disabled={closeHook.isPending}
          >
            {closeHook.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            )}
            Close assessment
          </Button>
        </div>
      )}
    </div>
  );
}

export default PeerReviewManagePage;