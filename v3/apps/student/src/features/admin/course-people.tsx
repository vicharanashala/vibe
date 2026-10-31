import { MailPlusIcon, SearchIcon, UsersIcon, XIcon } from 'lucide-react';
import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

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

import { useCourseEnrollments, useInviteUser } from './queries';
import { ErrorText, formatDate, RoleBadge } from './studio-ui';

type RoleFilter = 'all' | 'STUDENT' | 'INSTRUCTOR';

/** Everyone enrolled in this version, Substack "Subscribers"-style, plus Luma-style invites. */
export function CoursePeople({
  courseId,
  versionId,
  inviteOpen,
  onInviteOpenChange,
}: {
  courseId: string;
  versionId: string;
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
}) {
  const enrollments = useCourseEnrollments(courseId, versionId);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (enrollments.data ?? []).filter(
      (e) =>
        (role === 'all' || e.role === role) &&
        (!q ||
          e.user.email.toLowerCase().includes(q) ||
          `${e.user.firstName} ${e.user.lastName ?? ''}`
            .toLowerCase()
            .includes(q)),
    );
  }, [enrollments.data, query, role]);

  const count = (r: RoleFilter) =>
    (enrollments.data ?? []).filter((e) => r === 'all' || e.role === r).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
          <TabsList>
            <TabsTrigger value="all">
              All{' '}
              {enrollments.data && (
                <span className="text-muted-foreground tabular-nums">
                  {count('all')}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="STUDENT">
              Students{' '}
              {enrollments.data && (
                <span className="text-muted-foreground tabular-nums">
                  {count('STUDENT')}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="INSTRUCTOR">
              Instructors{' '}
              {enrollments.data && (
                <span className="text-muted-foreground tabular-nums">
                  {count('INSTRUCTOR')}
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
          <Button onClick={() => onInviteOpenChange(true)}>
            <MailPlusIcon aria-hidden /> Invite
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {enrollments.isPending && <Skeleton className="h-48 rounded-2xl" />}
        {enrollments.isError && <ErrorText error={enrollments.error} />}
        {enrollments.data && enrollments.data.length === 0 && (
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
        {enrollments.data && enrollments.data.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Progress
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden pr-4 text-right sm:table-cell">
                    Joined
                  </TableHead>
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
                        <div className="flex w-36 items-center gap-2">
                          <Progress
                            value={e.progress ?? 0}
                            className="h-1.5 flex-1"
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
                    <TableCell className="hidden text-muted-foreground capitalize sm:table-cell">
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
                      colSpan={5}
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
