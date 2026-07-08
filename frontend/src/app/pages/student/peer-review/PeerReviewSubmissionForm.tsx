import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, X, AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  useSubmitPeerReview,
  useMySubmission,
  useCheckPeerReviewLink,
} from "@/hooks/hooks";

/**
 * Student-side submission form for a peer-review assessment item.
 *
 * Phase 3 + Phase 7 audit-improvement. Renders inside the student's
 * course-tree view when item type === 'PEER_REVIEW_ASSESSMENT'.
 *
 *  - 1..20 Drive-style links (kind auto-detected from URL host).
 *  - Re-editable up until the deadline (idempotent on the server).
 *  - Status pill: 'Not submitted' / 'Submitted on time' /
 *    'Submitted late' / 'Past deadline' / 'Saving...'
 *  - Phase 7: live accessibility badge per link. Each link row
 *    debounces the URL by 500ms then hits GET /peer-review-links/check
 *    to surface a green check or a red x with reason. The backend
 *    caches results for 60s, so a flurry of edits is cheap.
 */

interface Props {
  courseId: string;
  versionId: string;
  itemId: string;
  assessment: any;
  submissionDeadline?: Date;
}

interface StudentLink {
  url: string;
  label: string;
  kind?: "drive" | "github" | "youtube" | "oneDrive" | "dropbox" | "other";
}

const EMPTY_LINK: StudentLink = { url: "", label: "", kind: undefined };

// 500ms debounce hook (Phase 7 audit improvement).
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function LinkAccessibilityBadge({ url }: { url: string }) {
  const debounced = useDebounced(url, 500);
  const check = useCheckPeerReviewLink(debounced);
  if (!debounced || debounced.trim().length === 0) {
    return null;
  }
  if (check.isLoading) {
    return (
      <span className="text-xs text-slate-500 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking...
      </span>
    );
  }
  if (!check.data) return null;
  if (check.data.accessible) {
    return (
      <span className="text-xs text-emerald-600 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Publicly accessible
      </span>
    );
  }
  const reasonText: Record<string, string> = {
    http_401: 'Requires sign-in (401)',
    http_403: 'Forbidden (403)',
    http_404: 'Not found (404)',
    http_5xx: 'Server error (5xx)',
    auth_required: 'Drive link is private',
    timeout: 'Request timed out',
    dns_failure: 'DNS lookup failed',
    connection_refused: 'Connection refused',
    invalid_url: 'Invalid URL',
  };
  const reason = reasonText[check.data.reason ?? ''] ?? (check.data.reason ?? 'Not accessible');
  return (
    <span className="text-xs text-red-600 flex items-center gap-1" title={reason}>
      <AlertCircle className="h-3 w-3" />
      {reason}
    </span>
  );
}

export function PeerReviewSubmissionForm({
  courseId,
  versionId,
  itemId,
  assessment,
  submissionDeadline,
}: Props) {
  const submitHook = useSubmitPeerReview();
  const submissionQuery = useMySubmission(assessment?._id || assessment?.assessmentId);
  const existing = submissionQuery.data;

  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [links, setLinks] = useState<StudentLink[]>(
    existing?.links?.length
      ? existing.links.map((l: any) => ({ url: l.url, label: l.label, kind: l.kind }))
      : [EMPTY_LINK],
  );

  useEffect(() => {
    if (existing) {
      setNotes(existing.notes ?? "");
      setLinks(
        existing.links?.length
          ? existing.links.map((l: any) => ({ url: l.url, label: l.label, kind: l.kind }))
          : [EMPTY_LINK],
      );
    }
  }, [existing]);

  const deadline = useMemo(() => {
    if (submissionDeadline) return submissionDeadline;
    if (assessment?.submissionDeadline) return new Date(assessment.submissionDeadline);
    return null;
  }, [submissionDeadline, assessment]);
  const isPast = deadline ? new Date() > deadline : false;

  function setLinkAt(i: number, patch: Partial<StudentLink>) {
    setLinks(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLink() {
    if (links.length >= 20) {
      toast.error("At most 20 links allowed.");
      return;
    }
    setLinks([...links, EMPTY_LINK]);
  }
  function removeLink(i: number) {
    setLinks(prev => prev.filter((_, idx) => idx !== i));
  }

  const valid =
    !isPast &&
    links.length >= 1 &&
    links.every(l => l.url.trim().length > 0 && l.label.trim().length > 0);

  async function onSave() {
    if (!valid) {
      toast.error("Add at least one link (url + label) before submitting.");
      return;
    }
    try {
      await submitHook.mutateAsync({
        params: { path: { courseId, versionId, itemId } },
        body: {
          notes,
          links: links.map(l => ({
            url: l.url.trim(),
            label: l.label.trim(),
            kind: l.kind,
          })),
        },
      });
      toast.success(existing ? "Submission updated." : "Submission saved.");
      submissionQuery.refetch();
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  let status = "Not submitted";
  if (submitHook.isPending) status = "Saving...";
  else if (existing) status = existing.isLate ? "Submitted late" : "Submitted on time";
  else if (isPast) status = "Past deadline";
  const statusColor =
    status === "Submitted on time" ? "text-emerald-600" :
    status === "Submitted late" ? "text-amber-600" :
    status === "Past deadline" ? "text-red-600" :
    status === "Saving..." ? "text-blue-600" :
    "text-slate-500";

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{assessment?.title ?? "Peer-Review Assessment"}</CardTitle>
          <p className={`text-sm font-medium ${statusColor}`}>Status: {status}</p>
        </CardHeader>
        {assessment?.description && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {assessment.description}
            </p>
          </CardContent>
        )}
      </Card>

      {assessment?.rubric && assessment.rubric.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rubric</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {assessment.rubric.map((c: any, i: number) => (
                <li key={i} className="flex justify-between border-b pb-1 last:border-0">
                  <span>
                    {c.label}
                    {c.description && (
                      <span className="text-muted-foreground"> — {c.description}</span>
                    )}
                  </span>
                  <span className="font-mono text-xs">/ {c.maxPoints}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notes (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={5000}
            placeholder="Anything your reviewers should know about your submission..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">{notes.length} / 5000</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your submission links</CardTitle>
          <p className="text-xs text-muted-foreground">
            Paste one or more public links (Drive / GitHub / etc.). Each link is
            checked for public accessibility as you paste.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {links.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <Label>Label</Label>
                <Input
                  value={l.label}
                  onChange={e => setLinkAt(i, { label: e.target.value })}
                  maxLength={200}
                  placeholder="e.g. Project Report v2"
                />
              </div>
              <div className="col-span-6">
                <Label>URL</Label>
                <Input
                  value={l.url}
                  onChange={e => setLinkAt(i, { url: e.target.value })}
                  maxLength={2000}
                  placeholder="https://drive.google.com/file/d/.../view"
                />
                <div className="mt-1">
                  <LinkAccessibilityBadge url={l.url} />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLink(i)}
                aria-label={`Remove link ${i + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addLink}
            className="w-full"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Add link
          </Button>
          {!valid && !isPast && (links.length === 0 || links.some(l => !l.url.trim() || !l.label.trim())) && (
            <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
              <AlertCircle className="h-4 w-4" />
              Every link needs both a label and a URL.
            </p>
          )}
          {isPast && (
            <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
              <AlertCircle className="h-4 w-4" />
              The submission deadline has passed ({deadline?.toLocaleString()}).
            </p>
          )}
        </CardContent>
      </Card>

      {assessment?.instructorAttachments && assessment.instructorAttachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reference materials from your teacher</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assessment.instructorAttachments.map((a: any, i: number) => (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline block"
              >
                {a.name} <span className="text-xs text-muted-foreground">({a.kind})</span>
                <ExternalLink className="h-3 w-3 inline ml-1" />
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {submitHook.error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {submitHook.error}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          onClick={onSave}
          disabled={!valid || submitHook.isPending}
        >
          {submitHook.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {!submitHook.isPending && existing && <CheckCircle2 className="h-4 w-4 mr-2" />}
          {existing ? "Update submission" : "Submit"}
        </Button>
      </div>
    </div>
  );
}

export default PeerReviewSubmissionForm;
