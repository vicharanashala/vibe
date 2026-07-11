import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useReviewsReceived, useMySubmission } from "@/hooks/hooks";

/**
 * MyScore.
 *
 * Phase 4.2.5. Lists the student's own submissions + the reviews
 * received. Until all reviews are in, the reviews-shown block is
 * anonymized (zero identifying data per review).
 *
 * Double-blind guarantees rendered here:
 *   - review.reviewerId NEVER shown (allow-list at the controller already
 *     strips it, but the UI also never reads it)
 *   - review.reviewerName / review.reviewerEmail NEVER shown
 *   - we only show review.scores + review.overallComment (safe fields)
 */

interface Props {
  /** Pass the assessment id to filter, or undefined to fetch all */
  assessmentId?: string;
}

export function MyScore({ assessmentId }: Props) {
  const reviewsHook = useReviewsReceived(assessmentId);
  const submissionHook = useMySubmission(assessmentId);

  if (reviewsHook.isLoading || submissionHook.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (reviewsHook.error) {
    return (
      <div className="p-6 text-red-600 flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Could not load your reviews: {reviewsHook.error}
      </div>
    );
  }

  const payload = (reviewsHook.data ?? { reviews: [], finalScore: null }) as any;
  const reviews: any[] = (payload.reviews ?? []).map((r: any) => ({
    // Allow-list mirror on the client. If a future server change adds
    // reviewer identity to the payload, the UI ignores it.
    _id: r._id,
    scores: r.scores ?? [],
    overallComment: r.overallComment ?? "",
    totalScore: r.totalScore ?? null,
    submittedAt: r.submittedAt ?? null,
    isLate: r.isLate ?? false,
    teacherOverridden: r.teacherOverridden ?? false,
  })) as any[];
  const finalScore = payload.finalScore ?? null;
  const submission = submissionHook.data as any | null | undefined;
  const reviewsCompleted = submission?.reviewsCompleted ?? 0;
  const reviewsTotal = submission?.reviewsTotal ?? 0;

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Star className="h-5 w-5" /> My peer-review grades
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Reviews are double-blind. We never show who reviewed you.
        </p>
      </div>

      {submission && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Submission status</CardTitle>
              {finalScore ? (
                <Badge variant="default" className="bg-emerald-600">
                  Final score: {finalScore}
                </Badge>
              ) : reviewsTotal > 0 ? (
                <Badge variant="outline">
                  {reviewsCompleted} of {reviewsTotal} reviews in
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {reviewsTotal === 0 ? (
              <p className="text-muted-foreground">
                No reviews expected yet.
              </p>
            ) : reviewsCompleted < reviewsTotal ? (
              <p className="text-muted-foreground">
                Your peer reviews are still being submitted. The final
                score will appear here once all {reviewsTotal} reviews
                are in.
              </p>
            ) : (
              <p className="text-muted-foreground">
                All reviews are in. Your grade is final.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="text-center text-muted-foreground py-8">
            No reviews yet for this assessment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r, i) => (
            <Card key={r._id ?? i}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">
                    Review #{i + 1}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {r.teacherOverridden && (
                      <Badge variant="destructive">
                        Teacher override
                      </Badge>
                    )}
                    {r.isLate && <Badge variant="secondary">Late</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Total score (this reviewer)
                  </span>
                  <span className="font-mono text-lg">
                    {r.totalScore ?? "—"}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Per-criterion scores
                  </p>
                  <ul className="text-sm space-y-0.5">
                    {(r.scores ?? []).map((s: any, j: number) => (
                      <li key={j} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {s.criterionId}
                        </span>
                        <span className="font-mono">{s.score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {r.overallComment && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Comment
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {r.overallComment}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyScore;
