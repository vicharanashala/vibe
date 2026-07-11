import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { CheckCircle, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useSubmitProject, SubmitProjectBody, useStartItem, useStopItem, useProjectGallery, GallerySubmission } from '../../../../hooks/hooks';
import { useCourseStore } from '../../../../store/course-store';

// This file is a student-side ProjectItem component for project submission
// It is adapted from the instructor-side ProjectItem, but only allows submission (not editing name/description)

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

export default function StudentProjectItem({ item, onNext, isProgressUpdating, completedItemIdsRef,isAlreadyWatched }: StudentProjectItemProps) {
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const { mutateAsync: submitProject, isPending: isSubmitting } = useSubmitProject();
  const startItem = useStartItem();
  const stopItem = useStopItem();
  const { currentCourse } = useCourseStore();
  const [watchItemId, setWatchItemId] = useState<string>('');


  // Track if item has been started and if start request has been sent
  const itemStartedRef = useRef(false);
  const startRequestSentRef = useRef(false);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // ===== COURSE ITEM TRACKING FUNCTIONS =====
  const handleStartItem = useCallback(async (): Promise<string> => {
    if (!currentCourse?.itemId) {
      console.error('Missing course item ID');
      return '';
    }
    try {
      const response = await startItem.mutateAsync({
        params: {
          path: {
            courseId: currentCourse.courseId,
            courseVersionId: currentCourse.versionId ?? '',
          },
        },
        body: {
          itemId: currentCourse.itemId,
          moduleId: currentCourse.moduleId ?? '',
          sectionId: currentCourse.sectionId ?? '',
          cohortId: currentCourse.cohortId ?? '',
        }
      });

      if (!response?.watchItemId) {
        console.error('No watchItemId returned from startItem');
        return '';
      }
      
      itemStartedRef.current = true;
      setWatchItemId(response.watchItemId);

      return response.watchItemId;
    } catch (error) {
      console.error('Failed to start item:', error);
      return '';
    }
  }, [currentCourse]);


  // Function to stop watching the item
  const handleStopItem = useCallback(async (stopWatchItemId: string): Promise<boolean> => {
    if (!currentCourse?.itemId || !stopWatchItemId) {
      console.warn('Cannot stop item - missing required data', {
        hasItemId: !!currentCourse?.itemId,
        hasWatchItemId: !!stopWatchItemId
      });
      return false;
    }
    try {
      // Stop the watch item
      await stopItem.mutateAsync({
        params: {
          path: {
            courseId: currentCourse.courseId,
            courseVersionId: currentCourse.versionId ?? '',
          },
        },
        body: {
          watchItemId: stopWatchItemId,
          itemId: currentCourse.itemId,
          sectionId: currentCourse.sectionId ?? '',
          moduleId: currentCourse.moduleId ?? '',
          cohortId: currentCourse.cohortId ?? '',
        }
      });
      completedItemIdsRef.current.add(currentCourse.itemId);
      return true;
    } catch (error) {
      console.error('Error stopping watch item:', error);
      return false;
    } finally {
      itemStartedRef.current = false;
    }
  }, [currentCourse, stopItem]);


  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmittingLocal || isSubmitting || isProgressUpdating) {
      return;
    }

    try {
      if (!link.trim()) {
        toast.error('Please enter a link');
        return;
      }

      if (!validateUrl(link)) {
        toast.error('Please enter a valid URL');
        return;
      }

      if (!currentCourse) {
        toast.error('Course information not available');
        return;
      }
      if(!currentCourse.itemId){
        toast.error('Course item information not available');
        return;
      }

      setIsSubmittingLocal(true);
      try {
        if(isAlreadyWatched || completedItemIdsRef.current.has(currentCourse.itemId)){
          await submitProject({
            body: {
              projectId: item._id,
              courseId: currentCourse.courseId,
              versionId: currentCourse.versionId || '',
              moduleId: currentCourse.moduleId || '',
              sectionId: currentCourse.sectionId || '',
              watchItemId: '', // No watchItemId since we're not tracking
              submissionURL: link.trim(),
              comment: comment.trim() || undefined,
              cohortId: currentCourse.cohortId ?? '',
            }
          });
          toast.success('Form submitted successfully!');
          setIsSubmitted(true);
          if (onNext) {
            onNext();
          }
          return;
        }
      } catch (error) {
        console.error('Failed to submit form:', error);
        toast.error('Failed to submit form. Please try again.');
        return;
      }

      // Start watching the item and get the watchItemId
      const newWatchItemId = await handleStartItem();

      // Use the returned watchItemId directly instead of state
      if (!newWatchItemId) {
        throw new Error('Failed to start watching the item');
      }

      const submitData: SubmitProjectBody = {
        projectId: item._id,
        courseId: currentCourse.courseId,
        versionId: currentCourse.versionId || '',
        moduleId: currentCourse.moduleId || '',
        sectionId: currentCourse.sectionId || '',
        watchItemId: newWatchItemId,
        submissionURL: link.trim(),
        comment: comment.trim() || undefined,
        cohortId: currentCourse.cohortId ?? '',
      };

      // Submit the form with watchItemId
      await submitProject({ body: submitData });
      
      // Stop watching the item using the same watchItemId
      const stopSuccess = await handleStopItem(newWatchItemId);
      if (stopSuccess) {
        toast.success('Form submitted successfully!');
      setIsSubmitted(true);
      } else {
        toast.warning('Project submitted but failed to stop tracking');
      }

      // Call onNext if provided
      if (onNext) {
        onNext();
      }
    } catch (error) {
      console.error('Failed to submit form:', error);
      toast.error('Failed to submit form. Please try again.');
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const handleReset = () => {
    if (isSubmittingLocal || isSubmitting || isProgressUpdating) {
      return;
    }
    setLink('');
    setComment('');
    setIsSubmitted(false);
  };

  const { data: galleryItems, isLoading: galleryLoading } = useProjectGallery(
    item._id,
    currentCourse?.courseId ?? '',
    currentCourse?.versionId ?? '',
    currentCourse?.cohortId ?? undefined,
  );

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Form Submitted Successfully!</h3>
          <p className="text-muted-foreground mb-4">
            Your submission has been recorded. You can now proceed to the next item.
          </p>
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
                placeholder="https://drive.google.com/..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full"
                required
              />
              <p className="text-xs text-muted-foreground">
                Please provide a link to your work (e.g., Google Drive, Dropbox, etc.)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment" className="text-sm font-medium">
                Additional Comments (Optional)
              </Label>
              <Textarea
                id="comment"
                placeholder="Any additional notes or comments about your work..."
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
                {isProgressUpdating || isSubmitting || isSubmittingLocal ? 'Submitting...' : 'Submit Form'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isProgressUpdating || isSubmitting || isSubmittingLocal}
              >
                Reset
              </Button>
            </div>
          </form>

          {/* Project Showcase Gallery */}
          {!galleryLoading && (
            <div className="pt-4 border-t border-border">
              <h3 className="text-base font-semibold mb-3">Project Showcase Gallery</h3>
              {galleryItems.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground mb-4">
                    Curated featured submissions for this project.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {galleryItems.map((entry: GallerySubmission) => (
                      <div
                        key={entry.submissionId}
                        className="rounded-lg border border-border bg-muted/30 p-4 space-y-2"
                      >
                        {entry.comment && (
                          <p className="text-sm text-foreground line-clamp-3">{entry.comment}</p>
                        )}
                        <a
                          href={entry.submissionURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                          View submission <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm font-medium text-muted-foreground">No featured submissions yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check back after your instructor curates the gallery.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
