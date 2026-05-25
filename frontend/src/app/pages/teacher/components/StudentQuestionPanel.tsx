import {useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';
import {Loader2, RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useListStudentQuestions,
  useUpdateStudentQuestionContent,
  useUpdateStudentQuestionStatus,
} from '@/hooks/hooks';
import type {
  StudentQuestionListItem,
  UpdateStudentQuestionPayload,
} from '@/types/student-question.types';
import StudentQuestionRow from './StudentQuestionRow';
import StudentQuestionRejectDialog from './StudentQuestionRejectDialog';
import StudentQuestionEditDialog from './StudentQuestionEditDialog';

interface StudentQuestionPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseVersionId: string;
  segmentId: string;
  segmentTitle?: string;
}

export default function StudentQuestionPanel({
  isOpen,
  onOpenChange,
  courseId,
  courseVersionId,
  segmentId,
  segmentTitle,
}: StudentQuestionPanelProps) {
  const [items, setItems] = useState<StudentQuestionListItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  const {listForSegment, loading: isFetching} = useListStudentQuestions();
  const {updateStatus, loading: isUpdatingStatus} = useUpdateStudentQuestionStatus();
  const {updateContent, loading: isUpdatingContent} = useUpdateStudentQuestionContent();

  const isMutating = isUpdatingStatus || isUpdatingContent;

  const [rejectTarget, setRejectTarget] = useState<StudentQuestionListItem | null>(null);
  const [editTarget, setEditTarget] = useState<StudentQuestionListItem | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!isOpen || !courseId || !courseVersionId || !segmentId) return;
    try {
      const response = await listForSegment(courseId, courseVersionId, segmentId, 100);
      setItems(response?.items ?? []);
      setHasFetched(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load student questions');
    }
  }, [isOpen, courseId, courseVersionId, segmentId, listForSegment]);

  useEffect(() => {
    if (isOpen) {
      void fetchQuestions();
    } else {
      setItems([]);
      setHasFetched(false);
      setRejectTarget(null);
      setEditTarget(null);
    }
  }, [isOpen, fetchQuestions]);

  const handleApprove = async (question: StudentQuestionListItem) => {
    try {
      await updateStatus(courseId, courseVersionId, question.segmentId, question._id, 'APPROVED');
      toast.success('Question approved');
      await fetchQuestions();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve');
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await updateStatus(
        courseId,
        courseVersionId,
        rejectTarget.segmentId,
        rejectTarget._id,
        'REJECTED',
        reason,
      );
      toast.success('Question rejected');
      setRejectTarget(null);
      await fetchQuestions();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject');
    }
  };

  const handleEditSubmit = async (payload: UpdateStudentQuestionPayload) => {
    if (!editTarget) return;
    try {
      await updateContent(courseId, courseVersionId, editTarget.segmentId, editTarget._id, payload);
      toast.success(payload.status === 'APPROVED' ? 'Saved and approved' : 'Saved');
      setEditTarget(null);
      await fetchQuestions();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Student questions for this segment</SheetTitle>
          <SheetDescription>
            {segmentTitle
              ? `Submissions for "${segmentTitle}". Approve, reject, or edit each one.`
              : 'Submissions tied to the selected video. Approve, reject, or edit each one.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-end pt-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void fetchQuestions()}
            disabled={isFetching}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {isFetching && !hasFetched ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No submissions for this segment yet.
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {items.map(question => (
              <StudentQuestionRow
                key={question._id}
                question={question}
                isMutating={isMutating}
                onApprove={() => void handleApprove(question)}
                onReject={() => setRejectTarget(question)}
                onEdit={() => setEditTarget(question)}
              />
            ))}
          </div>
        )}

        <StudentQuestionRejectDialog
          isOpen={rejectTarget !== null}
          isSubmitting={isUpdatingStatus}
          onCancel={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
        />
        <StudentQuestionEditDialog
          isOpen={editTarget !== null}
          question={editTarget}
          isSubmitting={isUpdatingContent}
          onCancel={() => setEditTarget(null)}
          onSubmit={handleEditSubmit}
        />
      </SheetContent>
    </Sheet>
  );
}
