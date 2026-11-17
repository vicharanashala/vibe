import { RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { BarRow, ShowMoreList } from './bars';
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
          ? `Least finished: “${lowest.name}”, ${percent(completion(lowest) ?? 0)} completed.`
          : videos.length
            ? 'Completion rates appear once a few students have started each video.'
            : 'This course has no videos.'
      }
    >
      {videos.length > 0 && (
        <>
          <p className="mb-1 flex justify-between text-[11px] font-medium text-muted-foreground">
            <span>Video</span>
            <span>Completed</span>
          </p>
          <ShowMoreList
            items={videos}
            noun="videos"
            render={(v) => {
              const rate = completion(v);
              return (
                <li key={v.itemId}>
                  <BarRow
                    onClick={() => setOpenId(v.itemId)}
                    actionLabel={`${v.name}: details`}
                    label={v.name}
                    value={rate == null ? '–' : percent(rate)}
                    bar={rate ?? 0}
                    tone={rate == null ? 'muted' : rate < 0.7 ? 'warn' : 'primary'}
                    detail={`${v.completed.toLocaleString()} of ${count(v.started, 'student')} who started`}
                  />
                </li>
              );
            }}
          />
        </>
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
