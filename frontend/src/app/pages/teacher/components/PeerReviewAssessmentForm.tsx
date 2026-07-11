import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useCreatePeerReviewAssessment,
  useUpdatePeerReviewAssessment,
} from "@/hooks/hooks";

/**
 * Teacher form for the peer-review assessment item type.
 *
 * Phase 2.2.4 deliverable. Renders inside the existing "Add item" flow
 * (mounted from teacher-course-page.tsx via the new dispatch branch).
 *
 * Sections:
 *   1. Title + description (also propagated to the underlying Item)
 *   2. Rubric builder (criteria with label + maxPoints; sum must be > 0)
 *   3. Submission deadline (datetime-local) + review window (days)
 *   4. Config knobs (late policy, late penalty %, teacher override, etc.)
 *   5. Save button → calls useCreatePeerReviewAssessment (or update if editing)
 *
 * The form is intentionally a single component (not split into sub-forms)
 * to keep Phase 2 shippable. Future v2 work: split into tabs, add
 * Drive-link accessibility preview, etc.
 */

interface RubricCriterion {
  label: string;
  description?: string;
  maxPoints: number;
}

interface InstructorAttachment {
  name: string;
  url: string;
  kind: 'drive' | 'github' | 'youtube' | 'oneDrive' | 'dropbox' | 'other';
}

interface Props {
  courseId: string;
  courseVersionId: string;
  moduleId: string;
  sectionId: string;
  cohortId: string;
  /** If provided, the form is in "edit" mode and updates the existing assessment. */
  existingAssessment?: any;
  onSaved?: (result: { assessmentId: string; itemId: string }) => void;
  onCancel?: () => void;
}

const DEFAULT_RUBRIC: RubricCriterion[] = [
  { label: 'Code Quality', maxPoints: 25 },
  { label: 'Functionality', maxPoints: 50 },
  { label: 'Documentation', maxPoints: 15 },
  { label: 'Creativity', maxPoints: 10 },
];

const DEFAULT_ATTACHMENT_KINDS: InstructorAttachment['kind'][] = [
  'drive', 'github', 'youtube', 'oneDrive', 'dropbox', 'other',
];

export function PeerReviewAssessmentForm({
  courseId,
  courseVersionId,
  moduleId,
  sectionId,
  cohortId,
  existingAssessment,
  onSaved,
  onCancel,
}: Props) {
  const isEdit = Boolean(existingAssessment);
  const createHook = useCreatePeerReviewAssessment();
  const updateHook = useUpdatePeerReviewAssessment();
  const isPending = isEdit ? updateHook.isPending : createHook.isPending;
  const error = isEdit ? updateHook.error : createHook.error;

  // Form state
  const [title, setTitle] = useState(existingAssessment?.title ?? 'Peer-Review Assessment');
  const [description, setDescription] = useState(existingAssessment?.description ?? '');
  const [itemName, setItemName] = useState(existingAssessment?.title ?? 'Peer-Review Assessment');
  const [itemDescription, setItemDescription] = useState(existingAssessment?.description ?? '');
  const [rubric, setRubric] = useState<RubricCriterion[]>(
    existingAssessment?.rubric ?? DEFAULT_RUBRIC,
  );
  const [submissionDeadline, setSubmissionDeadline] = useState(
    isoLocalFromDate(
      existingAssessment?.submissionDeadline
        ? new Date(existingAssessment.submissionDeadline)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ),
  );
  const [reviewWindowDays, setReviewWindowDays] = useState(
    existingAssessment?.config?.reviewWindowDays ?? 7,
  );
  const [teacherManualReviewEnabled, setTeacherManualReviewEnabled] = useState(
    existingAssessment?.config?.teacherManualReviewEnabled ?? true,
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    existingAssessment?.config?.notificationsEnabled ?? true,
  );
  const [latePolicy, setLatePolicy] = useState<'penalty-only' | 'hard-exclude'>(
    existingAssessment?.config?.latePolicy ?? 'penalty-only',
  );
  const [latePenaltyPercent, setLatePenaltyPercent] = useState(
    existingAssessment?.config?.latePenaltyPercent ?? 10,
  );
  const [antiCollusionMode, setAntiCollusionMode] = useState<'circular-shift-collision-check' | 'uniform-random'>(
    existingAssessment?.config?.antiCollusionMode ?? 'circular-shift-collision-check',
  );
  const [reviewsPerSubmission, setReviewsPerSubmission] = useState(
    existingAssessment?.config?.reviewsPerSubmission ?? 3,
  );
  const [reviewsPerReviewer, setReviewsPerReviewer] = useState(
    existingAssessment?.config?.reviewsPerReviewer ?? 3,
  );
  const [instructorAttachments, setInstructorAttachments] = useState<InstructorAttachment[]>(
    existingAssessment?.instructorAttachments ?? [],
  );

  // Validation summary
  const totalPoints = rubric.reduce((acc, c) => acc + (Number(c.maxPoints) || 0), 0);
  const valid =
    title.trim().length >= 3 &&
    itemName.trim().length >= 3 &&
    rubric.length >= 1 &&
    totalPoints > 0 &&
    reviewsPerSubmission === reviewsPerReviewer &&
    reviewWindowDays >= 1 &&
    reviewWindowDays <= 60 &&
    submissionDeadline !== '' &&
    new Date(submissionDeadline) > new Date();

  function addCriterion() {
    setRubric([...rubric, { label: '', maxPoints: 10 }]);
  }
  function removeCriterion(idx: number) {
    setRubric(rubric.filter((_, i) => i !== idx));
  }
  function updateCriterion(idx: number, patch: Partial<RubricCriterion>) {
    setRubric(rubric.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function addAttachment() {
    setInstructorAttachments([
      ...instructorAttachments,
      { name: '', url: '', kind: 'drive' },
    ]);
  }
  function removeAttachment(idx: number) {
    setInstructorAttachments(instructorAttachments.filter((_, i) => i !== idx));
  }
  function updateAttachment(idx: number, patch: Partial<InstructorAttachment>) {
    setInstructorAttachments(
      instructorAttachments.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    );
  }

  async function onSave() {
    if (!valid) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }
    const body: any = {
      title,
      description,
      itemName,
      itemDescription,
      instructorAttachments,
      rubric,
      submissionDeadline: new Date(submissionDeadline).toISOString(),
      reviewWindowDays,
      teacherManualReviewEnabled,
      notificationsEnabled,
      latePolicy,
      latePenaltyPercent,
      antiCollusionMode,
      reviewsPerSubmission,
      reviewsPerReviewer,
      cohortId,
      courseId,
      courseVersionId,
      moduleId,
      sectionId,
    };
    try {
      if (isEdit) {
        // Edit path: only the editable fields
        const editBody: any = {
          title,
          description,
          instructorAttachments,
          rubric,
          submissionDeadline: new Date(submissionDeadline).toISOString(),
          reviewWindowDays,
          teacherManualReviewEnabled,
          notificationsEnabled,
          latePolicy,
          latePenaltyPercent,
        };
        await updateHook.mutateAsync({
          params: { path: { id: existingAssessment.assessmentId } },
          body: editBody,
        });
        toast.success('Assessment updated.');
        onSaved?.({
          assessmentId: existingAssessment.assessmentId,
          itemId: existingAssessment.itemId,
        });
      } else {
        const result = await createHook.mutateAsync({ body });
        const assessmentId =
          result?.assessmentId ?? result?.assessmentId;
        const itemId = result?.itemId ?? result?.itemId;
        toast.success('Peer-review assessment created.');
        onSaved?.({ assessmentId, itemId });
      }
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message ?? 'Unknown error'}`);
    }
  }

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>1. Title & description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="title">Title (assessment)</Label>
            <Input
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="description">Description (assessment)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div>
            <Label htmlFor="itemName">Item name (course-tree display)</Label>
            <Input
              id="itemName"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="itemDescription">Item description</Label>
            <Textarea
              id="itemDescription"
              value={itemDescription}
              onChange={e => setItemDescription(e.target.value)}
              maxLength={2000}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Rubric (total: {totalPoints} points)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rubric.map((c, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Criterion {i + 1} label</Label>
                <Input
                  value={c.label}
                  onChange={e => updateCriterion(i, { label: e.target.value })}
                  maxLength={100}
                />
              </div>
              <div className="w-32">
                <Label>Max points</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={c.maxPoints}
                  onChange={e => updateCriterion(i, { maxPoints: Number(e.target.value) })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCriterion(i)}
                aria-label={`Remove criterion ${i + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addCriterion}
            className="w-full"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Add criterion
          </Button>
          {totalPoints <= 0 && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Rubric total points must be &gt; 0.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Deadlines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="submissionDeadline">Submission deadline</Label>
            <Input
              id="submissionDeadline"
              type="datetime-local"
              value={submissionDeadline}
              onChange={e => setSubmissionDeadline(e.target.value)}
            />
            {submissionDeadline && new Date(submissionDeadline) <= new Date() && (
              <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                <AlertCircle className="h-4 w-4" />
                Must be in the future.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="reviewWindowDays">Review window (days after submission deadline)</Label>
            <Input
              id="reviewWindowDays"
              type="number"
              min={1}
              max={60}
              value={reviewWindowDays}
              onChange={e => setReviewWindowDays(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="latePolicy">Late-submission policy</Label>
              <select
                id="latePolicy"
                className="border rounded h-9 px-2 w-full"
                value={latePolicy}
                onChange={e => setLatePolicy(e.target.value as any)}
              >
                <option value="penalty-only">Penalty only (default 10%)</option>
                <option value="hard-exclude">Hard-exclude from review pool</option>
              </select>
            </div>
            {latePolicy === 'penalty-only' && (
              <div>
                <Label htmlFor="latePenaltyPercent">Late penalty (%)</Label>
                <Input
                  id="latePenaltyPercent"
                  type="number"
                  min={0}
                  max={100}
                  value={latePenaltyPercent}
                  onChange={e => setLatePenaltyPercent(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="antiCollusionMode">Reviewer-assignment algorithm</Label>
              <select
                id="antiCollusionMode"
                className="border rounded h-9 px-2 w-full"
                value={antiCollusionMode}
                onChange={e => setAntiCollusionMode(e.target.value as any)}
              >
                <option value="circular-shift-collision-check">
                  Circular shift with collision check (recommended)
                </option>
                <option value="uniform-random">Uniform random fallback</option>
              </select>
            </div>
            <div>
              <Label htmlFor="reviewsPerSubmission">Reviews per submission</Label>
              <Input
                id="reviewsPerSubmission"
                type="number"
                min={1}
                max={5}
                value={reviewsPerSubmission}
                onChange={e => setReviewsPerSubmission(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="reviewsPerReviewer">Reviews per reviewer (must equal above)</Label>
              <Input
                id="reviewsPerReviewer"
                type="number"
                min={1}
                max={5}
                value={reviewsPerReviewer}
                onChange={e => setReviewsPerReviewer(Number(e.target.value))}
              />
            </div>
          </div>
          {reviewsPerSubmission !== reviewsPerReviewer && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Reviews per submission must equal reviews per reviewer (symmetric load).
            </p>
          )}

          <div className="flex items-center gap-2">
            <input
              id="teacherManualReviewEnabled"
              type="checkbox"
              checked={teacherManualReviewEnabled}
              onChange={e => setTeacherManualReviewEnabled(e.target.checked)}
            />
            <Label htmlFor="teacherManualReviewEnabled">
              Teacher can override any reviewer's score (audit-logged)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="notificationsEnabled"
              type="checkbox"
              checked={notificationsEnabled}
              onChange={e => setNotificationsEnabled(e.target.checked)}
            />
            <Label htmlFor="notificationsEnabled">
              Send students notifications (assignments out, due-soon, score ready)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Instructor attachments (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {instructorAttachments.map((a, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <Label>Name</Label>
                <Input
                  value={a.name}
                  onChange={e => updateAttachment(i, { name: e.target.value })}
                />
              </div>
              <div className="col-span-5">
                <Label>URL</Label>
                <Input
                  value={a.url}
                  onChange={e => updateAttachment(i, { url: e.target.value })}
                />
              </div>
              <div className="col-span-1">
                <Label>Kind</Label>
                <select
                  className="border rounded h-9 px-1 w-full"
                  value={a.kind}
                  onChange={e => updateAttachment(i, { kind: e.target.value as any })}
                >
                  {DEFAULT_ATTACHMENT_KINDS.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAttachment(i)}
                aria-label={`Remove attachment ${i + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addAttachment}
            className="w-full"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Add attachment
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={onSave}
          disabled={!valid || isPending}
        >
          {isEdit ? 'Update assessment' : 'Create assessment'}
        </Button>
      </div>
    </div>
  );
}

// Helper: format a Date as a value the `<input type="datetime-local">` accepts.
// We strip the seconds and tz so the value round-trips through toISOString
// without surprises.
function isoLocalFromDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default PeerReviewAssessmentForm;
