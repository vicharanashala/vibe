import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHpCohorts } from '@/hooks/hooks';

interface PeerReviewCohortPickerProps {
  courseVersionId: string;
  onPicked: (cohortId: string) => void;
  onCancel: () => void;
}

/**
 * First step of the peer-review assessment creation flow.
 *
 * The backend requires a `cohortId` on every assessment (it scopes the
 * reviewer pool and is used by the assignment algorithm), but expecting the
 * teacher to paste a raw Mongo ObjectId is hostile. This component:
 *   1. Loads the cohorts attached to the current course version via the
 *      HP cohorts endpoint (`GET /api/hp/courses-cohorts/cohorts?courseVersionId=...`).
 *   2. Renders a select with cohort names; the underlying ObjectId is what
 *      we hand back to the parent.
 *   3. If the version has no cohorts yet, shows a friendly "Create cohort
 *      first" message with a deep link to the cohort-create page for the
 *      current version.
 *
 * Kept tiny and dependency-light so the parent `teacher-course-page.tsx`
 * stays readable. The picker does NOT mutate anything — it's a pure
 * chooser that hands the chosen cohortId up.
 */
export function PeerReviewCohortPicker({
  courseVersionId,
  onPicked,
  onCancel,
}: PeerReviewCohortPickerProps) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useHpCohorts(courseVersionId);
  const [selected, setSelected] = useState<string>('');

  // Surface cohort-fetch failures to the console so the next time
  // the modal appears blank it's obvious the picker query failed
  // rather than the modal failing to open.
  if (error) {
    console.error('[peer-review] cohort fetch failed:', error);
  }

  const cohorts = (data?.data ?? []) as Array<{
    cohortId: string;
    cohortName: string;
  }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Pick a cohort</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Peer-review assessments are scoped to a cohort — only students in
          the chosen cohort will be able to submit and review.
        </p>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading cohorts…</p>
        )}

        {error && (
          <p className="text-sm text-destructive">
            Failed to load cohorts: {String(error)}
          </p>
        )}

        {!isLoading && !error && cohorts.length === 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-2">
            <p className="text-sm font-medium text-amber-900">
              No cohorts yet for this course version.
            </p>
            <p className="text-sm text-amber-800">
              Create at least one cohort before adding a peer-review
              assessment. Cohorts group students together for review
              assignment.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() =>
                  navigate({
                    to: `/teacher/hp-system/${courseVersionId}/cohorts` as any,
                  })
                }
              >
                Create cohort
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !error && cohorts.length > 0 && (
          <>
            <div className="space-y-2">
              <label
                htmlFor="pr-cohort-select"
                className="text-sm font-medium leading-none"
              >
                Cohort
              </label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="pr-cohort-select" className="w-full">
                  <SelectValue placeholder="Choose a cohort…" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.cohortId} value={c.cohortId}>
                      {c.cohortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => onPicked(selected)} disabled={!selected}>
                Continue
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PeerReviewCohortPicker;