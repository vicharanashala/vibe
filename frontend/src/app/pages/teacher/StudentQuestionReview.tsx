import {useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';
import {Loader2, RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {useCourseStore} from '@/store/course-store';
import {
  useListStudentQuestions,
  useUpdateStudentQuestionContent,
  useUpdateStudentQuestionStatus,
} from '@/hooks/hooks';
import type {
  StudentQuestionListItem,
  StudentQuestionStatusFilter,
  UpdateStudentQuestionPayload,
} from '@/types/student-question.types';
import StudentQuestionRow from './components/StudentQuestionRow';
import StudentQuestionRejectDialog from './components/StudentQuestionRejectDialog';
import StudentQuestionEditDialog from './components/StudentQuestionEditDialog';
import CourseBackButton from './CourseBackButton';

const STATUS_FILTER_OPTIONS: StudentQuestionStatusFilter[] = [
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED',
];

export default function StudentQuestionReview() {
  const {currentCourse} = useCourseStore();
  const courseId = currentCourse?.courseId;
  const courseVersionId = currentCourse?.versionId;

  const [statusFilter, setStatusFilter] = useState<StudentQuestionStatusFilter>('PENDING');
  const [items, setItems] = useState<StudentQuestionListItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  const {listForCourseVersion, loading: isFetching} = useListStudentQuestions();
  const {updateStatus, loading: isUpdatingStatus} = useUpdateStudentQuestionStatus();
  const {updateContent, loading: isUpdatingContent} = useUpdateStudentQuestionContent();

  const isMutating = isUpdatingStatus || isUpdatingContent;

  const [rejectTarget, setRejectTarget] = useState<StudentQuestionListItem | null>(null);
  const [editTarget, setEditTarget] = useState<StudentQuestionListItem | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!courseId || !courseVersionId) return;
    try {
      const response = await listForCourseVersion(courseId, courseVersionId, statusFilter, 100);
      setItems(response?.items ?? []);
      setHasFetched(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load student questions');
    }
  }, [courseId, courseVersionId, listForCourseVersion, statusFilter]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  const handleApprove = async (question: StudentQuestionListItem) => {
    if (!courseId || !courseVersionId) return;
    try {
      await updateStatus(courseId, courseVersionId, question.segmentId, question._id, 'APPROVED');
      toast.success('Question approved');
      await fetchQuestions();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve');
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!courseId || !courseVersionId || !rejectTarget) return;
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
    if (!courseId || !courseVersionId || !editTarget) return;
    try {
      await updateContent(courseId, courseVersionId, editTarget.segmentId, editTarget._id, payload);
      toast.success(payload.status === 'APPROVED' ? 'Saved and approved' : 'Saved');
      setEditTarget(null);
      await fetchQuestions();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    }
  };

  if (!courseId || !courseVersionId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Select a course version first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CourseBackButton />
          <div>
            <h1 className="text-xl font-semibold">Student Question Review</h1>
            <p className="text-xs text-muted-foreground">
              Approve, reject, or edit MCQs submitted by students.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={value => setStatusFilter(value as StudentQuestionStatusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      {isFetching && !hasFetched ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          No student questions match the current filter.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(question => (
            <StudentQuestionRow
              key={question._id}
              question={question}
              showSegmentBadge
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
    </div>
  );
}
