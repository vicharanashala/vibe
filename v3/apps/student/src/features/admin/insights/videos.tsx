import { ChevronRightIcon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ChartPanel } from './chart-panel';
import { count, percent, timestamp } from './format';
import type { VideoInsight } from './types';

const completion = (v: VideoInsight) =>
  v.started ? v.completed / v.started : null;

/** Each video's completion rate (finished ÷ started). Each opens its rewind hotspots. */
export function VideoInsights({ videos }: { videos: VideoInsight[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = videos.find((v) => v.itemId === openId) ?? null;
  const lowest = videos
    .filter((v) => v.started >= 5)
    .sort((a, b) => (completion(a) ?? 1) - (completion(b) ?? 1))[0];
  return (
    <ChartPanel
      title="Videos"
      summary={
        lowest
          ? `Least finished: “${lowest.name}”, completed by ${percent(completion(lowest) ?? 0)} of the students who started it.`
          : videos.length
            ? 'Completion rates appear once a few students have started each video.'
            : 'This course has no videos.'
      }
    >
      {videos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Video</TableHead>
              <TableHead className="w-32 max-sm:w-20">Completed</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((v) => {
              const rate = completion(v);
              return (
                <TableRow key={v.itemId}>
                  <TableCell className="w-full max-w-0">
                    <p className="line-clamp-2 font-medium whitespace-normal">
                      {v.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.completed.toLocaleString()} of{' '}
                      {count(v.started, 'student')} who started
                    </p>
                  </TableCell>
                  <TableCell>
                    {rate == null ? (
                      <span className="text-muted-foreground">–</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.round(rate * 100)}
                          className="flex-1 max-sm:hidden"
                          aria-hidden
                        />
                        <span className="w-9 text-right text-xs tabular-nums">
                          {percent(rate)}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${v.name}: details`}
                      onClick={() => setOpenId(v.itemId)}
                    >
                      <ChevronRightIcon aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.name}</SheetTitle>
                <SheetDescription>
                  {open.completed.toLocaleString()} of{' '}
                  {count(open.started, 'student')} who started finished it.
                </SheetDescription>
              </SheetHeader>
              <section className="px-4 pb-6" aria-labelledby="rewinds">
                <h3 id="rewinds" className="mb-1 text-sm font-semibold">
                  Moments students rewind to
                </h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Often a part that needs a second look: a fast explanation or a
                  key step.
                </p>
                {open.rewindHotspots.length ? (
                  <ol className="grid gap-2">
                    {[...open.rewindHotspots]
                      .sort((a, b) => b.rewinds - a.rewinds)
                      .map((h) => (
                        <li
                          key={h.startSecond}
                          className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
                        >
                          <RotateCcwIcon
                            aria-hidden
                            className="size-4 text-muted-foreground"
                          />
                          <span className="font-medium tabular-nums">
                            {timestamp(h.startSecond)}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                            {count(h.rewinds, 'rewind')}
                          </span>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No rewinds recorded yet.
                  </p>
                )}
              </section>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ChartPanel>
  );
}
