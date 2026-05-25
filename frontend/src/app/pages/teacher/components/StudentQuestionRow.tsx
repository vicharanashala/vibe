import {Check, X, Pencil} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import type {
  StudentQuestionListItem,
  StudentQuestionStatus,
} from '@/types/student-question.types';

const STATUS_VARIANT: Record<StudentQuestionStatus, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface StudentQuestionRowProps {
  question: StudentQuestionListItem;
  showSegmentBadge?: boolean;
  isMutating?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
}

export default function StudentQuestionRow({
  question,
  showSegmentBadge,
  isMutating,
  onApprove,
  onReject,
  onEdit,
}: StudentQuestionRowProps) {
  const isPending = question.status === 'PENDING';
  return (
    <Card className="border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[question.status]}>{question.status}</Badge>
              {showSegmentBadge && (
                <span className="text-xs text-muted-foreground">
                  segment: <code className="font-mono">{question.segmentId.slice(-6)}</code>
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                submitted {new Date(question.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm font-medium break-words">{question.questionText}</p>
          </div>
        </div>

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
                  <span className="ml-auto text-xs font-medium text-primary">correct</span>
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

        {isPending && (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              disabled={isMutating}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={isMutating}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
            <Button size="sm" onClick={onApprove} disabled={isMutating}>
              <Check className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
