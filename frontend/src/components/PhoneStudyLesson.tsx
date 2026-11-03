import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Loader2, Lock, PlayCircle } from 'lucide-react';
import { useState } from 'react';

import HlsVideoPlayer from '@/components/HlsVideoPlayer';
import MobileFallbackScreen from '@/components/MobileFallbackScreen';
import { Button } from '@/components/ui/button';
import { fetchClient } from '@/lib/openapi';
import {
  phoneLessonMode,
  resolveStudyMode,
  studyModeLevel,
  studyModeRefusal,
  type ResolvedStudyMode,
  type StudyModeNode,
} from '@/utils/studyMode';

type Ids = { courseId: string; versionId: string; cohortId?: string };
type LessonIds = { moduleId: string; sectionId: string; itemId: string };

interface StudyItem {
  _id: string;
  name: string;
  type: string;
  studyMode?: ResolvedStudyMode;
  details?: { URL?: string; source?: string | null; assetId?: string | null; startTime?: string; endTime?: string };
}

interface OutlineModule extends StudyModeNode {
  moduleId: string;
  name: string;
  order: string;
  isHidden?: boolean;
  sections: (StudyModeNode & { sectionId: string; name: string; order: string; isHidden?: boolean })[];
}

const ordered = <T extends { order: string; isHidden?: boolean }>(list: T[] = []) =>
  list.filter(x => !x.isHidden).sort((a, b) => a.order.localeCompare(b.order));

function youTubeId(url = ''): string | null {
  return url.match(/(?:v=|youtu\.be\/?|embed\/)([\w-]{11})/)?.[1] ?? null;
}

function seconds(t?: string): number {
  if (!t) return 0;
  return t.split(':').map(Number).reduce((acc, n) => acc * 60 + (Number.isNaN(n) ? 0 : n), 0);
}

class StudyReadError extends Error {
  constructor(readonly body: unknown, message: string) {
    super(message);
  }
}

/**
 * Study-mode read: the backend skips the linear lock, never touches progress,
 * and refuses quizzes and items where the instructor disabled study mode.
 */
async function readStudyItem(ids: Ids & LessonIds): Promise<StudyItem> {
  const { data, error, response } = await (fetchClient as any).GET(
    '/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}',
    {
      params: {
        path: { courseId: ids.courseId, versionId: ids.versionId, moduleId: ids.moduleId, sectionId: ids.sectionId, itemId: ids.itemId },
        query: { mode: 'study', ...(ids.cohortId ? { cohortId: ids.cohortId } : {}) },
      },
    },
  );
  if (error || !response.ok) throw new StudyReadError(error, error?.message || `Request failed (${response.status})`);
  return (data as { item: StudyItem }).item;
}

/**
 * The course page on a phone: watch videos in study mode (no proctoring,
 * seek and replay freely, any order, nothing saved), and the existing "use a
 * computer" screen for everything else. Picking another lesson stays inside
 * this view and never makes an ordinary lesson read, which can move the
 * student's progress pointer.
 */
export function PhoneStudyLesson({
  modules,
  initial,
  ...ids
}: Ids & { modules: OutlineModule[]; initial: LessonIds }) {
  const [lesson, setLesson] = useState<LessonIds>(initial);
  const item = useQuery({
    queryKey: ['study-item', ids.versionId, lesson.itemId],
    queryFn: () => readStudyItem({ ...ids, ...lesson }),
    retry: false,
    staleTime: 60_000,
  });

  if (item.isPending)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading lesson" />
      </div>
    );

  const refusal = item.isError ? studyModeRefusal((item.error as StudyReadError).body) : undefined;
  const mode = item.isSuccess ? phoneLessonMode(item.data, true, false) : 'fallback';
  const reason =
    refusal?.kind === 'disabled'
      ? `The instructor has disabled study mode for ${studyModeLevel(refusal.source)}.`
      : refusal?.kind === 'quiz'
        ? 'Quizzes are taken on a computer.'
        : item.isSuccess && item.data.studyMode?.allowed === false
          ? `The instructor has disabled study mode for ${studyModeLevel(item.data.studyMode.source)}.`
          : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      {mode === 'study' && item.isSuccess ? (
        <div className="space-y-3 p-4">
          <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100">
            Study mode: this doesn’t count towards your progress. Use a computer for strict mode, quizzes and progress.
          </div>
          <h1 className="text-lg font-semibold">{item.data.name}</h1>
          <StudyVideo item={item.data} />
        </div>
      ) : (
        <MobileFallbackScreen reason={reason} />
      )}
      <StudyOutline {...ids} modules={modules} current={lesson.itemId} onPick={setLesson} />
    </div>
  );
}

function StudyVideo({ item }: { item: StudyItem }) {
  const d = item.details ?? {};
  if (d.source === 'GCS' && d.assetId)
    return (
      <HlsVideoPlayer
        assetId={d.assetId}
        startTime={d.startTime}
        endTime={d.endTime}
        controls
        className="aspect-video w-full rounded-lg bg-black"
      />
    );
  const id = youTubeId(d.URL);
  if (!id) return <p className="text-sm text-muted-foreground">This video can’t be played here.</p>;
  const start = seconds(d.startTime);
  const end = seconds(d.endTime);
  const query = new URLSearchParams({ rel: '0', playsinline: '1', ...(start ? { start: String(start) } : {}), ...(end ? { end: String(end) } : {}) });
  return (
    <iframe
      title={item.name}
      src={`https://www.youtube-nocookie.com/embed/${id}?${query}`}
      className="aspect-video w-full rounded-lg"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

/** The course outline for picking a video in study mode; sections load their lessons when opened. */
function StudyOutline({
  modules,
  current,
  onPick,
  ...ids
}: Ids & { modules: OutlineModule[]; current: string; onPick: (l: LessonIds) => void }) {
  return (
    <nav aria-label="Course lessons" className="mt-auto space-y-4 border-t p-4">
      <h2 className="text-sm font-semibold">Lessons</h2>
      {ordered(modules).map(m => (
        <div key={m.moduleId} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.name}</p>
          {ordered(m.sections).map(s => (
            <OutlineSection key={s.sectionId} {...ids} module={m} section={s} current={current} onPick={onPick} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function OutlineSection({
  module: m,
  section: s,
  current,
  onPick,
  ...ids
}: Ids & {
  module: OutlineModule;
  section: OutlineModule['sections'][number];
  current: string;
  onPick: (l: LessonIds) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = useQuery({
    queryKey: ['study-section-items', ids.versionId, m.moduleId, s.sectionId],
    enabled: open,
    queryFn: async () => {
      const { data, error, response } = await (fetchClient as any).GET(
        '/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items',
        { params: { path: { versionId: ids.versionId, moduleId: m.moduleId, sectionId: s.sectionId }, query: ids.cohortId ? { cohortId: ids.cohortId } : {} } },
      );
      if (error || !response.ok) throw new Error(error?.message || 'Couldn’t load these lessons');
      const list = (Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? []) as (StudyModeNode & {
        _id: string;
        name: string;
        type: string;
        order: string;
        isHidden?: boolean;
      })[];
      return ordered(list);
    },
  });
  return (
    <div className="rounded-md border">
      <Button variant="ghost" className="w-full justify-between" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {s.name}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </Button>
      {open && (
        <ul className="border-t p-2 text-sm">
          {items.isPending && <li className="px-2 py-1 text-muted-foreground">Loading…</li>}
          {items.isError && <li className="px-2 py-1 text-destructive">Couldn’t load these lessons.</li>}
          {items.data?.map(i => {
            const strictOnly = i.type !== 'VIDEO' || !resolveStudyMode(i, s, m).allowed;
            return (
              <li key={i._id}>
                <button
                  type="button"
                  onClick={() => onPick({ moduleId: m.moduleId, sectionId: s.sectionId, itemId: i._id })}
                  aria-current={i._id === current ? 'true' : undefined}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted ${i._id === current ? 'bg-muted font-medium' : ''}`}
                >
                  {strictOnly ? (
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Computer only" />
                  ) : (
                    <PlayCircle className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                  )}
                  <span className="truncate">{i.name}</span>
                  {strictOnly && <span className="ml-auto shrink-0 text-xs text-muted-foreground">Computer only</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
