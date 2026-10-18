import {
  AppWindowIcon,
  ChevronRightIcon,
  ClipboardPasteIcon,
  EarIcon,
  FocusIcon,
  HandIcon,
  ImageOffIcon,
  ScanFaceIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserMinusIcon,
  UserRoundXIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GeneratedAvatar } from '@/components/generated-art';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCourseVersion } from '@/features/courses/queries';
import { useFlatSyllabus } from '@/features/learn/tracks';

import { CourseProctoring } from './course-proctoring';
import {
  useAppeals,
  useDecideAppeal,
  useDismissIncident,
  useIncidentPhoto,
  useIncidents,
  useIncidentStats,
  useReinstateStudent,
  useRemovalHistory,
  useRemoveStudent,
  type Appeal,
  type Incident,
  type IncidentType,
  type Removal,
} from './integrity-api';
import { useStudioAccess } from './queries';
import { ConfirmDialog, ErrorText, formatDate, StatStrip } from './studio-ui';

export const INCIDENT_TYPES: Record<
  IncidentType,
  { label: string; description: string; icon: LucideIcon }
> = {
  NO_FACE: {
    label: 'No face',
    description: 'Nobody was visible to the camera.',
    icon: UserRoundXIcon,
  },
  MULTIPLE_FACES: {
    label: 'Several faces',
    description: 'More than one person was in view.',
    icon: UsersRoundIcon,
  },
  FACE_RECOGNITION: {
    label: 'Face didn’t match',
    description:
      'The person on camera didn’t match the student’s reference photo.',
    icon: ScanFaceIcon,
  },
  BLUR_DETECTION: {
    label: 'Blurry camera',
    description: 'The camera view was blurred or covered.',
    icon: FocusIcon,
  },
  VOICE_DETECTION: {
    label: 'Voice heard',
    description: 'Talking was picked up by the microphone.',
    icon: EarIcon,
  },
  HAND_GESTURE_DETECTION: {
    label: 'Hand gesture',
    description: 'A hand signal was seen on camera.',
    icon: HandIcon,
  },
  FOCUS: {
    label: 'Left the lesson',
    description: 'The student switched away from the lesson window.',
    icon: AppWindowIcon,
  },
  TAB_SWITCH_DURING_REVIEW: {
    label: 'Switched tabs',
    description: 'The student switched tabs during a review.',
    icon: AppWindowIcon,
  },
  PASTE_ATTEMPTED: {
    label: 'Pasted text',
    description: 'The student tried to paste text.',
    icon: ClipboardPasteIcon,
  },
};
const typeMeta = (t: string) =>
  INCIDENT_TYPES[t as IncidentType] ?? {
    label: t.toLowerCase().replace(/_/g, ' '),
    description: '',
    icon: ShieldCheckIcon,
  };

function IncidentBadge({ type }: { type: string }) {
  const m = typeMeta(type);
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <m.icon aria-hidden /> {m.label}
    </Badge>
  );
}

const fullName = (first?: string, last?: string) =>
  [first, last].filter(Boolean).join(' ');
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

type View = 'incidents' | 'removed' | 'appeals' | 'settings';

/** Course page → Proctoring: what the checks caught, who was removed, appeals, and the check settings. */
export function CourseIntegrity({
  courseId,
  versionId,
}: {
  courseId: string;
  versionId: string;
}) {
  const [view, setView] = useState<View>('incidents');
  const appeals = useAppeals(courseId, versionId);
  // Removing and reinstating students (and the removal history) are admin-only on the backend.
  const { isAdmin } = useStudioAccess();
  const waiting =
    appeals.data?.filter((a) => a.status === 'PENDING').length ?? 0;

  return (
    <div className="grid gap-5">
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList className="max-w-full overflow-x-auto [scrollbar-width:none]">
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          {isAdmin && <TabsTrigger value="removed">Removed</TabsTrigger>}
          <TabsTrigger value="appeals">
            Appeals{' '}
            {waiting > 0 && (
              <Badge className="ml-0.5 h-5 min-w-5 px-1 tabular-nums">
                {waiting}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === 'incidents' && (
        <Incidents courseId={courseId} versionId={versionId} />
      )}
      {isAdmin && view === 'removed' && (
        <Removed courseId={courseId} versionId={versionId} />
      )}
      {view === 'appeals' && (
        <Appeals courseId={courseId} versionId={versionId} />
      )}
      {view === 'settings' && (
        <CourseProctoring courseId={courseId} versionId={versionId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

interface StudentSummary {
  userId: string;
  name: string;
  email: string;
  count: number;
  byType: [string, number][];
  last: string;
}

function Incidents({
  courseId,
  versionId,
}: {
  courseId: string;
  versionId: string;
}) {
  const [view, setView] = useState<'students' | 'all'>('students');
  const stats = useIncidentStats(courseId, versionId);
  // One large page for the per-student grouping and headline numbers.
  const everything = useIncidents(courseId, versionId, {
    page: 1,
    limit: 1000,
  });
  const version = useCourseVersion(versionId);
  const { items } = useFlatSyllabus(version.data);
  const lessonName = useMemo(
    () => new Map(items.map((i) => [i._id, i.name])),
    [items],
  );
  const [openIncident, setOpenIncident] = useState<Incident | null>(null);
  const [openStudent, setOpenStudent] = useState<StudentSummary | null>(null);

  const students = useMemo<StudentSummary[]>(() => {
    const map = new Map<
      string,
      StudentSummary & { counts: Map<string, number> }
    >();
    for (const i of everything.data?.incidents ?? []) {
      const s = map.get(i.userId) ?? {
        userId: i.userId,
        name: i.studentName || 'Student',
        email: i.studentEmail ?? '',
        count: 0,
        byType: [],
        last: i.createdAt,
        counts: new Map(),
      };
      s.count++;
      s.counts.set(i.type, (s.counts.get(i.type) ?? 0) + 1);
      if (i.createdAt > s.last) s.last = i.createdAt;
      map.set(i.userId, s);
    }
    return [...map.values()]
      .map(({ counts, ...s }) => ({
        ...s,
        byType: [...counts.entries()].sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => b.count - a.count);
  }, [everything.data]);

  if (stats.isPending || everything.isPending)
    return <Skeleton className="h-64 rounded-2xl" />;
  if (stats.isError) return <ErrorText error={stats.error} />;
  if (everything.isError) return <ErrorText error={everything.error} />;

  const byType = Object.entries(stats.data ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [string, number][];
  const total = byType.reduce((s, [, n]) => s + n, 0);

  if (total === 0) {
    return (
      <Empty className="rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>No incidents</EmptyTitle>
          <EmptyDescription>
            When a proctoring check flags something during a lesson, it appears
            here with a photo if one was taken.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const peak = byType[0]?.[1] ?? 1;

  return (
    <div className="grid gap-4">
      <StatStrip
        stats={[
          { label: 'Incidents', value: total },
          { label: 'Students flagged', value: students.length },
          {
            label: 'Most common',
            value:
              byType.length > 1 && byType[0][1] === byType[1][1]
                ? 'No single type'
                : typeMeta(byType[0][0]).label,
          },
        ]}
      />

      <Card className="gap-4 px-5 py-5 sm:px-6">
        <p className="font-medium">By type</p>
        <ul className="grid gap-3" aria-label="Incidents by type">
          {byType.map(([type, n]) => {
            const m = typeMeta(type);
            return (
              <li
                key={type}
                className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <m.icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />{' '}
                  {m.label}
                </span>
                <Progress
                  value={(n / peak) * 100}
                  className="h-2"
                  aria-label={`${m.label}: ${n}`}
                />
                <span className="w-8 text-right tabular-nums">{n}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Tabs
        value={view}
        onValueChange={(v) => setView(v as 'students' | 'all')}
      >
        <TabsList>
          <TabsTrigger value="students">By student</TabsTrigger>
          <TabsTrigger value="all">All incidents</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'students' ? (
        <ul className="grid gap-2">
          {students.map((s) => (
            <li key={s.userId}>
              <button
                type="button"
                onClick={() => setOpenStudent(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/40"
              >
                <GeneratedAvatar seed={s.userId} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.byType
                      .slice(0, 3)
                      .map(([t, n]) => `${typeMeta(t).label} ×${n}`)
                      .join(' · ')}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums">
                    {s.count}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    last {formatDate(s.last)}
                  </span>
                </span>
                <ChevronRightIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <AllIncidents
          courseId={courseId}
          versionId={versionId}
          lessonName={lessonName}
          onOpen={setOpenIncident}
          types={byType.map(([t]) => t as IncidentType)}
        />
      )}

      <IncidentSheet
        courseId={courseId}
        versionId={versionId}
        incident={openIncident}
        lessonName={lessonName}
        onClose={() => setOpenIncident(null)}
      />
      <StudentSheet
        courseId={courseId}
        versionId={versionId}
        student={openStudent}
        incidents={(everything.data?.incidents ?? []).filter(
          (i) => i.userId === openStudent?.userId,
        )}
        lessonName={lessonName}
        onClose={() => setOpenStudent(null)}
        onOpenIncident={(i) => {
          setOpenStudent(null);
          setOpenIncident(i);
        }}
      />
    </div>
  );
}

function AllIncidents({
  courseId,
  versionId,
  lessonName,
  onOpen,
  types,
}: {
  courseId: string;
  versionId: string;
  lessonName: Map<string, string>;
  onOpen: (i: Incident) => void;
  types: IncidentType[];
}) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<IncidentType | ''>('');
  const [search, setSearch] = useState('');
  const list = useIncidents(courseId, versionId, {
    page,
    limit: 20,
    type: type || undefined,
    search: search.trim() || undefined,
  });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Filter by type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as IncidentType | '');
            setPage(1);
          }}
        >
          <NativeSelectOption value="">All types</NativeSelectOption>
          {types.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {typeMeta(t).label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <InputGroup className="min-w-48 flex-1 bg-card sm:max-w-64">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search students"
            placeholder="Search students…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </InputGroup>
      </div>
      {list.isPending && <Skeleton className="h-48 rounded-2xl" />}
      {list.isError && <ErrorText error={list.error} />}
      {list.data && list.data.incidents.length === 0 && (
        <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          No incidents match.
        </p>
      )}
      {list.data && list.data.incidents.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>What</TableHead>
                <TableHead className="max-sm:hidden">Lesson</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.incidents.map((i) => (
                <TableRow
                  key={i._id}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`${typeMeta(i.type).label}, ${i.studentName ?? 'student'}, ${when(i.createdAt)}: view`}
                  onClick={() => onOpen(i)}
                  onKeyDown={(e) =>
                    (e.key === 'Enter' || e.key === ' ') &&
                    (e.preventDefault(), onOpen(i))
                  }
                >
                  <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                    {when(i.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-40 truncate">
                    {i.studentName ?? 'Student'}
                  </TableCell>
                  <TableCell>
                    <IncidentBadge type={i.type} />
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground max-sm:hidden">
                    {(i.itemId && lessonName.get(i.itemId)) || '—'}
                  </TableCell>
                  <TableCell className="pr-4">
                    <ChevronRightIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {list.data && list.data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Page {page} of {list.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= list.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function IncidentPhoto({
  courseId,
  versionId,
  incident,
}: {
  courseId: string;
  versionId: string;
  incident: Incident;
}) {
  const photo = useIncidentPhoto(courseId, versionId, incident);
  if (!incident.fileName || photo.isError || (photo.isSuccess && !photo.data)) {
    return (
      <div className="grid aspect-video place-items-center rounded-xl bg-muted text-center text-sm text-muted-foreground">
        <span className="grid justify-items-center gap-1.5">
          <ImageOffIcon className="size-5" aria-hidden />
          No photo was saved with this incident.
        </span>
      </div>
    );
  }
  if (photo.isPending) return <Skeleton className="aspect-video rounded-xl" />;
  return (
    <img
      src={photo.data!}
      alt={`Camera snapshot: ${typeMeta(incident.type).label}`}
      className="aspect-video w-full rounded-xl bg-black object-contain"
    />
  );
}

function IncidentSheet({
  courseId,
  versionId,
  incident,
  lessonName,
  onClose,
}: {
  courseId: string;
  versionId: string;
  incident: Incident | null;
  lessonName: Map<string, string>;
  onClose: () => void;
}) {
  const dismiss = useDismissIncident(courseId, versionId);
  const [confirming, setConfirming] = useState(false);
  return (
    <Sheet open={!!incident} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {incident && (
          <>
            <SheetHeader>
              <SheetTitle>{typeMeta(incident.type).label}</SheetTitle>
              <SheetDescription>
                {typeMeta(incident.type).description}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4">
              <IncidentPhoto
                courseId={courseId}
                versionId={versionId}
                incident={incident}
              />
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Student</dt>
                  <dd className="text-right">
                    {incident.studentName ?? 'Student'}
                    {incident.studentEmail && (
                      <span className="block text-xs text-muted-foreground">
                        {incident.studentEmail}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">When</dt>
                  <dd>{when(incident.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Lesson</dt>
                  <dd className="text-right">
                    {(incident.itemId && lessonName.get(incident.itemId)) ||
                      '—'}
                  </dd>
                </div>
              </dl>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setConfirming(true)}>
                Dismiss as false alarm
              </Button>
            </SheetFooter>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Dismiss this incident?"
              description="It’s deleted, along with its photo, and no longer counts against the student."
              confirmLabel="Dismiss"
              onConfirm={async () => {
                await dismiss.mutateAsync(incident._id);
                toast.success('Incident dismissed.');
                onClose();
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StudentSheet({
  courseId,
  versionId,
  student,
  incidents,
  lessonName,
  onClose,
  onOpenIncident,
}: {
  courseId: string;
  versionId: string;
  student: StudentSummary | null;
  incidents: Incident[];
  lessonName: Map<string, string>;
  onClose: () => void;
  onOpenIncident: (i: Incident) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const { isAdmin } = useStudioAccess();
  return (
    <Sheet open={!!student} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {student && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <GeneratedAvatar seed={student.userId} size={40} />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{student.name}</SheetTitle>
                  <SheetDescription className="truncate">
                    {student.email}
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {student.byType.map(([t, n]) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="gap-1 font-normal"
                  >
                    {typeMeta(t).label}{' '}
                    <span className="tabular-nums">×{n}</span>
                  </Badge>
                ))}
              </div>
            </SheetHeader>
            <ol
              className="grid gap-2 px-4"
              aria-label="Incidents, newest first"
            >
              {[...incidents]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((i) => (
                  <li key={i._id}>
                    <button
                      type="button"
                      onClick={() => onOpenIncident(i)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/40"
                    >
                      <IncidentBadge type={i.type} />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {(i.itemId && lessonName.get(i.itemId)) || ''}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {when(i.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
            </ol>
            <SheetFooter>
              {isAdmin ? (
                <Button variant="destructive" onClick={() => setRemoving(true)}>
                  <UserMinusIcon aria-hidden /> Remove from course
                </Button>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Only an admin can remove a student from the course.
                </p>
              )}
            </SheetFooter>
            <RemoveDialog
              courseId={courseId}
              versionId={versionId}
              open={removing}
              onOpenChange={setRemoving}
              student={student}
              suggested={`Repeated proctoring incidents: ${student.byType.map(([t, n]) => `${typeMeta(t).label.toLowerCase()} (${n})`).join(', ')}.`}
              onDone={onClose}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RemoveDialog({
  courseId,
  versionId,
  open,
  onOpenChange,
  student,
  suggested,
  onDone,
}: {
  courseId: string;
  versionId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  student: { userId: string; name: string };
  suggested: string;
  onDone: () => void;
}) {
  const remove = useRemoveStudent(courseId, versionId);
  const [reason, setReason] = useState(suggested);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setReason(suggested);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {student.name} from this course?</DialogTitle>
          <DialogDescription>
            They lose access straight away and get an email with the reason
            below. You can reinstate them later.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="remove-reason">Reason</FieldLabel>
          <Textarea
            id="remove-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <FieldDescription>The student sees this.</FieldDescription>
        </Field>
        {remove.isError && <ErrorText error={remove.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || remove.isPending}
            onClick={() =>
              remove.mutate(
                { userId: student.userId, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success(
                      `${student.name} was removed from the course.`,
                    );
                    onOpenChange(false);
                    onDone();
                  },
                },
              )
            }
          >
            {remove.isPending && <Spinner className="size-4" />}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Removed students
// ---------------------------------------------------------------------------

function Removed({
  courseId,
  versionId,
}: {
  courseId: string;
  versionId: string;
}) {
  const history = useRemovalHistory(courseId, versionId);
  const reinstate = useReinstateStudent(courseId, versionId);
  const [confirm, setConfirm] = useState<Removal | null>(null);

  // The newest entry per student says whether they're still removed.
  const current = useMemo(() => {
    const seen = new Map<string, Removal>();
    for (const h of history.data ?? [])
      if (!seen.has(h.userId)) seen.set(h.userId, h);
    return [...seen.values()].filter((h) => h.type === 'EJECTED');
  }, [history.data]);

  if (history.isPending) return <Skeleton className="h-40 rounded-2xl" />;
  if (history.isError) return <ErrorText error={history.error} />;
  if (current.length === 0) {
    return (
      <Empty className="rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserMinusIcon />
          </EmptyMedia>
          <EmptyTitle>No one is removed</EmptyTitle>
          <EmptyDescription>
            Students you remove, or that the course’s rules remove
            automatically, appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="grid gap-2">
      {current.map((r) => (
        <li key={r.userId}>
          <Card className="gap-3 px-4 py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <GeneratedAvatar seed={r.userId} size={36} />
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {fullName(r.firstName, r.lastName) || 'Student'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.email}
                </p>
                <p className="mt-1 text-sm">{r.reason}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.trigger === 'MANUAL'
                    ? `Removed by ${r.by ?? 'a teacher'}`
                    : 'Removed automatically'}{' '}
                  · {formatDate(r.at)}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setConfirm(r)}
              className="shrink-0"
            >
              Reinstate
            </Button>
          </Card>
        </li>
      ))}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Reinstate ${fullName(confirm?.firstName, confirm?.lastName) || 'this student'}?`}
        description="They get access to the course again, with their progress as it was."
        confirmLabel="Reinstate"
        destructive={false}
        onConfirm={async () => {
          await reinstate.mutateAsync(confirm!.userId);
          toast.success('Student reinstated.');
        }}
      />
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------

function Appeals({
  courseId,
  versionId,
}: {
  courseId: string;
  versionId: string;
}) {
  const appeals = useAppeals(courseId, versionId);
  const decide = useDecideAppeal(courseId, versionId);
  // Approving reinstates the student, which is otherwise admin-only, so admins decide appeals.
  const { isAdmin } = useStudioAccess();
  const [status, setStatus] = useState<Appeal['status']>('PENDING');
  const [rejecting, setRejecting] = useState<Appeal | null>(null);
  const [reason, setReason] = useState('');

  if (appeals.isPending) return <Skeleton className="h-40 rounded-2xl" />;
  if (appeals.isError) return <ErrorText error={appeals.error} />;
  const shown = (appeals.data ?? []).filter((a) => a.status === status);

  return (
    <div className="grid gap-3">
      <Tabs
        value={status}
        onValueChange={(v) => setStatus(v as Appeal['status'])}
      >
        <TabsList>
          <TabsTrigger value="PENDING">Waiting</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>
      {shown.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>
              {status === 'PENDING' ? 'No appeals waiting' : 'Nothing here'}
            </EmptyTitle>
            <EmptyDescription>
              Students removed from a course with cohorts can appeal; their
              appeals appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid gap-2">
          {shown.map((a) => (
            <li key={a._id}>
              <Card className="gap-3 px-4 py-4">
                <div className="flex items-center gap-3">
                  <GeneratedAvatar seed={a.student.id} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {fullName(a.student.firstName, a.student.lastName) ||
                        'Student'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.student.email} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                </div>
                <blockquote className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
                  {a.reason}
                </blockquote>
                {a.evidenceImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {a.evidenceImages.map((src, n) =>
                      /^https?:/.test(src) ? (
                        <a
                          key={src}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline underline-offset-4"
                        >
                          Evidence {n + 1}
                        </a>
                      ) : null,
                    )}
                  </div>
                )}
                {a.status === 'REJECTED' && a.rejectionReason && (
                  <p className="text-sm text-muted-foreground">
                    Reason: {a.rejectionReason}
                  </p>
                )}
                {a.status === 'PENDING' && !isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Waiting for an admin to decide.
                  </p>
                )}
                {a.status === 'PENDING' && isAdmin && (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReason('');
                        setRejecting(a);
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate(
                          { id: a._id, approve: true },
                          {
                            onSuccess: () =>
                              toast.success(
                                'Appeal approved: the student is reinstated.',
                              ),
                          },
                        )
                      }
                    >
                      Approve and reinstate
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this appeal?</DialogTitle>
            <DialogDescription>
              The student stays removed and sees your reason.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="appeal-reason">Reason</FieldLabel>
            <Textarea
              id="appeal-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || decide.isPending}
              onClick={() =>
                decide.mutate(
                  { id: rejecting!._id, approve: false, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      toast.success('Appeal rejected.');
                      setRejecting(null);
                    },
                  },
                )
              }
            >
              Reject appeal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
