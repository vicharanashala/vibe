import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectSubmissions, useReviewProjectSubmission, ProjectSubmissionUserInfo } from '@/hooks/hooks';
import { toast } from 'sonner';

interface RowWithExtras extends ProjectSubmissionUserInfo {
  submissionId?: string;
  cohortName?: string;
  submittedAt?: string;
  reviewedAt?: string;
  feedback?: string;
  grade?: string;
}

function ReviewDialog({
  row,
  onClose,
  onSaved,
}: {
  row: RowWithExtras;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [feedback, setFeedback] = useState(row.feedback ?? '');
  const [grade, setGrade] = useState(row.grade ?? '');
  const { mutateAsync: reviewSubmission, isPending } = useReviewProjectSubmission();

  const handleSave = async () => {
    if (!row.submissionId) return;
    try {
      await reviewSubmission({ submissionId: row.submissionId, body: { feedback, grade } });
      toast.success('Review saved');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save review');
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Review — {row.firstName} {row.lastName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Submission link</p>
            <a
              href={row.submissionURL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline break-all"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              {row.submissionURL}
            </a>
          </div>
          {row.comment && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Student comment</p>
              <p className="text-sm rounded bg-muted/40 p-2">{row.comment}</p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="grade">Grade / Status</Label>
            <Input
              id="grade"
              placeholder="e.g. Pass, Fail, A, Needs Revision"
              value={grade}
              onChange={e => setGrade(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feedback">Feedback</Label>
            <Textarea
              id="feedback"
              placeholder="Write feedback for the student…"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending || !row.submissionId}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectSubmissionsTable({
  courseId,
  versionId,
  cohortId,
}: {
  courseId: string;
  versionId: string;
  cohortId?: string;
}) {
  const { data, isLoading, refetch } = useProjectSubmissions(courseId, versionId, cohortId);
  const [reviewing, setReviewing] = useState<RowWithExtras | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const rows = (data?.userInfo ?? []) as RowWithExtras[];

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        No submissions yet.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Submission</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Submitted</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Grade</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, i) => (
              <tr key={row.submissionId ?? i} className="bg-card hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">
                  {row.firstName} {row.lastName}
                  {row.cohortName && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({row.cohortName})</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.email}</td>
                <td className="px-4 py-3 max-w-xs">
                  <a
                    href={row.submissionURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline truncate"
                    title={row.submissionURL}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{row.submissionURL}</span>
                  </a>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {row.grade ? (
                    <Badge variant="secondary">{row.grade}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.reviewedAt ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Reviewed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setReviewing(row)}
                  >
                    {row.reviewedAt ? 'Edit Review' : 'Review'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reviewing && (
        <ReviewDialog
          row={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => refetch()}
        />
      )}
    </>
  );
}
