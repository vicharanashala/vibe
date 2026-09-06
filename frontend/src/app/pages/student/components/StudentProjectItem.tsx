import React, { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Badge } from '../../../../components/ui/badge';
import { CheckCircle, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useSubmitProject, useMyProjectSubmission } from '../../../../hooks/hooks';
import { useCourseStore } from '../../../../store/course-store';

export type StudentProjectItemProps = {
  item: {
    _id: string;
    name: string;
    description: string;
    type: 'PROJECT';
  };
  onNext?: () => void;
  isProgressUpdating?: boolean;
  completedItemIdsRef: React.RefObject<Set<string>>;
  isAlreadyWatched?: boolean;
};

export default function StudentProjectItem({ item, onNext, isProgressUpdating, completedItemIdsRef, isAlreadyWatched }: StudentProjectItemProps) {
  const { currentCourse } = useCourseStore();
  const courseId = currentCourse?.courseId ?? '';
  const versionId = currentCourse?.versionId ?? '';
  const cohortId = currentCourse?.cohortId ?? undefined;

  const { data: existingSubmission, isLoading: loadingExisting } = useMyProjectSubmission(courseId, versionId, cohortId);

  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { mutateAsync: submitProject, isPending: isSubmitting } = useSubmitProject();

  // Pre-fill form when existing submission loads
  useEffect(() => {
    if (existingSubmission?.submissionURL) {
      setLink(existingSubmission.submissionURL);
      setComment(existingSubmission.comment ?? '');
    }
  }, [existingSubmission]);

  const validateUrl = (url: string): boolean => {
    try { new URL(url); return true; } catch { return false; }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingLocal || isSubmitting || isProgressUpdating) return;

    if (!link.trim()) { toast.error('Please enter a link'); return; }
    if (!validateUrl(link)) { toast.error('Please enter a valid URL'); return; }
    if (!currentCourse?.itemId) { toast.error('Course item information not available'); return; }

    setIsSubmittingLocal(true);
    try {
      await submitProject({
        body: {
          projectId: item._id,
          courseId: currentCourse.courseId,
          versionId: currentCourse.versionId || '',
          moduleId: currentCourse.moduleId || '',
          sectionId: currentCourse.sectionId || '',
          watchItemId: '',
          submissionURL: link.trim(),
          comment: comment.trim() || undefined,
          cohortId: currentCourse.cohortId ?? '',
        },
      });
      // Mark as locally completed so the sidebar reflects it
      completedItemIdsRef.current.add(currentCourse.itemId);
      toast.success(existingSubmission ? 'Submission updated!' : 'Submitted successfully!');
      setIsSubmitted(true);
      setIsEditing(false);
      if (onNext) onNext();
    } catch (error) {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  // Show existing submission view (not editing)
  if (existingSubmission?.submissionURL && !isEditing && !isSubmitted) {
    return (
      <div className="h-full w-full overflow-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h2 className="text-xl font-semibold">{item.name}</h2>
            </div>
            {item.description && <p className="text-muted-foreground">{item.description}</p>}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your submission</span>
              <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                Submitted
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Link</p>
              <a
                href={existingSubmission.submissionURL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {existingSubmission.submissionURL}
              </a>
            </div>
            {existingSubmission.comment && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Comment</p>
                <p className="text-sm">{existingSubmission.comment}</p>
              </div>
            )}
            {existingSubmission.submittedAt && (
              <p className="text-xs text-muted-foreground">
                Submitted {new Date(existingSubmission.submittedAt).toLocaleDateString()}
              </p>
            )}
            {existingSubmission.grade && (
              <div className="pt-2 border-t space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Instructor feedback</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{existingSubmission.grade}</Badge>
                </div>
                {existingSubmission.feedback && (
                  <p className="text-sm mt-1">{existingSubmission.feedback}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsEditing(true)}>
              Update Submission
            </Button>
            {onNext && (
              <Button className="flex-1" onClick={onNext} disabled={isProgressUpdating}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Submitted Successfully!</h3>
          <p className="text-muted-foreground mb-4">Your submission has been recorded.</p>
          <Button onClick={onNext} disabled={isProgressUpdating || isSubmittingLocal}>
            {isProgressUpdating || isSubmittingLocal ? 'Updating Progress...' : 'Continue'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6">
        <div className="space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <LinkIcon className="h-5 w-5" />
              <h2 className="text-xl font-semibold">{item.name}</h2>
            </div>
            {item.description && <p className="text-muted-foreground">{item.description}</p>}
          </div>
          <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="link" className="text-sm font-medium">
                Work Link <span className="text-red-500">*</span>
              </Label>
              <Input
                id="link"
                type="url"
                placeholder="https://drive.google.com/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full"
                required
              />
              <p className="text-xs text-muted-foreground">
                Share a link to your work (Google Drive, OneDrive, Dropbox, YouTube, etc.)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment" className="text-sm font-medium">
                Additional Comments (Optional)
              </Label>
              <Textarea
                id="comment"
                placeholder="Any notes about your submission…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full min-h-[100px]"
                rows={4}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1"
                disabled={isProgressUpdating || isSubmitting || isSubmittingLocal}
              >
                {isProgressUpdating || isSubmitting || isSubmittingLocal
                  ? 'Submitting…'
                  : existingSubmission
                  ? 'Update Submission'
                  : 'Submit'}
              </Button>
              {isEditing && (
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
