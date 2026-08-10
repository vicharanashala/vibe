import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Badge} from '@/components/ui/badge';
import {useListStudentQuestions} from '@/hooks/hooks';
import type {SegmentDetails} from '@/types/student-question.types';

interface SegmentDetailsDialogProps {
  isOpen: boolean;
  segmentId: string | null;
  courseId?: string;
  courseVersionId?: string;
  onClose: () => void;
}

function Field({label, value}: {label: string; value: React.ReactNode}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2">
      <span className="text-xs text-muted-foreground pt-0.5">{label}</span>
      <span className="text-sm break-words min-w-0">{value}</span>
    </div>
  );
}

/**
 * Shows what a student submission is actually attached to. The review list
 * only carries a raw segmentId, so this resolves it to the underlying item
 * (usually the video the student was watching) and to the quiz that would
 * receive the question on approval.
 */
export default function SegmentDetailsDialog({
  isOpen,
  segmentId,
  courseId,
  courseVersionId,
  onClose,
}: SegmentDetailsDialogProps) {
  const {getSegmentDetails} = useListStudentQuestions();
  const [details, setDetails] = useState<SegmentDetails | null>(null);
  // Local, not the hook's shared `loading` — the review page uses the same
  // hook instance for its list fetch and the two would clobber each other.
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !segmentId || !courseId || !courseVersionId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setDetails(null);
    getSegmentDetails(courseId, courseVersionId, segmentId)
      .then(data => {
        if (!cancelled) setDetails(data as SegmentDetails);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Failed to load segment details');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, segmentId, courseId, courseVersionId, getSegmentDetails]);

  const video = details?.videoDetails;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Segment details</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading segment…</p>
          )}

          {error && !isLoading && (
            <p className="text-sm text-destructive break-words">{error}</p>
          )}

          {details && !isLoading && (
            <>
              <Field
                label="Name"
                value={
                  details.name || (
                    <span className="text-muted-foreground">Untitled</span>
                  )
                }
              />
              {details.type && (
                <Field
                  label="Type"
                  value={<Badge variant="secondary">{details.type}</Badge>}
                />
              )}
              <Field
                label="Segment ID"
                value={<code className="font-mono text-xs">{details.segmentId}</code>}
              />
              {details.description && (
                <Field label="Description" value={details.description} />
              )}

              {video && (
                <>
                  {video.URL && (
                    <Field
                      label="Video URL"
                      value={
                        <a
                          href={video.URL}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline break-all"
                        >
                          {video.URL}
                        </a>
                      }
                    />
                  )}
                  {(video.startTime || video.endTime) && (
                    <Field
                      label="Clip range"
                      value={`${video.startTime ?? '—'} → ${video.endTime ?? '—'}`}
                    />
                  )}
                  {typeof video.points === 'number' && (
                    <Field label="Points" value={video.points} />
                  )}
                </>
              )}

              <Field
                label="Target quiz"
                value={
                  details.quiz ? (
                    details.quiz.name || details.quiz.itemId
                  ) : (
                    <span className="text-muted-foreground">
                      No quiz follows this segment — approved questions cannot be
                      added to a question bank.
                    </span>
                  )
                }
              />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
