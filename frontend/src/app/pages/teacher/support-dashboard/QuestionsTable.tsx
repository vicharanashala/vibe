import { AlertTriangle, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ISupportQuestion, SupportQuestionStatus } from '@/modules/supportChat/types';

interface QuestionsTableProps {
  questions: ISupportQuestion[];
  selectedQuestion: ISupportQuestion | null;
  onSelectQuestion: (question: ISupportQuestion) => void;
  loading?: boolean;
  emptyMessage: string;
}

const STATUS_META: Record<
  string,
  { icon: typeof Clock; className: string; label: string }
> = {
  [SupportQuestionStatus.ESCALATED]: {
    icon: AlertTriangle,
    className:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Escalated',
  },
  [SupportQuestionStatus.PENDING]: {
    icon: Clock,
    className:
      'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
    label: 'Pending',
  },
  [SupportQuestionStatus.ANSWERED]: {
    icon: MessageSquare,
    className:
      'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
    label: 'Answered',
  },
  [SupportQuestionStatus.RESOLVED]: {
    icon: CheckCircle2,
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Resolved',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    icon: Clock,
    className: 'border-border bg-muted text-muted-foreground',
    label: status,
  };
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={`gap-1 font-medium ${meta.className}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

export default function QuestionsTable({
  questions,
  selectedQuestion,
  onSelectQuestion,
  loading,
  emptyMessage,
}: QuestionsTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Asked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question) => (
              <TableRow
                key={question._id}
                onClick={() => onSelectQuestion(question)}
                className={`cursor-pointer ${
                  selectedQuestion?._id === question._id ? 'bg-muted' : ''
                }`}
              >
                <TableCell className="max-w-md">
                  <p className="truncate font-medium">{question.question}</p>
                  {question.escalation && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Reported as {question.escalation.category}:{' '}
                      {question.escalation.details}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={question.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(question.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
