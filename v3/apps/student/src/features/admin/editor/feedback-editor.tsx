import { useNavigate } from '@tanstack/react-router';
import { AlertTriangleIcon, SearchIcon, TextIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GeneratedAvatar } from '@/components/generated-art';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSectionItems } from '@/features/courses/queries';
import { FeedbackFormFields } from '@/features/feedback/feedback-form';
import { FormBuilder } from '@/features/feedback/form-builder';
import {
  answerable,
  blankField,
  fieldName,
  fieldsToSchema,
  OTHER,
  otherName,
  formProblem,
  schemaToFields,
  type FormField,
  type FormValues,
} from '@/features/feedback/form-schema';

import { ErrorText, formatDate } from '../studio-ui';
import { EditorFrame, TitleFields, type SaveState } from './editor-frame';
import { CohortSelect, FeedbackDownloadMenu } from './feedback-downloads';
import {
  downloadFeedbackForm,
  useFeedbackResponses,
  useFeedbackSummary,
  useSaveLesson,
  useStudentFeedbackHistory,
  type FeedbackResponse,
  type LessonItem,
  type LessonLocation,
  type QuestionSummary,
} from './lesson-api';

/** A sensible starting form: one rating and one open question. */
function starterFields(): FormField[] {
  return [
    { ...blankField('rating'), label: 'How useful was the previous lesson?' },
    {
      ...blankField('textarea'),
      label: 'What could make it better?',
      required: false,
    },
  ];
}

/**
 * Feedback form builder (Tally/Substack-like cards) with a Preview that uses the
 * same renderer as the student lesson, and a Responses tab once it exists.
 */
export function FeedbackEditor({
  loc,
  item,
}: {
  loc: LessonLocation;
  item?: LessonItem;
}) {
  const save = useSaveLesson(loc, item?._id);
  const navigate = useNavigate();
  const [name, setName] = useState(item?.name ?? 'Feedback');
  const [description, setDescription] = useState(
    item?.description ?? 'Tell us how the last lesson went.',
  );
  const [fields, setFields] = useState<FormField[]>(() =>
    item
      ? schemaToFields(item.details?.jsonSchema, item.details?.uiSchema)
      : starterFields(),
  );
  const [dirty, setDirty] = useState(!item);
  const [preview, setPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<FormValues>({});
  const [tab, setTab] = useState<'questions' | 'responses'>('questions');
  const placement = usePlacementProblem(loc, item?._id);

  const state: SaveState = save.isPending
    ? 'saving'
    : save.isError
      ? 'error'
      : dirty
        ? item
          ? 'dirty'
          : 'new'
        : save.isSuccess
          ? 'saved'
          : item
            ? 'clean'
            : 'new';

  function onSave() {
    const problem = !name.trim()
      ? 'Add a title'
      : !description.trim()
        ? 'Add a subtitle'
        : formProblem(fields);
    if (problem) return void toast.error(problem);
    save.mutate(
      {
        type: 'FEEDBACK',
        name: name.trim(),
        description: description.trim(),
        details: fieldsToSchema(fields),
      },
      {
        onSuccess: (id) => {
          setDirty(false);
          toast.success(
            item ? 'Feedback form saved.' : 'Feedback form published.',
          );
          if (!item)
            void navigate({
              to: '/admin/courses/$courseId/$versionId/lesson',
              params: loc,
              search: {
                module: loc.moduleId,
                section: loc.sectionId,
                item: id,
              },
              replace: true,
              ignoreBlocker: true,
            });
        },
      },
    );
  }

  return (
    <EditorFrame
      loc={loc}
      itemId={item?._id}
      dirty={dirty}
      kind="Feedback"
      state={state}
      onSave={onSave}
      saveLabel={item ? 'Save' : 'Publish'}
      preview={preview}
      onPreviewChange={tab === 'questions' ? setPreview : undefined}
      wide
    >
      {save.isError && (
        <ErrorText
          error={save.error}
          className="mb-6 rounded-lg bg-destructive/10 px-3 py-2"
        />
      )}
      {placement && (
        <Alert className="mb-6">
          <AlertTriangleIcon />
          <AlertTitle>Students can’t submit this form where it is</AlertTitle>
          <AlertDescription>{placement}</AlertDescription>
        </Alert>
      )}

      <TitleFields
        title={name}
        onTitle={(v) => {
          setName(v);
          setDirty(true);
        }}
        subtitle={description}
        onSubtitle={(v) => {
          setDescription(v);
          setDirty(true);
        }}
        titlePlaceholder="Form title"
        subtitlePlaceholder="A line about what you’re asking"
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'questions' | 'responses')}
        className="mt-8 flex-col gap-6"
      >
        {item && (
          <TabsList className="h-11 sm:h-9">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="responses">Responses</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="questions">
          {preview ? (
            <FeedbackFormFields
              cards
              fields={fields}
              values={previewValues}
              onChange={(n, v) => setPreviewValues((p) => ({ ...p, [n]: v }))}
              idPrefix="preview"
            />
          ) : (
            <FormBuilder
              allowOther
              fields={fields}
              onChange={(next) => {
                setFields(next);
                setDirty(true);
              }}
              initialActiveKey={item ? null : (fields[0]?.key ?? null)}
            />
          )}
        </TabsContent>
        {item && (
          <TabsContent value="responses">
            <Responses
              courseId={loc.courseId}
              versionId={loc.versionId}
              feedbackId={item._id}
              fields={fields}
            />
          </TabsContent>
        )}
      </Tabs>
    </EditorFrame>
  );
}

/** The backend files a submission under the lesson just before the form, so it can't be first or follow another feedback form. */
function usePlacementProblem(
  loc: LessonLocation,
  itemId?: string,
): string | null {
  const items = useSectionItems(loc.versionId, loc.moduleId, loc.sectionId);
  return useMemo(() => {
    if (!items.data) return null;
    const ordered = [...items.data].sort((a, b) =>
      a.order.localeCompare(b.order),
    );
    const index = itemId
      ? ordered.findIndex((x) => x._id === itemId)
      : ordered.length;
    const prev = index > 0 ? ordered[index - 1] : undefined;
    if (!prev)
      return 'A feedback form collects responses about the lesson before it, so it needs a video, reading or quiz ahead of it in the same section.';
    if (prev.type === 'FEEDBACK')
      return 'It comes straight after another feedback form. Put a video, reading or quiz between them.';
    return null;
  }, [items.data, itemId]);
}

function Responses({
  courseId,
  versionId,
  feedbackId,
  fields,
}: {
  courseId: string;
  versionId: string;
  feedbackId: string;
  fields: FormField[];
}) {
  const [view, setView] = useState<'summary' | 'individual'>('summary');
  const [cohortId, setCohortId] = useState('');
  const summary = useFeedbackSummary(courseId, feedbackId, cohortId || undefined);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <CohortSelect versionId={versionId} value={cohortId} onChange={setCohortId} />
      <FeedbackDownloadMenu
        cohortId={cohortId || undefined}
        choices={[
          { label: 'Excel (.xlsx)', description: 'One row per response, a column per question.', format: 'xlsx' },
          { label: 'CSV', description: 'The same rows as plain text.', format: 'csv' },
        ]}
        download={(options) => downloadFeedbackForm(courseId, feedbackId, options)}
      />
    </div>
  );

  if (summary.isPending) return <Skeleton className="h-48 rounded-2xl" />;
  if (summary.isError) return <ErrorText error={summary.error} />;
  if (summary.data.total === 0) {
    return (
      <div className="grid gap-4">
        <div className="flex justify-end">{toolbar}</div>
        <Empty className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TextIcon />
            </EmptyMedia>
            <EmptyTitle>No responses yet</EmptyTitle>
            <EmptyDescription>
              Responses appear here as students send the form in strict mode.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as 'summary' | 'individual')}
        >
          <TabsList className="h-11 sm:h-9">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="individual">
              Individual{' '}
              <span className="text-muted-foreground tabular-nums">
                {summary.data.total}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {toolbar}
      </div>
      {view === 'summary' ? (
        <ResponseSummary questions={summary.data.questions} total={summary.data.total} />
      ) : (
        <IndividualResponses
          courseId={courseId}
          feedbackId={feedbackId}
          fields={fields}
          cohortId={cohortId || undefined}
        />
      )}
    </div>
  );
}

const showValue = (v: unknown) =>
  Array.isArray(v)
    ? v.join(', ')
    : typeof v === 'boolean'
      ? v
        ? 'Yes'
        : 'No'
      : v === undefined || v === null || v === ''
        ? '—'
        : String(v);

/** An answer as teachers read it, with any "Other (please specify)" text. */
function answerText(f: FormField, details: Record<string, unknown>) {
  const value = details[fieldName(f)];
  const other = f.other ? details[otherName(f)] : undefined;
  const text = showValue(value);
  return typeof other === 'string' && other.trim()
    ? text.replace(OTHER, `${OTHER}: ${other.trim()}`)
    : text;
}

/**
 * Google Forms-style summary from the server's counts over every current
 * answer: averages for ratings, scales and numbers, distributions for
 * choices, the latest written answers.
 */
function ResponseSummary({
  questions,
  total,
}: {
  questions: QuestionSummary[];
  total: number;
}) {
  return (
    <div className="grid gap-4">
      {questions.map((q, i) => {
        const counts = q.counts ? Object.entries(q.counts) : null;
        const counted = counts ? counts.reduce((sum, [, n]) => sum + n, 0) : 0;
        return (
          <Card key={q.key} className="gap-4 px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs text-muted-foreground">Question {i + 1}</p>
              <p className="font-medium">{q.title}</p>
              <p className="text-xs text-muted-foreground">
                {q.answered} of {total} answered
              </p>
            </div>
            {q.average !== undefined && (
              <p className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums">
                  {q.average.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">average</span>
              </p>
            )}
            {counts && (
              <ul className="grid gap-2.5">
                {counts.map(([choice, count]) => {
                  const pct = counted ? Math.round((count / counted) * 100) : 0;
                  return (
                    // Phones: choice and count on one line, a full-width bar below.
                    // Wider screens: choice, bar and count in one row.
                    <li
                      key={choice}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,8rem)_1fr_auto]"
                    >
                      <span className="order-1 break-words sm:truncate">{choice}</span>
                      <span className="order-2 text-right text-muted-foreground tabular-nums sm:order-3 sm:w-20">
                        {count} · {pct}%
                      </span>
                      <Progress
                        value={pct}
                        aria-label={`${choice}: ${pct}%`}
                        className="order-3 col-span-2 h-2 sm:order-2 sm:col-span-1"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            {q.latestTexts && (
              <div className="grid gap-2">
                {counts && (
                  <p className="text-xs text-muted-foreground">“Other” answers</p>
                )}
                <ul className="grid gap-2">
                  {q.latestTexts.slice(0, 5).map((t, ti) => (
                    <li key={ti} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                      {t}
                    </li>
                  ))}
                  {q.latestTexts.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      and more in Individual
                    </li>
                  )}
                </ul>
              </div>
            )}
            {!counts && !q.latestTexts && q.average === undefined && (
              <p className="text-sm text-muted-foreground">No answers yet.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function IndividualResponses({
  courseId,
  feedbackId,
  fields,
  cohortId,
}: {
  courseId: string;
  feedbackId: string;
  fields: FormField[];
  cohortId?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<FeedbackResponse | null>(null);
  const responses = useFeedbackResponses(
    courseId,
    feedbackId,
    page,
    search.trim(),
    cohortId,
  );
  const questions = answerable(fields).filter((f) => fieldName(f));
  const person = (r: FeedbackResponse) =>
    [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || 'Student';

  return (
    <div className="grid gap-4">
      <InputGroup className="h-10 bg-card sm:h-9 sm:w-80">
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search by name or email"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </InputGroup>

      {responses.isPending && <Skeleton className="h-48 rounded-2xl" />}
      {responses.isError && <ErrorText error={responses.error} />}
      {responses.data && responses.data.responses.length === 0 && (
        <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          No responses match.
        </p>
      )}

      {responses.data && responses.data.responses.length > 0 && (
        <>
          {/* Phones: one card per response. */}
          <div className="grid gap-3 md:hidden">
            {responses.data.responses.map((r) => (
              <Card
                key={r._id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${person(r)}’s answers`}
                onClick={() => setOpen(r)}
                onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}
                className="cursor-pointer gap-3 px-4 py-4"
              >
                <div className="flex items-center gap-2.5">
                  <GeneratedAvatar seed={r.user._id} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{person(r)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.user.email}
                    </p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                    <ModeBadge mode={r.mode} />
                  </span>
                </div>
                {questions[0] && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    <span className="text-foreground">{questions[0].label.trim() || fieldName(questions[0])}:</span>{' '}
                    {answerText(questions[0], r.details) || '—'}
                  </p>
                )}
              </Card>
            ))}
          </div>
          {/* Larger screens: a table; a row opens that student's answers. */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-card max-md:hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {/* Sticky, so the student stays in view while wide answers scroll sideways. */}
                  <TableHead className="sticky left-0 z-10 bg-muted pl-4">Student</TableHead>
                  {questions.map((f) => (
                    <TableHead
                      key={f.key}
                      className="max-w-56 min-w-32 whitespace-normal"
                    >
                      {f.label.trim() || fieldName(f)}
                    </TableHead>
                  ))}
                  <TableHead className="pr-4 text-right">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.data.responses.map((r) => (
                  <TableRow
                    key={r._id}
                    className="cursor-pointer"
                    onClick={() => setOpen(r)}
                  >
                    <TableCell className="sticky left-0 z-10 bg-card pl-4 shadow-[1px_0_0_var(--border)]">
                      <button
                        type="button"
                        className="flex items-center gap-2.5 text-left"
                        aria-label={`Open ${person(r)}’s answers`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(r);
                        }}
                      >
                        <GeneratedAvatar seed={r.user._id} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{person(r)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.user.email}
                          </span>
                        </span>
                      </button>
                    </TableCell>
                    {questions.map((f) => (
                      <TableCell
                        key={f.key}
                        className="max-w-56 align-top whitespace-normal"
                      >
                        {answerText(f, r.details)}
                      </TableCell>
                    ))}
                    <TableCell className="pr-4 text-right whitespace-nowrap text-muted-foreground">
                      <span className="flex flex-col items-end gap-1">
                        {formatDate(r.createdAt)}
                        <ModeBadge mode={r.mode} />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {responses.data && responses.data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Page {page} of {responses.data.totalPages}
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
            disabled={page >= responses.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <ResponseSheet
        courseId={courseId}
        feedbackId={feedbackId}
        fields={fields}
        response={open}
        onClose={() => setOpen(null)}
        person={open ? person(open) : ''}
      />
    </div>
  );
}

/** Which mode an answer was sent in: study mode is how phones answer. */
function ModeBadge({ mode }: { mode: FeedbackResponse['mode'] }) {
  return (
    <Badge
      variant="secondary"
      className={mode === 'study' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : undefined}
    >
      {mode === 'study' ? 'Study' : 'Strict'}
    </Badge>
  );
}

/** One student's answers to every question, the lesson it was about, and earlier versions. */
function ResponseSheet({
  courseId,
  feedbackId,
  fields,
  response,
  person,
  onClose,
}: {
  courseId: string;
  feedbackId: string;
  fields: FormField[];
  response: FeedbackResponse | null;
  person: string;
  onClose: () => void;
}) {
  const history = useStudentFeedbackHistory(courseId, feedbackId, response?.user._id);
  const earlier = (history.data ?? []).filter((h) => !h.isCurrent);
  const questions = answerable(fields).filter((f) => fieldName(f));
  return (
    <Sheet open={!!response} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:w-3/4 data-[side=right]:sm:max-w-lg">
        {response && (
          <>
            <SheetHeader>
              <SheetTitle>{person}</SheetTitle>
              <SheetDescription>
                {response.user.email} · sent {formatDate(response.createdAt)}
                {response.previousItem?.name ? ` · about “${response.previousItem.name}”` : ''}
              </SheetDescription>
              <div>
                <ModeBadge mode={response.mode} />
              </div>
            </SheetHeader>
            <div className="grid gap-6 px-4 pb-8">
              <dl className="grid gap-3" aria-label="Answers">
                {questions.map((f) => (
                  <div key={f.key} className="rounded-xl border border-border px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{f.label.trim() || fieldName(f)}</dt>
                    <dd className="mt-0.5 text-sm">{answerText(f, response.details)}</dd>
                  </div>
                ))}
              </dl>
              <section aria-label="Earlier versions" className="grid gap-2">
                <h3 className="text-sm font-medium">Earlier versions</h3>
                {history.isPending ? (
                  <Skeleton className="h-16 rounded-xl" />
                ) : earlier.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    None. This is the only answer they sent.
                  </p>
                ) : (
                  earlier.map((h) => (
                    <details key={h._id} className="rounded-xl border border-border px-4 py-3 text-sm">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                        Replaced answer from {formatDate(h.createdAt)}
                        <ModeBadge mode={h.mode} />
                      </summary>
                      <dl className="mt-2 grid gap-2">
                        {questions.map((f) => (
                          <div key={f.key}>
                            <dt className="text-xs text-muted-foreground">{f.label.trim() || fieldName(f)}</dt>
                            <dd>{answerText(f, h.details)}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ))
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
