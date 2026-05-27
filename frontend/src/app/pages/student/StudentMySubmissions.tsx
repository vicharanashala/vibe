import {useCallback, useEffect, useState} from 'react';
import {toast} from 'sonner';
import {Loader2, MessageSquareQuote, RefreshCw} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {useListMyStudentQuestions} from '@/hooks/hooks';
import type {
  StudentQuestionListItem,
  StudentQuestionStatus,
  StudentQuestionStatusFilter,
} from '@/types/student-question.types';

const STATUS_FILTER_OPTIONS: StudentQuestionStatusFilter[] = [
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED',
];

const STATUS_VARIANT: Record<StudentQuestionStatus, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function StudentSubmissionRow({question}: {question: StudentQuestionListItem}) {
  return (
    <Card className="border">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[question.status]}>{question.status}</Badge>
          <span className="text-xs text-muted-foreground">
            submitted {formatDate(question.createdAt)}
          </span>
          {question.reviewedAt && (
            <span className="text-xs text-muted-foreground">
              · reviewed {formatDate(question.reviewedAt)}
            </span>
          )}
        </div>
        <p className="text-sm font-medium break-words">{question.questionText}</p>

        <ul className="grid gap-1.5">
          {question.options.map((option, index) => {
            const isCorrect = index === question.correctOptionIndex;
            return (
              <li
                key={`option-${index}`}
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                  isCorrect ? 'border-primary/40 bg-primary/5' : 'border-border'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isCorrect ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {OPTION_LABELS[index]}
                </span>
                <span className="break-words">{option.text}</span>
                {isCorrect && (
                  <span className="ml-auto text-xs font-medium text-primary">your correct answer</span>
                )}
              </li>
            );
          })}
        </ul>

        {question.status === 'REJECTED' && question.rejectionReason && (
          <p className="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <span className="font-semibold">Reason:</span> {question.rejectionReason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudentMySubmissions() {
  const [statusFilter, setStatusFilter] = useState<StudentQuestionStatusFilter>('ALL');
  const [items, setItems] = useState<StudentQuestionListItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const {listMine, loading: isFetching} = useListMyStudentQuestions();

  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await listMine(statusFilter, 100);
      setItems(response?.items ?? []);
      setHasFetched(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load your submissions');
    }
  }, [listMine, statusFilter]);

  useEffect(() => {
    void fetchSubmissions();
  }, [fetchSubmissions]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MessageSquareQuote className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">My Submissions</h1>
            <p className="text-xs text-muted-foreground">
              MCQs you've submitted and their review status.
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
            onClick={() => void fetchSubmissions()}
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
          You haven't submitted any MCQs yet
          {statusFilter !== 'ALL' ? ` with status ${statusFilter}` : ''}.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(question => (
            <StudentSubmissionRow key={question._id} question={question} />
          ))}
        </div>
      )}
    </div>
  );
}
