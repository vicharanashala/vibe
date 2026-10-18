import {
  CheckIcon,
  ClipboardListIcon,
  EyeIcon,
  PencilLineIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GeneratedAvatar } from '@/components/generated-art';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
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
import { Switch } from '@/components/ui/switch';
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
import { FeedbackFormFields } from '@/features/feedback/feedback-form';
import { FormBuilder } from '@/features/feedback/form-builder';
import {
  fieldName,
  fieldsToSchema,
  formProblem,
  schemaToFields,
  type FieldKind,
  type FormField,
  type FormValues,
} from '@/features/feedback/form-schema';

import { useAllUsers } from './queries';
import {
  useBulkApproveRegistrations,
  useRegistrationRequests,
  useRegistrationSettings,
  useSaveAutoApproval,
  useSaveRegistrationForm,
  useSetRegistrationStatus,
  useToggleRegistration,
  type RegistrationRequest,
  type RegistrationSettings,
  type RegistrationStatus,
} from './registration-api';
import { ConfirmDialog, ErrorText, formatDate } from './studio-ui';

/** The field types the student registration page can render (features/registration/schema-form.tsx). */
const REGISTRATION_KINDS: FieldKind[] = [
  'text',
  'textarea',
  'radio',
  'select',
  'checkbox',
  'number',
  'email',
  'date',
];

type View = 'requests' | 'form' | 'settings';

/** Course page → Registration: who asked to join, the form they fill in, and how requests are handled. */
export function CourseRegistration({
  versionId,
  registrationLink,
}: {
  versionId: string;
  registrationLink: React.ReactNode;
}) {
  const [view, setView] = useState<View>('requests');
  const settings = useRegistrationSettings(versionId);
  const pending = useRegistrationRequests(versionId, {
    page: 1,
    status: 'PENDING',
    search: '',
  });

  return (
    <div className="grid gap-5">
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="requests">
            Requests{' '}
            {pending.data && pending.data.total > 0 && (
              <Badge className="ml-0.5 h-5 min-w-5 px-1 tabular-nums">
                {pending.data.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
      </Tabs>
      {settings.isPending ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : settings.isError ? (
        <ErrorText error={settings.error} />
      ) : view === 'requests' ? (
        <Requests versionId={versionId} settings={settings.data} />
      ) : view === 'form' ? (
        <RegistrationForm versionId={versionId} settings={settings.data} />
      ) : (
        <RegistrationSettingsPanel
          versionId={versionId}
          settings={settings.data}
          registrationLink={registrationLink}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function RegistrationSettingsPanel({
  versionId,
  settings,
  registrationLink,
}: {
  versionId: string;
  settings: RegistrationSettings;
  registrationLink: React.ReactNode;
}) {
  const toggle = useToggleRegistration(versionId);
  const saveAuto = useSaveAutoApproval(versionId);
  const [auto, setAuto] = useState(settings.registrationsAutoApproved);
  const [patterns, setPatterns] = useState(
    settings.autoapproval_emails.join('\n'),
  );
  const parsed = patterns
    .split(/[\n,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const dirty =
    auto !== settings.registrationsAutoApproved ||
    parsed.join('\n') !== settings.autoapproval_emails.join('\n');

  return (
    <div className="grid gap-4">
      <Card className="px-5 py-5 sm:px-6">
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="reg-open">Accepting registrations</FieldLabel>
            <FieldDescription>
              {settings.isActive
                ? 'Students with the link can ask to join.'
                : 'The registration link shows that registration is closed.'}
            </FieldDescription>
          </FieldContent>
          <Switch
            id="reg-open"
            checked={settings.isActive}
            disabled={toggle.isPending}
            onCheckedChange={(c) =>
              toggle.mutate(c === true, {
                onSuccess: () =>
                  toast.success(
                    c ? 'Registration is open.' : 'Registration is closed.',
                  ),
                onError: (e) => toast.error((e as Error).message),
              })
            }
          />
        </Field>
      </Card>

      {registrationLink}

      <Card className="gap-4 px-5 py-5 sm:px-6">
        <FieldGroup className="gap-4">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="reg-auto">Approve automatically</FieldLabel>
              <FieldDescription>
                Approved students are enrolled straight away and get an email.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="reg-auto"
              checked={auto}
              onCheckedChange={(c) => setAuto(c === true)}
            />
          </Field>
          {auto && (
            <Field>
              <FieldLabel htmlFor="reg-patterns">
                Only for these emails (optional)
              </FieldLabel>
              <Textarea
                id="reg-patterns"
                rows={3}
                value={patterns}
                onChange={(e) => setPatterns(e.target.value)}
                placeholder={'@iitrpr.ac.in\nstudent@example.com'}
              />
              <FieldDescription>
                One per line. An address is approved if it contains any of
                these, so “@iitrpr.ac.in” covers a whole domain. Leave empty to
                approve everyone; anyone else waits for you.
              </FieldDescription>
            </Field>
          )}
          {(dirty || saveAuto.isError) && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {saveAuto.isError && (
                <ErrorText error={saveAuto.error} className="mr-auto" />
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setAuto(settings.registrationsAutoApproved);
                  setPatterns(settings.autoapproval_emails.join('\n'));
                }}
              >
                Discard
              </Button>
              <Button
                disabled={saveAuto.isPending}
                onClick={() =>
                  saveAuto.mutate(
                    {
                      registrationsAutoApproved: auto,
                      autoapproval_emails: auto ? parsed : [],
                    },
                    {
                      onSuccess: () =>
                        toast.success('Approval settings saved.'),
                    },
                  )
                }
              >
                {saveAuto.isPending && <Spinner className="size-4" />}
                Save
              </Button>
            </div>
          )}
        </FieldGroup>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function RegistrationForm({
  versionId,
  settings,
}: {
  versionId: string;
  settings: RegistrationSettings;
}) {
  const save = useSaveRegistrationForm(versionId);
  const initial = useMemo(
    () =>
      schemaToFields(
        settings.jsonSchema ?? undefined,
        settings.uiSchema ?? undefined,
      ),
    [settings.jsonSchema, settings.uiSchema],
  );
  const [fields, setFields] = useState<FormField[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<FormValues>({});

  function onSave() {
    const problem = fields.length ? formProblem(fields) : null;
    if (problem) return void toast.error(problem);
    const { jsonSchema, uiSchema } = fieldsToSchema(fields);
    save.mutate(
      { settings, jsonSchema, uiSchema },
      {
        onSuccess: () => {
          setDirty(false);
          toast.success('Registration form saved.');
        },
      },
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          {fields.length === 0
            ? 'No questions: students register with one click.'
            : 'What students answer when they ask to join. Answers appear with each request.'}
        </p>
        {fields.length > 0 && (
          <Button variant="secondary" onClick={() => setPreview((p) => !p)}>
            {preview ? <PencilLineIcon aria-hidden /> : <EyeIcon aria-hidden />}
            {preview ? 'Edit' : 'Preview'}
          </Button>
        )}
      </div>

      {preview ? (
        <FeedbackFormFields
          cards
          fields={fields}
          values={previewValues}
          onChange={(n, v) => setPreviewValues((p) => ({ ...p, [n]: v }))}
          idPrefix="reg-preview"
        />
      ) : (
        <FormBuilder
          kinds={REGISTRATION_KINDS}
          fields={fields}
          onChange={(next) => {
            setFields(next);
            setDirty(true);
          }}
        />
      )}

      {(dirty || save.isError) && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-5 py-3 shadow-lg backdrop-blur max-md:bottom-[calc(6.5rem+env(safe-area-inset-bottom))]">
          {save.isError ? (
            <ErrorText error={save.error} />
          ) : (
            <p className="text-sm text-muted-foreground">
              You have unsaved changes.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFields(initial);
                setDirty(false);
              }}
              disabled={save.isPending}
            >
              Discard
            </Button>
            <Button onClick={onSave} disabled={save.isPending}>
              {save.isPending && <Spinner className="size-4" />}
              Save form
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
};

function StatusBadge({ status }: { status: RegistrationStatus }) {
  if (status === 'APPROVED')
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-600/30 text-emerald-700 dark:text-emerald-400"
      >
        <CheckIcon aria-hidden /> Approved
      </Badge>
    );
  if (status === 'REJECTED')
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <XIcon aria-hidden /> Not approved
      </Badge>
    );
  return <Badge variant="secondary">Waiting</Badge>;
}

function Requests({
  versionId,
  settings,
}: {
  versionId: string;
  settings: RegistrationSettings;
}) {
  const [status, setStatus] = useState<RegistrationStatus | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<RegistrationRequest | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: 'reject' | 'bulk';
    ids: string[];
  } | null>(null);
  const requests = useRegistrationRequests(versionId, {
    page,
    status,
    search: search.trim(),
  });
  const users = useAllUsers();
  const setOne = useSetRegistrationStatus(versionId);
  const bulk = useBulkApproveRegistrations(versionId);

  const fields = useMemo(
    () =>
      schemaToFields(
        settings.jsonSchema ?? undefined,
        settings.uiSchema ?? undefined,
      ),
    [settings.jsonSchema, settings.uiSchema],
  );
  const byId = useMemo(
    () => new Map((users.data ?? []).map((u) => [u._id, u])),
    [users.data],
  );
  const who = (r: RegistrationRequest) => {
    const u = byId.get(r.userId);
    const name = u
      ? [u.firstName, u.lastName].filter(Boolean).join(' ')
      : String(r.detail.Name ?? r.detail.name ?? '');
    return {
      name: name || 'Student',
      email: u?.email ?? String(r.detail.Email ?? r.detail.email ?? ''),
    };
  };
  const pendingIds = (requests.data?.requests ?? [])
    .filter((r) => r.status === 'PENDING')
    .map((r) => r._id);
  const allSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));

  function approve(r: RegistrationRequest) {
    setOne.mutate(
      { id: r._id, status: 'APPROVED' },
      {
        onSuccess: () => {
          toast.success(`${who(r).name} is enrolled and has been emailed.`);
          setOpen(null);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
            setSelected(new Set());
          }}
        >
          <TabsList>
            <TabsTrigger value="PENDING">Waiting</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Not approved</TabsTrigger>
            <TabsTrigger value="ALL">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup className="min-w-48 flex-1 bg-card sm:max-w-64">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search requests"
            placeholder="Search…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </InputGroup>
        {selected.size > 0 && (
          <Button
            className="ml-auto"
            onClick={() => setConfirm({ kind: 'bulk', ids: [...selected] })}
          >
            <CheckIcon aria-hidden /> Approve {selected.size}
          </Button>
        )}
      </div>

      {requests.isPending && <Skeleton className="h-48 rounded-2xl" />}
      {requests.isError && <ErrorText error={requests.error} />}
      {requests.data && requests.data.requests.length === 0 && (
        <Empty className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardListIcon />
            </EmptyMedia>
            <EmptyTitle>
              {status === 'PENDING' ? 'No one is waiting' : 'Nothing here'}
            </EmptyTitle>
            <EmptyDescription>
              {status === 'PENDING'
                ? 'New registration requests appear here.'
                : `No ${STATUS_LABEL[status as RegistrationStatus]?.toLowerCase() ?? ''} requests${search ? ' match' : ''}.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {requests.data && requests.data.requests.length > 0 && (
        <>
          {/* Phones: cards. */}
          <div className="grid gap-3 md:hidden">
            {requests.data.requests.map((r) => (
              <Card key={r._id} className="gap-3 px-4 py-4">
                <button
                  type="button"
                  className="flex items-center gap-2.5 text-left"
                  onClick={() => setOpen(r)}
                  aria-label={`View ${who(r).name}’s answers`}
                >
                  <GeneratedAvatar seed={r.userId} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {who(r).name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {who(r).email}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                </button>
                <p className="text-xs text-muted-foreground">
                  Asked {formatDate(r.createdAt)}
                </p>
                {r.status === 'PENDING' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setConfirm({ kind: 'reject', ids: [r._id] })
                      }
                    >
                      Decline
                    </Button>
                    <Button
                      onClick={() => approve(r)}
                      disabled={setOne.isPending}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
          {/* Larger screens: table with selection. */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card max-md:hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10 pl-4">
                    {pendingIds.length > 0 && (
                      <Checkbox
                        aria-label="Select all waiting requests"
                        checked={allSelected}
                        onCheckedChange={(c) =>
                          setSelected(c ? new Set(pendingIds) : new Set())
                        }
                      />
                    )}
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Asked</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.data.requests.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="pl-4">
                      {r.status === 'PENDING' && (
                        <Checkbox
                          aria-label={`Select ${who(r).name}`}
                          checked={selected.has(r._id)}
                          onCheckedChange={(c) =>
                            setSelected((s) => {
                              const next = new Set(s);
                              if (c) next.add(r._id);
                              else next.delete(r._id);
                              return next;
                            })
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <GeneratedAvatar seed={r.userId} size={28} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{who(r).name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {who(r).email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOpen(r)}
                        >
                          Answers
                        </Button>
                        {r.status === 'PENDING' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setConfirm({ kind: 'reject', ids: [r._id] })
                              }
                            >
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approve(r)}
                              disabled={setOne.isPending}
                            >
                              Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {requests.data && requests.data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Page {page} of {requests.data.totalPages}
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
            disabled={page >= requests.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <GeneratedAvatar seed={open.userId} size={40} />
                  <div className="min-w-0">
                    <SheetTitle className="truncate">
                      {who(open).name}
                    </SheetTitle>
                    <SheetDescription className="truncate">
                      {who(open).email}
                    </SheetDescription>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={open.status} /> Asked{' '}
                  {formatDate(open.createdAt)}
                </div>
              </SheetHeader>
              <dl className="grid gap-3 px-4 pb-4">
                {/* Form questions first, in form order; then anything else the request carried (e.g. a cohort). */}
                {[
                  ...fields.map((f) => ({
                    key: fieldName(f),
                    label: f.label.trim() || fieldName(f),
                  })),
                  ...Object.keys(open.detail)
                    .filter((k) => !fields.some((f) => fieldName(f) === k))
                    .map((k) => ({ key: k, label: k })),
                ]
                  .filter((row) => row.key in open.detail)
                  .map((row) => {
                    const v = open.detail[row.key];
                    return (
                      <div
                        key={row.key}
                        className="rounded-xl bg-muted/50 px-3 py-2.5"
                      >
                        <dt className="text-xs text-muted-foreground">
                          {row.label}
                        </dt>
                        <dd className="text-sm">
                          {typeof v === 'boolean'
                            ? v
                              ? 'Yes'
                              : 'No'
                            : String(v)}
                        </dd>
                      </div>
                    );
                  })}
                {Object.keys(open.detail).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No answers: this course had no registration questions.
                  </p>
                )}
              </dl>
              {open.status === 'PENDING' && (
                <SheetFooter className="flex-row justify-end">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setConfirm({ kind: 'reject', ids: [open._id] })
                    }
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={() => approve(open)}
                    disabled={setOne.isPending}
                  >
                    {setOne.isPending && <Spinner className="size-4" />}
                    Approve
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === 'bulk'
            ? `Approve ${confirm.ids.length} requests?`
            : 'Decline this request?'
        }
        description={
          confirm?.kind === 'bulk'
            ? 'Each student is enrolled straight away and gets an email.'
            : 'The student gets an email saying their request wasn’t approved. They can register again.'
        }
        confirmLabel={
          confirm?.kind === 'bulk' ? `Approve ${confirm.ids.length}` : 'Decline'
        }
        destructive={confirm?.kind !== 'bulk'}
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.kind === 'bulk') {
            await bulk.mutateAsync(confirm.ids);
            setSelected(new Set());
            toast.success(
              `${confirm.ids.length} students enrolled and emailed.`,
            );
          } else {
            await setOne.mutateAsync({
              id: confirm.ids[0],
              status: 'REJECTED',
            });
            setOpen(null);
            toast.success('Request declined.');
          }
        }}
      />
    </div>
  );
}
