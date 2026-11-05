import {useState} from 'react';
import {Loader2, RefreshCw} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {useCaseStudyResponses} from '@/hooks/case-study-hooks';
import type {MyCaseResponse} from '@/lib/api/case-studies';

interface CaseStudyResponsesPanelProps {
  courseId: string;
  versionId: string;
  /** The CASE_STUDY item id, which is also the caseStudy document id. */
  itemId: string;
}

const STATUS: Record<string, {label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'}> = {
  WON:       {label: 'Won',        variant: 'default'},
  OPEN:      {label: 'In review',  variant: 'secondary'},
  WITHDRAWN: {label: 'Withdrawn',  variant: 'destructive'},
};

function ResponseDetailDialog({
  response,
  onClose,
}: {
  response: MyCaseResponse;
  onClose: () => void;
}) {
  const fields: {label: string; value: string}[] = [
    {label: 'a) What I thought going in',                         value: response.beat1a},
    {label: 'b) What challenged it',                              value: response.beat1b},
    {label: 'c) Where I ended up',                               value: response.beat1c},
    {label: '2a — Strongest case against my view (steelman)',    value: response.steelman},
    {label: '2b — One perspective from the room',                value: response.roomPerspective},
    {label: '3 — One thing I\'ll change',                        value: response.changeCommitment},
  ];

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Response · …{response.userId.slice(-6)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {fields.map(f => (
            <div key={f.label} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed">{f.value}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CaseStudyResponsesPanel({
  courseId,
  versionId,
  itemId,
}: CaseStudyResponsesPanelProps) {
  const {responses, isLoading, isError, refetch} = useCaseStudyResponses(
    courseId,
    versionId,
    itemId,
  );
  const [viewing, setViewing] = useState<MyCaseResponse | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading responses…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Could not load responses.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        No responses yet.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {viewing ? (
        <ResponseDetailDialog response={viewing} onClose={() => setViewing(null)} />
      ) : null}
      <p className="text-xs text-muted-foreground">
        {responses.length} response{responses.length === 1 ? '' : 's'} — newest first
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Wins</TableHead>
            <TableHead className="text-right">Weak streak</TableHead>
            <TableHead className="text-right">Reviewed by</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses.map(r => {
            const s = STATUS[r.status] ?? {label: r.status, variant: 'outline' as const};
            return (
              <TableRow key={r._id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  …{r.userId.slice(-6)}
                </TableCell>
                <TableCell>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </TableCell>
                <TableCell className="text-right">{r.winCount}</TableCell>
                <TableCell className="text-right">{r.weakStreak}</TableCell>
                <TableCell className="text-right">{r.comparisonsSeenCount}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewing(r)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
