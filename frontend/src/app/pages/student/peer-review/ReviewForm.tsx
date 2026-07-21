import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useSubmissionToReview,
  useSubmitPeerReviewScore,
} from "@/hooks/hooks";

/**
 * ReviewForm.
 *
 * Phase 4.2.5. Renders the submission to review (notes + links, blinded)
 * and per-criterion score inputs. Validation: every criterion must
 * have a score, score in 0..maxPoints. Submit posts to
 *   POST /peer-review-assignments/:id/review
 *
 * Double-blind: the server response payload only contains notes+links.
 * Even if a stray submitter identifier surfaced in the response, we
 * don't display it here.
 */

interface Props {
  assignmentId: string;
  onClose?: () => void;
}

interface ReviewerScore {
  criterionId: string;
  score: number | "";
  comment: string;
}

export function ReviewForm({ assignmentId, onClose }: Props) {
  const subHook = useSubmissionToReview(assignmentId);
  const submitHook = useSubmitPeerReviewScore();

  const [scores, setScores] = useState<ReviewerScore[]>([]);
  const [overallComment, setOverallComment] = useState("");

  useEffect(() => {
    if (subHook.data?.rubric && subHook.data.rubric.length > 0) {
      setScores(
        subHook.data.rubric.map((c: any) => ({
          criterionId: c.criterionId,
          score: "",
          comment: "",
        })),
      );
    }
  }, [subHook.data]);

  if (subHook.isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading submission...
      </div>
    );
  }
  if (subHook.error) {
    return (
      <div className="p-3 text-sm text-red-600 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Could not load the submission: {subHook.error}
      </div>
    );
  }
  const d = subHook.data;
  if (!d) return null;

  const rubric = d.rubric ?? [];
  const links = d.links ?? [];

  const allScored =
    scores.length === rubric.length &&
    scores.every((s) => typeof s.score === "number" && s.score >= 0);

  function setScoreAt(i: number, patch: Partial<ReviewerScore>) {
    setScores((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }

  async function onSubmit() {
    if (!allScored) {
      toast.error("Please score every criterion before submitting.");
      return;
    }
    try {
      await submitHook.mutateAsync({
        params: { path: { id: assignmentId } },
        body: {
          scores: scores.map((s) => ({
            criterionId: s.criterionId,
            score: s.score,
            comment: s.comment ?? "",
          })),
          overallComment,
        },
      });
      toast.success("Review submitted.");
      onClose?.();
    } catch (e: any) {
      toast.error(`Submit failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  // Defensive — never trust anything from the server to be a submission-side
  // identifier; explicit allow-list for what we render here.
  const safe = {
    assignmentId: d.assignmentId ?? assignmentId,
    notes: d.notes ?? "",
    links: links,
    rubric: rubric,
    dueAt: d.dueAt ?? null,
    submissionDeadline: d.submissionDeadline ?? null,
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 mt-2 bg-slate-50/40">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-base">
              Submission to review
            </CardTitle>
            <Badge variant="outline">Double-blind</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Notes</Label>
            <p className="text-sm whitespace-pre-wrap bg-white p-2 rounded border">
              {safe.notes || "(no notes provided)"}
            </p>
          </div>
          <div>
            <Label className="text-xs">Links ({safe.links.length})</Label>
            <div className="space-y-1">
              {safe.links.map((l: any, i: number) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-600 underline"
                >
                  {l.label || l.url}{" "}
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your scores</CardTitle>
          <p className="text-xs text-muted-foreground">
            Score each criterion between 0 and its maximum.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {rubric.map((c: any, i: number) => {
            const s = scores[i];
            return (
              <div key={c.criterionId} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="flex-1">
                    <Label>{c.label}</Label>
                    {c.description && (
                      <p className="text-xs text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Score / {c.maxPoints}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={c.maxPoints}
                      value={s?.score ?? ""}
                      onChange={(e) =>
                        setScoreAt(i, {
                          score:
                            e.target.value === ""
                              ? ""
                              : Math.max(
                                  0,
                                  Math.min(
                                    c.maxPoints,
                                    Number(e.target.value),
                                  ),
                                ),
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Comment (optional)</Label>
                  <Textarea
                    value={s?.comment ?? ""}
                    onChange={(e) =>
                      setScoreAt(i, { comment: e.target.value })
                    }
                    rows={2}
                    maxLength={2000}
                  />
                </div>
              </div>
            );
          })}
          <div>
            <Label>Overall comment</Label>
            <Textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              maxLength={5000}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose?.()}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!allScored || submitHook.isPending}
            >
              {submitHook.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {!submitHook.isPending && (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Submit review
            </Button>
          </div>
          {submitHook.error && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {submitHook.error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReviewForm;
