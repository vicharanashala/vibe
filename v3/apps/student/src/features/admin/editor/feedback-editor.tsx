import { useNavigate } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CircleDotIcon,
  CopyIcon,
  DownloadIcon,
  HashIcon,
  LinkIcon,
  ListIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  TextIcon,
  ToggleLeftIcon,
  TrashIcon,
  TypeIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GeneratedAvatar } from '@/components/generated-art';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import {
  blankField,
  fieldKey,
  fieldsToSchema,
  formProblem,
  KIND_LABELS,
  schemaToFields,
  type FieldKind,
  type FormField,
  type FormValues,
} from '@/features/feedback/form-schema';

import { ErrorText, formatDate } from '../studio-ui';
import { EditorFrame, TitleFields, type SaveState } from './editor-frame';
import {
  downloadFeedbackCsv,
  useFeedbackResponses,
  useFeedbackSummary,
  useSaveLesson,
  type FeedbackResponse,
  type LessonItem,
  type LessonLocation,
} from './lesson-api';

const KIND_ICONS: Record<FieldKind, LucideIcon> = {
  rating: StarIcon,
  text: TypeIcon,
  textarea: TextIcon,
  radio: CircleDotIcon,
  checkboxes: CheckSquareIcon,
  select: ListIcon,
  checkbox: ToggleLeftIcon,
  number: HashIcon,
  email: MailIcon,
  url: LinkIcon,
  tel: PhoneIcon,
  date: CalendarIcon,
};
const KIND_ORDER: FieldKind[] = [
  'rating',
  'text',
  'textarea',
  'radio',
  'checkboxes',
  'select',
  'checkbox',
  'number',
  'email',
  'url',
  'tel',
  'date',
];
const HAS_OPTIONS: FieldKind[] = ['radio', 'select', 'checkboxes'];
const HAS_PLACEHOLDER: FieldKind[] = [
  'text',
  'textarea',
  'number',
  'email',
  'url',
  'tel',
  'select',
];

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
  // Like Google Forms: one question open for editing, the rest shown as compact previews.
  const [activeKey, setActiveKey] = useState<string | null>(() =>
    item ? null : (fields[0]?.key ?? null),
  );
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

  function update(key: string, patch: Partial<FormField>) {
    setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
    setDirty(true);
  }
  function move(i: number, d: -1 | 1) {
    setFields((fs) => {
      const next = [...fs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
    setDirty(true);
  }

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
          <TabsList>
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
            <>
              <div className="grid gap-4">
                {fields.map((f, i) => (
                  <FieldCard
                    key={f.key}
                    active={activeKey === f.key}
                    onActivate={() => setActiveKey(f.key)}
                    field={f}
                    index={i}
                    count={fields.length}
                    onChange={(patch) => update(f.key, patch)}
                    onMove={(d) => move(i, d)}
                    onDuplicate={() => {
                      setFields((fs) => [
                        ...fs.slice(0, i + 1),
                        { ...f, key: fieldKey(), label: `${f.label} (copy)` },
                        ...fs.slice(i + 1),
                      ]);
                      setDirty(true);
                    }}
                    onDelete={() => {
                      setFields((fs) => fs.filter((x) => x.key !== f.key));
                      setDirty(true);
                    }}
                  />
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="lg"
                      className="mt-4 w-full border-dashed text-muted-foreground"
                    />
                  }
                >
                  <PlusIcon aria-hidden /> Add question
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  {KIND_ORDER.map((k) => {
                    const Icon = KIND_ICONS[k];
                    return (
                      <DropdownMenuItem
                        key={k}
                        onClick={() => {
                          const added = blankField(k);
                          setFields((fs) => [...fs, added]);
                          setActiveKey(added.key);
                          setDirty(true);
                          setTimeout(
                            () =>
                              document
                                .getElementById(`${added.key}-label`)
                                ?.focus(),
                            50,
                          );
                        }}
                      >
                        <Icon /> {KIND_LABELS[k]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </TabsContent>
        {item && (
          <TabsContent value="responses">
            <Responses
              courseId={loc.courseId}
              feedbackId={item._id}
              fields={fields}
              formName={name}
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

function FieldCard({
  field: f,
  index,
  count,
  active,
  onActivate,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  active: boolean;
  onActivate: () => void;
  field: FormField;
  index: number;
  count: number;
  onChange: (patch: Partial<FormField>) => void;
  onMove: (d: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const Icon = KIND_ICONS[f.kind];
  const n = index + 1;

  if (!active) {
    return (
      <Card
        aria-label={`Question ${n}`}
        onClick={onActivate}
        className="cursor-pointer gap-3 px-5 py-4 transition-shadow hover:ring-primary/40 sm:px-6"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {n}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="size-3.5" aria-hidden /> {KIND_LABELS[f.kind]}
          </span>
          {f.required && <Badge variant="outline">Required</Badge>}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
          >
            <PencilIcon aria-hidden /> Edit
          </Button>
        </div>
        <div className="pointer-events-none" aria-hidden>
          {f.label.trim() ? (
            <FeedbackFormFields
              fields={[{ ...f, required: false }]}
              values={{}}
              onChange={() => undefined}
              disabled
              idPrefix={`mini-${f.key}`}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Untitled question
            </p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      aria-label={`Question ${n}`}
      className="gap-0 py-0 ring-2 ring-primary/40"
    >
      <CardHeader className="flex flex-wrap items-center gap-2 border-b py-3 [.border-b]:pb-3">
        <Badge className="tabular-nums">{n}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="gap-1.5" />}
          >
            <Icon aria-hidden /> {KIND_LABELS[f.kind]}{' '}
            <ChevronDownIcon className="opacity-60" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {KIND_ORDER.map((k) => {
              const KIcon = KIND_ICONS[k];
              return (
                <DropdownMenuItem
                  key={k}
                  onClick={() => {
                    const base = blankField(k);
                    onChange({
                      kind: k,
                      options: HAS_OPTIONS.includes(k)
                        ? f.options.length
                          ? f.options
                          : base.options
                        : [],
                      min: base.min,
                      max: base.max,
                    });
                  }}
                >
                  <KIcon /> {KIND_LABELS[k]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <CardAction className="ml-auto flex items-center gap-3 self-center">
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel
              htmlFor={`${f.key}-req`}
              className="font-normal text-muted-foreground"
            >
              Required
            </FieldLabel>
            <Switch
              id={`${f.key}-req`}
              checked={f.required}
              onCheckedChange={(c) => onChange({ required: c === true })}
            />
          </Field>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Question ${n}: actions`}
                />
              }
            >
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={index === 0}
                onClick={() => onMove(-1)}
              >
                <ArrowUpIcon /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === count - 1}
                onClick={() => onMove(1)}
              >
                <ArrowDownIcon /> Move down
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <CopyIcon /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <TrashIcon /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="py-5">
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor={`${f.key}-label`}>Question</FieldLabel>
            <Input
              id={`${f.key}-label`}
              value={f.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="What do you want to ask?"
              className="text-base"
            />
          </Field>
          <Field>
            <FieldLabel
              htmlFor={`${f.key}-help`}
              className="font-normal text-muted-foreground"
            >
              Help text (optional)
            </FieldLabel>
            <Input
              id={`${f.key}-help`}
              value={f.help}
              onChange={(e) => onChange({ help: e.target.value })}
              placeholder="Shown under the question"
            />
          </Field>

          {HAS_PLACEHOLDER.includes(f.kind) && (
            <Field>
              <FieldLabel
                htmlFor={`${f.key}-ph`}
                className="font-normal text-muted-foreground"
              >
                Placeholder (optional)
              </FieldLabel>
              <Input
                id={`${f.key}-ph`}
                value={f.placeholder}
                onChange={(e) => onChange({ placeholder: e.target.value })}
                placeholder="Example text inside the empty field"
              />
            </Field>
          )}

          {HAS_OPTIONS.includes(f.kind) && (
            <FieldSet>
              <FieldLegend variant="label">Options</FieldLegend>
              <div className="grid gap-2">
                {f.options.map((opt, oi) => (
                  <InputGroup key={oi}>
                    <InputGroupAddon>
                      <InputGroupText className="w-4 justify-center tabular-nums">
                        {oi + 1}
                      </InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      value={opt}
                      onChange={(e) =>
                        onChange({
                          options: f.options.map((o, j) =>
                            j === oi ? e.target.value : o,
                          ),
                        })
                      }
                      placeholder={`Option ${oi + 1}`}
                      aria-label={`Question ${n}, option ${oi + 1}`}
                    />
                    {f.options.length > 2 && (
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          size="icon-xs"
                          aria-label={`Remove option ${oi + 1}`}
                          onClick={() =>
                            onChange({
                              options: f.options.filter((_, j) => j !== oi),
                            })
                          }
                        >
                          <XIcon />
                        </InputGroupButton>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() =>
                  onChange({
                    options: [...f.options, `Option ${f.options.length + 1}`],
                  })
                }
              >
                <PlusIcon aria-hidden /> Add option
              </Button>
            </FieldSet>
          )}

          {f.kind === 'rating' && (
            <Field className="w-48">
              <FieldLabel htmlFor={`${f.key}-scale`}>Scale</FieldLabel>
              <NativeSelect
                id={`${f.key}-scale`}
                value={String(f.max ?? 5)}
                onChange={(e) =>
                  onChange({ min: 1, max: Number(e.target.value) })
                }
              >
                {[3, 5, 7, 10].map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    1 to {m}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          {f.kind === 'number' && (
            <div className="grid grid-cols-2 gap-3 sm:w-80">
              <Field>
                <FieldLabel htmlFor={`${f.key}-min`}>Minimum</FieldLabel>
                <Input
                  id={`${f.key}-min`}
                  type="number"
                  value={f.min ?? ''}
                  onChange={(e) =>
                    onChange({
                      min:
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  placeholder="None"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${f.key}-max`}>Maximum</FieldLabel>
                <Input
                  id={`${f.key}-max`}
                  type="number"
                  value={f.max ?? ''}
                  onChange={(e) =>
                    onChange({
                      max:
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  placeholder="None"
                />
              </Field>
            </div>
          )}
          {f.kind === 'checkbox' && (
            <FieldDescription>
              Students see one tick box next to the question, e.g. “I watched
              the whole video”.
            </FieldDescription>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function Responses({
  courseId,
  feedbackId,
  fields,
  formName,
}: {
  courseId: string;
  feedbackId: string;
  fields: FormField[];
  formName: string;
}) {
  const [view, setView] = useState<'summary' | 'individual'>('summary');
  const [exporting, setExporting] = useState(false);
  const summary = useFeedbackSummary(courseId, feedbackId);

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFeedbackCsv(
        courseId,
        feedbackId,
        `${formName.trim() || 'feedback'} responses.csv`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  if (summary.isPending) return <Skeleton className="h-48 rounded-2xl" />;
  if (summary.isError) return <ErrorText error={summary.error} />;
  if (summary.data.total === 0) {
    return (
      <Empty className="rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TextIcon />
          </EmptyMedia>
          <EmptyTitle>No responses yet</EmptyTitle>
          <EmptyDescription>
            Responses appear here as students send the form in certified mode.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as 'summary' | 'individual')}
        >
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="individual">
              Individual{' '}
              <span className="text-muted-foreground tabular-nums">
                {summary.data.total}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          onClick={() => void exportCsv()}
          disabled={exporting}
        >
          <DownloadIcon aria-hidden /> Export CSV
        </Button>
      </div>
      {view === 'summary' ? (
        <ResponseSummary
          fields={fields}
          rows={summary.data.rows}
          total={summary.data.total}
        />
      ) : (
        <IndividualResponses
          courseId={courseId}
          feedbackId={feedbackId}
          fields={fields}
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

/** Google Forms-style summary: averages and distributions for ratings, counts for choices, recent written answers. */
function ResponseSummary({
  fields,
  rows,
  total,
}: {
  fields: FormField[];
  rows: { details: Record<string, unknown> }[];
  total: number;
}) {
  return (
    <div className="grid gap-4">
      {fields.map((f, i) => {
        const name = f.label.trim();
        const answers = rows
          .map((r) => r.details[name])
          .filter(
            (v) =>
              v !== undefined &&
              v !== null &&
              v !== '' &&
              !(Array.isArray(v) && v.length === 0),
          );
        const choices =
          f.kind === 'rating'
            ? Array.from({ length: f.max ?? 5 }, (_, n) => String(n + 1))
            : f.kind === 'checkbox'
              ? ['Yes', 'No']
              : ['radio', 'select', 'checkboxes'].includes(f.kind)
                ? f.options
                : null;
        const countOf = (c: string) =>
          answers.filter((v) =>
            Array.isArray(v)
              ? v.map(String).includes(c)
              : f.kind === 'checkbox'
                ? (v === true ? 'Yes' : 'No') === c
                : String(v) === c,
          ).length;
        const ratings =
          f.kind === 'rating'
            ? answers.map(Number).filter(Number.isFinite)
            : [];
        const avg = ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null;

        return (
          <Card key={f.key} className="gap-4 px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs text-muted-foreground">Question {i + 1}</p>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">
                {answers.length} of {total} answered
              </p>
            </div>
            {f.kind === 'rating' && avg !== null && (
              <p className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums">
                  {avg.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  average out of {f.max ?? 5}
                </span>
              </p>
            )}
            {choices ? (
              <ul className="grid gap-2.5">
                {choices.map((c) => {
                  const count = countOf(c);
                  const pct = answers.length
                    ? Math.round((count / answers.length) * 100)
                    : 0;
                  return (
                    <li
                      key={c}
                      className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm"
                    >
                      <span className="truncate">{c}</span>
                      <Progress
                        value={pct}
                        aria-label={`${c}: ${pct}%`}
                        className="h-2"
                      />
                      <span className="w-16 text-right text-muted-foreground tabular-nums">
                        {count} · {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="grid gap-2">
                {answers.slice(0, 5).map((a, ai) => (
                  <li
                    key={ai}
                    className="rounded-lg bg-muted/60 px-3 py-2 text-sm"
                  >
                    {showValue(a)}
                  </li>
                ))}
                {answers.length > 5 && (
                  <li className="text-xs text-muted-foreground">
                    and {answers.length - 5} more in Individual
                  </li>
                )}
                {answers.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No answers yet.
                  </li>
                )}
              </ul>
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
}: {
  courseId: string;
  feedbackId: string;
  fields: FormField[];
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const responses = useFeedbackResponses(
    courseId,
    feedbackId,
    page,
    search.trim(),
  );
  const columns = fields.map((f) => f.label.trim()).filter(Boolean);
  const person = (r: FeedbackResponse) =>
    [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || 'Student';

  return (
    <div className="grid gap-4">
      <InputGroup className="bg-card sm:w-72">
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search by first name"
          placeholder="Search by first name…"
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
              <Card key={r._id} className="gap-3 px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <GeneratedAvatar seed={r.user._id} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{person(r)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.user.email}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </span>
                </div>
                <dl className="grid gap-2 border-t border-border pt-3">
                  {columns.map((c) => (
                    <div key={c}>
                      <dt className="text-xs text-muted-foreground">{c}</dt>
                      <dd className="text-sm">{showValue(r.details[c])}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
          {/* Larger screens: a table. */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-card max-md:hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">Student</TableHead>
                  {columns.map((c) => (
                    <TableHead
                      key={c}
                      className="max-w-56 min-w-32 whitespace-normal"
                    >
                      {c}
                    </TableHead>
                  ))}
                  <TableHead className="pr-4 text-right">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.data.responses.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <GeneratedAvatar seed={r.user._id} size={28} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{person(r)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell
                        key={c}
                        className="max-w-56 align-top whitespace-normal"
                      >
                        {showValue(r.details[c])}
                      </TableCell>
                    ))}
                    <TableCell className="pr-4 text-right whitespace-nowrap text-muted-foreground">
                      {formatDate(r.createdAt)}
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
    </div>
  );
}
