import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  InfoIcon,
  MailPlusIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useDebounceValue } from 'usehooks-ts';

import { GeneratedAvatar } from '@/components/generated-art';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

import {
  DEFAULT_PEOPLE_SORT,
  nextSort,
  SORT_OPTIONS,
  sortKey,
  type PeopleSort,
} from './people-sort';
import {
  useCourseEnrollmentsPage,
  useInviteUser,
  type PeopleSortBy,
} from './queries';
import { ErrorText, formatDate, RoleBadge } from './studio-ui';

type RoleFilter = 'all' | 'STUDENT' | 'INSTRUCTOR';

/** Everyone enrolled in this version, Substack "Subscribers"-style, plus Luma-style invites. */
export function CoursePeople({
  courseId,
  versionId,
  inviteOpen,
  onInviteOpenChange,
  sort = DEFAULT_PEOPLE_SORT,
  onSortChange,
}: {
  courseId: string;
  versionId: string;
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
  /** Whole-course order, done by the backend (it lives in the URL). */
  sort?: PeopleSort;
  onSortChange: (sort: PeopleSort) => void;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);
  const [search] = useDebounceValue(query.trim(), 300);
  useEffect(() => setPage(1), [search, role, sort.by, sort.order]);

  const enrollments = useCourseEnrollmentsPage(courseId, versionId, {
    page,
    search,
    filter:
      role === 'all' ? undefined : role === 'STUDENT' ? 'STUDENT' : 'OTHER',
    sortBy: sort.by,
    sortOrder: sort.order,
  });
  const sortBy = (by: PeopleSortBy) => onSortChange(nextSort(sort, by));
  // Whole-course counts for the tabs. A limit of 1, since only the totals matter.
  const students = useCourseEnrollmentsPage(courseId, versionId, {
    limit: 1,
    filter: 'STUDENT',
  });
  const staff = useCourseEnrollmentsPage(courseId, versionId, {
    limit: 1,
    filter: 'OTHER',
  });
  const counts =
    students.data && staff.data
      ? {
          all: students.data.total + staff.data.total,
          STUDENT: students.data.total,
          INSTRUCTOR: staff.data.total,
        }
      : null;
  const shown = enrollments.data?.enrollments ?? [];
  const totalPages = enrollments.data?.totalPages ?? 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
          <TabsList>
            <TabsTrigger value="all">
              All{' '}
              {counts && (
                <span className="text-muted-foreground tabular-nums">
                  {counts.all.toLocaleString()}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="STUDENT">
              Students{' '}
              {counts && (
                <span className="text-muted-foreground tabular-nums">
                  {counts.STUDENT.toLocaleString()}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="INSTRUCTOR">
              Instructors{' '}
              {counts && (
                <span className="text-muted-foreground tabular-nums">
                  {counts.INSTRUCTOR.toLocaleString()}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <InputGroup className="flex-1 bg-card sm:w-64">
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search people"
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          {/* The Progress and Joined headers are hidden on small screens, so sorting moves here. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label="Sort people"
                />
              }
            >
              <ArrowUpDownIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortKey(sort)}
                  onValueChange={(v) => {
                    const next = SORT_OPTIONS.find((o) => sortKey(o) === v);
                    if (next) onSortChange({ by: next.by, order: next.order });
                  }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <DropdownMenuRadioItem
                      key={sortKey(o)}
                      value={sortKey(o)}
                      closeOnClick
                    >
                      {o.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => onInviteOpenChange(true)}>
            <MailPlusIcon aria-hidden /> Invite
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {enrollments.isPending && <Skeleton className="h-48 rounded-2xl" />}
        {enrollments.isError && <ErrorText error={enrollments.error} />}
        {counts?.all === 0 && (
          <Empty className="rounded-2xl border border-dashed border-border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>No one here yet</EmptyTitle>
              <EmptyDescription>
                Invite students by email, or share the registration link from
                the Overview tab.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => onInviteOpenChange(true)}>
                Invite people
              </Button>
            </EmptyContent>
          </Empty>
        )}
        {enrollments.data && counts?.all !== 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <SortHead
                    by="name"
                    sort={sort}
                    onSort={sortBy}
                    className="pl-4"
                  >
                    Person
                  </SortHead>
                  <TableHead>Role</TableHead>
                  <SortHead
                    by="progress"
                    sort={sort}
                    onSort={sortBy}
                    className="hidden md:table-cell"
                    hint={
                      <Hint
                        label="Progress"
                        text="Lessons completed in strict mode. This is the course progress used for completion and certificates."
                      />
                    }
                  >
                    <span
                      className="size-2 rounded-full bg-emerald-500"
                      aria-hidden
                    />
                    Progress
                  </SortHead>
                  <TableHead className="hidden md:table-cell">
                    <HeadWithHint
                      label="Study"
                      dot="bg-sky-500"
                      hint="Videos and articles the student studied in study mode or completed in strict mode. Doesn’t count towards completion."
                    />
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Status</TableHead>
                  <SortHead
                    by="enrollmentDate"
                    sort={sort}
                    onSort={sortBy}
                    className="hidden pr-4 text-right sm:table-cell"
                    alignEnd
                  >
                    Joined
                  </SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((e) => (
                  <TableRow key={`${e.user._id}:${e.role}`}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <GeneratedAvatar seed={e.user._id} size={30} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {e.user.firstName} {e.user.lastName ?? ''}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {e.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={e.role} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {e.role === 'STUDENT' ? (
                        <div className="flex w-28 items-center gap-2">
                          <Progress
                            value={e.progress ?? 0}
                            className="h-1.5 flex-1 [&_[data-slot=progress-indicator]]:bg-emerald-500"
                            aria-label={`${e.user.firstName}'s progress`}
                          />
                          <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                            {Math.round(e.progress ?? 0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {e.role === 'STUDENT' && e.studyProgress ? (
                        <div
                          className="flex w-28 items-center gap-2"
                          title={`${e.studyProgress.studiedItems} of ${e.studyProgress.totalItems} videos & articles`}
                        >
                          <Progress
                            value={e.studyProgress.percentStudied}
                            className="h-1.5 flex-1 [&_[data-slot=progress-indicator]]:bg-sky-500"
                            aria-label={`${e.user.firstName}'s study progress`}
                          />
                          <span className="w-9 text-right text-xs text-sky-700 tabular-nums dark:text-sky-300">
                            {e.studyProgress.percentStudied}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground capitalize xl:table-cell">
                      {e.status.toLowerCase()}
                    </TableCell>
                    <TableCell className="hidden pr-4 text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDate(e.enrollmentDate)}
                    </TableCell>
                  </TableRow>
                ))}
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No one matches.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <span className="mr-auto text-sm text-muted-foreground tabular-nums">
              Page {page} of {totalPages}
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
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <InviteDialog
        courseId={courseId}
        versionId={versionId}
        open={inviteOpen}
        onOpenChange={onInviteOpenChange}
      />
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Luma-style invite: collect several emails as chips, pick a role, send in one go. */
export function InviteDialog({
  courseId,
  versionId,
  open,
  onOpenChange,
}: {
  courseId: string;
  versionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invite = useInviteUser();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');
  const [draftError, setDraftError] = useState('');

  /** Moves valid addresses from `text` into the chip list; returns them, or null if any are invalid. */
  function take(text: string): string[] | null {
    const parts = text
      .split(/[\s,;]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    const bad = parts.filter((p) => !EMAIL.test(p));
    if (bad.length) {
      setDraftError(`Not an email: ${bad.join(', ')}`);
      return null;
    }
    setEmails((prev) => [...new Set([...prev, ...parts])]);
    setDraft('');
    setDraftError('');
    return parts;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      if (draft.trim()) {
        e.preventDefault();
        take(draft);
      }
    } else if (e.key === 'Backspace' && !draft && emails.length) {
      setEmails((prev) => prev.slice(0, -1));
    }
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setEmails([]);
      setDraft('');
      setDraftError('');
      invite.reset();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const pending = take(draft);
    if (!pending) return;
    const all = [...new Set([...emails, ...pending])];
    if (all.length === 0) {
      setDraftError('Add at least one email.');
      return;
    }
    invite.mutate(
      { courseId, versionId, emails: all, role },
      {
        onSuccess: () => {
          toast.success(
            `Invited ${all.length} ${all.length === 1 ? 'person' : 'people'} as ${role === 'STUDENT' ? 'student' : 'instructor'}${all.length === 1 ? '' : 's'}.`,
          );
          close(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            They’ll get an email invite and see the course once they accept.
          </DialogDescription>
        </DialogHeader>
        <form id="invite-people" onSubmit={onSubmit} className="grid gap-4">
          <Field>
            <FieldLabel id="invite-as">Invite as</FieldLabel>
            <Tabs
              value={role}
              onValueChange={(v) => setRole(v as 'STUDENT' | 'INSTRUCTOR')}
            >
              <TabsList aria-labelledby="invite-as" className="w-full">
                <TabsTrigger value="STUDENT">Student</TabsTrigger>
                <TabsTrigger value="INSTRUCTOR">Instructor</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field>
            <FieldLabel htmlFor="invite-emails">Emails</FieldLabel>
            <div className="flex min-h-24 flex-wrap content-start gap-1.5 rounded-lg border border-input bg-card p-2 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-secondary pr-1 pl-2 text-sm text-secondary-foreground"
                >
                  {email}
                  <button
                    type="button"
                    aria-label={`Remove ${email}`}
                    onClick={() =>
                      setEmails((prev) => prev.filter((x) => x !== email))
                    }
                    className="grid size-5 place-items-center rounded hover:bg-black/5"
                  >
                    <XIcon className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
              <Input
                id="invite-emails"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftError('');
                }}
                onKeyDown={onKeyDown}
                onBlur={() => draft.trim() && take(draft)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  if (/[\s,;]/.test(text.trim())) {
                    e.preventDefault();
                    if (!take(text)) setDraft(text);
                  }
                }}
                placeholder={emails.length ? '' : 'name@example.com'}
                className="h-7 min-w-40 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
            <FieldDescription>
              Press Enter or comma after each address. You can paste a list.
            </FieldDescription>
            {draftError && (
              <p role="alert" className="text-sm text-destructive">
                {draftError}
              </p>
            )}
          </Field>
          {invite.isError && <ErrorText error={invite.error} />}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="invite-people"
            disabled={invite.isPending}
          >
            {invite.isPending && <Spinner className="size-4" />}
            Send {emails.length > 1 ? `${emails.length} invites` : 'invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A column header that sorts the whole course (through the backend) when
 * clicked. Arrows show the current direction; the others show a faint
 * up-down mark so it's clear they can be sorted.
 */
function SortHead({
  by,
  sort,
  onSort,
  className,
  alignEnd,
  hint,
  children,
}: {
  by: PeopleSortBy;
  sort: PeopleSort;
  onSort: (by: PeopleSortBy) => void;
  className?: string;
  alignEnd?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const active = sort.by === by;
  const Icon = !active
    ? ChevronsUpDownIcon
    : sort.order === 'asc'
      ? ArrowUpIcon
      : ArrowDownIcon;
  return (
    <TableHead
      className={className}
      aria-sort={
        active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <span
        className={cn(
          'inline-flex items-center gap-0.5',
          alignEnd && 'justify-end',
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 gap-1.5 px-2 font-medium',
            alignEnd ? '-mr-2' : '-ml-2',
            active ? 'text-foreground' : 'text-muted-foreground',
          )}
          onClick={() => onSort(by)}
        >
          {children}
          <Icon
            className={cn('size-3.5', !active && 'opacity-50')}
            aria-hidden
          />
        </Button>
        {hint}
      </span>
    </TableHead>
  );
}

/** An info mark that explains a column in a tooltip. */
function Hint({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`About ${label}`}
            className="grid size-6 place-items-center rounded text-muted-foreground/70 hover:text-foreground"
          />
        }
      >
        <InfoIcon className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

/** A table header with a colour dot (matching its bar) and an explanation in a tooltip. */
function HeadWithHint({
  label,
  dot,
  hint,
}: {
  label: string;
  dot: string;
  hint: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex cursor-default items-center gap-1.5" />
        }
      >
        <span className={cn('size-2 rounded-full', dot)} aria-hidden />
        {label}
        <InfoIcon className="size-3.5 text-muted-foreground/70" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{hint}</TooltipContent>
    </Tooltip>
  );
}
