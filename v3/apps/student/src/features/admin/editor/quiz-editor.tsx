import { useNavigate } from '@tanstack/react-router';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleDotIcon,
  CopyIcon,
  HashIcon,
  LightbulbIcon,
  ListChecksIcon,
  ListOrderedIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TextIcon,
  TrashIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { toEditorHtml, toStoredText } from '@/components/rich-content';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { DesktopHint, ErrorText } from '../studio-ui';
import {
  EditorFrame,
  EditorFrameSkeleton,
  TitleFields,
  type SaveState,
} from './editor-frame';
import { QuizResults } from './quiz-results';
import {
  blankOption,
  blankQuestion,
  DEFAULT_QUIZ_DETAILS,
  newKey,
  syncQuizQuestions,
  useQuizQuestions,
  useSaveLesson,
  type DraftOption,
  type DraftQuestion,
  type LessonItem,
  type LessonLocation,
  type QuestionType,
  type QuizDetails,
} from './lesson-api';

const TYPES: Record<
  QuestionType,
  { label: string; short: string; icon: LucideIcon }
> = {
  SELECT_ONE_IN_LOT: {
    label: 'Single choice',
    short: 'One correct answer',
    icon: CircleDotIcon,
  },
  SELECT_MANY_IN_LOT: {
    label: 'Multiple choice',
    short: 'One or more correct answers',
    icon: ListChecksIcon,
  },
  ORDER_THE_LOTS: {
    label: 'Put in order',
    short: 'Arrange items in the right order',
    icon: ListOrderedIcon,
  },
  NUMERIC_ANSWER_TYPE: {
    label: 'Number',
    short: 'A numeric answer within a range',
    icon: HashIcon,
  },
  DESCRIPTIVE: {
    label: 'Written answer',
    short: 'Free text, graded by you',
    icon: TextIcon,
  },
};

function problemWith(q: DraftQuestion): string | null {
  if (!q.text.trim()) return 'is missing its question text';
  if (
    q.type === 'SELECT_ONE_IN_LOT' ||
    q.type === 'SELECT_MANY_IN_LOT' ||
    q.type === 'ORDER_THE_LOTS'
  ) {
    if (q.options.length < 2) return 'needs at least two options';
    if (q.options.some((o) => !o.text.trim())) return 'has an empty option';
  }
  if (
    q.type === 'SELECT_ONE_IN_LOT' &&
    q.options.filter((o) => o.correct).length !== 1
  )
    return 'needs exactly one correct answer';
  if (q.type === 'SELECT_MANY_IN_LOT' && !q.options.some((o) => o.correct))
    return 'needs at least one correct answer';
  if (q.type === 'NUMERIC_ANSWER_TYPE' && q.upperLimit < q.lowerLimit)
    return 'has a range that ends below its start';
  return null;
}

/** Quiz builder: title, settings, and a list of question cards. Questions live in the quiz's own question bank. */
export function QuizEditor({
  loc,
  item,
}: {
  loc: LessonLocation;
  item?: LessonItem;
}) {
  const existing = useQuizQuestions(item?._id);
  if (item && existing.isPending)
    return <EditorFrameSkeleton loc={loc} kind="Quiz" />;
  return (
    <QuizEditorBody
      loc={loc}
      item={item}
      bank={existing.data?.bank ?? null}
      initial={existing.data?.questions ?? []}
      loadError={existing.error}
    />
  );
}

function QuizEditorBody({
  loc,
  item,
  bank,
  initial,
  loadError,
}: {
  loc: LessonLocation;
  item?: LessonItem;
  bank: { bankId: string; count: number } | null;
  initial: DraftQuestion[];
  loadError: unknown;
}) {
  const navigate = useNavigate();
  const saveItem = useSaveLesson(loc, item?._id);
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [details, setDetails] = useState<QuizDetails>(() => ({
    ...DEFAULT_QUIZ_DETAILS,
    releaseTime: new Date().toISOString(),
    ...(item?.details ?? {}),
  }));
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    initial.length ? initial : item ? [] : [blankQuestion()],
  );
  const [serverQuestions, setServerQuestions] =
    useState<DraftQuestion[]>(initial);
  const [serverBank, setServerBank] = useState(bank);
  const [perAttempt, setPerAttempt] = useState<number | null>(
    bank && initial.length && bank.count < initial.length ? bank.count : null,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<'questions' | 'results'>('questions');
  const [savedOnce, setSavedOnce] = useState(false);

  const totalPoints = questions.reduce(
    (s, q) => s + (Number(q.points) || 0),
    0,
  );
  const state: SaveState = saving
    ? 'saving'
    : error
      ? 'error'
      : dirty
        ? item
          ? 'dirty'
          : 'new'
        : savedOnce
          ? 'saved'
          : item
            ? 'clean'
            : 'new';

  function update(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((qs) =>
      qs.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );
    setDirty(true);
  }
  function setDetail<K extends keyof QuizDetails>(k: K, v: QuizDetails[K]) {
    setDetails((d) => ({ ...d, [k]: v }));
    setDirty(true);
  }

  async function onSave() {
    const bad = questions
      .map((q, i) => [i, problemWith(q)] as const)
      .find(([, p]) => p);
    if (!name.trim()) return void toast.error('Add a title');
    if (!description.trim()) return void toast.error('Add a subtitle');
    if (questions.length === 0)
      return void toast.error('Add at least one question');
    if (bad) {
      document
        .getElementById(`question-${questions[bad[0]].key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return void toast.error(`Question ${bad[0] + 1} ${bad[1]}.`);
    }
    setSaving(true);
    setError(null);
    try {
      const quizId = await saveItem.mutateAsync({
        type: 'QUIZ',
        name: name.trim(),
        description: description.trim(),
        details,
      });
      const saved = await syncQuizQuestions({
        quizId,
        loc,
        quizName: name.trim(),
        bank: serverBank,
        before: serverQuestions,
        after: questions,
        questionsPerAttempt: perAttempt,
      });
      const count = Math.max(
        1,
        perAttempt === null ? saved.length : Math.min(perAttempt, saved.length),
      );
      setQuestions(saved);
      setServerQuestions(saved);
      setServerBank((b) => ({ bankId: b?.bankId ?? '', count }));
      setDirty(false);
      setSavedOnce(true);
      toast.success(item ? 'Quiz saved.' : 'Quiz published.');
      if (!item)
        void navigate({
          to: '/admin/courses/$courseId/$versionId/lesson',
          params: loc,
          search: {
            module: loc.moduleId,
            section: loc.sectionId,
            item: quizId,
          },
          replace: true,
          ignoreBlocker: true,
        });
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorFrame
      loc={loc}
      itemId={item?._id}
      dirty={dirty}
      kind="Quiz"
      state={state}
      onSave={() => void onSave()}
      saveLabel={item ? 'Save' : 'Publish'}
      onOpenSettings={() => setSettingsOpen(true)}
      wide
    >
      {loadError ? (
        <ErrorText
          error={loadError}
          className="mb-6 rounded-lg bg-destructive/10 px-3 py-2"
        />
      ) : null}
      {error ? (
        <ErrorText
          error={error}
          className="mb-6 rounded-lg bg-destructive/10 px-3 py-2"
        />
      ) : null}

      {tab === 'questions' && (
        <DesktopHint id="quiz-editor">
          You can review and make small changes here. For writing several
          questions, please use a computer.
        </DesktopHint>
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
        titlePlaceholder="Quiz title"
        subtitlePlaceholder="What does this quiz check?"
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'questions' | 'results')}
        className="mt-6 flex-col gap-0"
      >
        {item && (
          <TabsList className="mb-6">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="questions">
          <Item variant="muted">
            <ItemContent>
              <ItemTitle>
                {questions.length}{' '}
                {questions.length === 1 ? 'question' : 'questions'} ·{' '}
                {totalPoints} points
              </ItemTitle>
              <ItemDescription>
                Pass at {Math.round(details.passThreshold * 100)}% ·{' '}
                {details.maxAttempts === -1
                  ? 'unlimited attempts'
                  : `${details.maxAttempts} ${details.maxAttempts === 1 ? 'attempt' : 'attempts'}`}{' '}
                ·{' '}
                {perAttempt === null
                  ? 'every question each attempt'
                  : `${perAttempt} random questions each attempt`}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(true)}
              >
                <SlidersHorizontalIcon aria-hidden /> Settings
              </Button>
            </ItemActions>
          </Item>

          <div className="mt-6 grid gap-4">
            {questions.map((q, i) => (
              <div
                key={q.key}
                id={`question-${q.key}`}
                className="scroll-mt-20"
              >
                <QuestionCard
                  q={q}
                  index={i}
                  onChange={(patch) => update(q.key, patch)}
                  onDuplicate={() => {
                    setQuestions((qs) => {
                      const copy: DraftQuestion = {
                        ...q,
                        key: newKey(),
                        id: undefined,
                        options: q.options.map((o) => ({
                          ...o,
                          key: newKey(),
                        })),
                      };
                      return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
                    });
                    setDirty(true);
                  }}
                  onDelete={() => {
                    setQuestions((qs) => qs.filter((x) => x.key !== q.key));
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          </div>

          <AddQuestionMenu
            onAdd={(type) => {
              const q = blankQuestion(type);
              setQuestions((qs) => [...qs, q]);
              setDirty(true);
              setTimeout(
                () =>
                  document
                    .getElementById(`question-${q.key}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                50,
              );
            }}
          />
        </TabsContent>
        {item && (
          <TabsContent value="results">
            <QuizResults
              quizId={item._id}
              questions={serverQuestions}
              passThreshold={details.passThreshold}
              maxAttempts={details.maxAttempts}
            />
          </TabsContent>
        )}
      </Tabs>

      <QuizSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        details={details}
        setDetail={setDetail}
        perAttempt={perAttempt}
        setPerAttempt={(v) => {
          setPerAttempt(v);
          setDirty(true);
        }}
        questionCount={questions.length}
      />
    </EditorFrame>
  );
}

function AddQuestionMenu({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  return (
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
      <DropdownMenuContent align="center" className="w-72">
        {(Object.keys(TYPES) as QuestionType[]).map((t) => {
          const meta = TYPES[t];
          return (
            <DropdownMenuItem
              key={t}
              onClick={() => onAdd(t)}
              className="items-start gap-3 py-2"
            >
              <meta.icon className="mt-0.5" />
              <span>
                <span className="block font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {meta.short}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuestionCard({
  q,
  index,
  onChange,
  onDuplicate,
  onDelete,
}: {
  q: DraftQuestion;
  index: number;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const meta = TYPES[q.type];
  const [showHint, setShowHint] = useState(!!q.hint);
  // Text is loaded into the editor once; afterwards the editor owns it.
  const [editorSeed] = useState(() => toEditorHtml(q.text));
  const n = index + 1;

  return (
    <Card aria-label={`Question ${n}`} className="gap-0 py-0">
      <CardHeader className="flex flex-wrap items-center gap-2 border-b py-3 [.border-b]:pb-3">
        <Badge className="tabular-nums">{n}</Badge>
        <CardTitle className="inline-flex items-center gap-1.5 text-sm">
          <meta.icon className="size-4 text-muted-foreground" aria-hidden />{' '}
          {meta.label}
        </CardTitle>
        {q.passthrough.isParameterized && (
          <Badge variant="secondary">Parameterized</Badge>
        )}
        <CardAction className="ml-auto flex items-center gap-1.5 self-center">
          <InputGroup className="h-8 w-28">
            <InputGroupInput
              type="number"
              min={0}
              value={q.points}
              onChange={(e) => onChange({ points: Number(e.target.value) })}
              aria-label={`Question ${n} points`}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>pts</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
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
              <DropdownMenuItem onClick={onDuplicate}>
                <CopyIcon /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowHint(true)}>
                <LightbulbIcon /> Add hint
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <TrashIcon /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-5 py-5">
        <RichTextEditor
          value={editorSeed}
          onChange={(html) => onChange({ text: toStoredText(html) })}
          placeholder="Type the question…"
          ariaLabel={`Question ${n} text`}
          className="[&_.tiptap]:text-[15px]"
        />

        {(q.type === 'SELECT_ONE_IN_LOT' ||
          q.type === 'SELECT_MANY_IN_LOT') && (
          <ChoiceOptions q={q} onChange={onChange} />
        )}
        {q.type === 'ORDER_THE_LOTS' && (
          <OrderOptions q={q} onChange={onChange} />
        )}
        {q.type === 'NUMERIC_ANSWER_TYPE' && (
          <FieldSet>
            <FieldLegend variant="label">Accepted answer</FieldLegend>
            <FieldDescription>
              Any answer from “From” to “To” counts as correct. Use the same
              number in both for an exact answer.
            </FieldDescription>
            <FieldGroup className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel htmlFor={`${q.key}-lo`}>From</FieldLabel>
                <Input
                  id={`${q.key}-lo`}
                  type="number"
                  value={q.lowerLimit}
                  onChange={(e) =>
                    onChange({ lowerLimit: Number(e.target.value) })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${q.key}-hi`}>To</FieldLabel>
                <Input
                  id={`${q.key}-hi`}
                  type="number"
                  value={q.upperLimit}
                  onChange={(e) =>
                    onChange({ upperLimit: Number(e.target.value) })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${q.key}-dp`}>Decimal places</FieldLabel>
                <Input
                  id={`${q.key}-dp`}
                  type="number"
                  min={0}
                  max={10}
                  value={q.decimalPrecision}
                  onChange={(e) =>
                    onChange({ decimalPrecision: Number(e.target.value) })
                  }
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        )}
        {q.type === 'DESCRIPTIVE' && (
          <Field>
            <FieldLabel htmlFor={`${q.key}-model`}>Model answer</FieldLabel>
            <Textarea
              id={`${q.key}-model`}
              rows={3}
              value={q.solutionText}
              onChange={(e) => onChange({ solutionText: e.target.value })}
              placeholder="What a good answer includes. Used when grading."
            />
          </Field>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-end gap-4 border-t py-4 [.border-t]:pt-4">
        {showHint ? (
          <Field className="min-w-60 flex-1">
            <FieldLabel htmlFor={`${q.key}-hint`}>
              <LightbulbIcon aria-hidden /> Hint
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={`${q.key}-hint`}
                value={q.hint}
                onChange={(e) => onChange({ hint: e.target.value })}
                placeholder="A nudge, shown if hints are allowed"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Remove hint"
                  onClick={() => {
                    onChange({ hint: '' });
                    setShowHint(false);
                  }}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>
            <LightbulbIcon aria-hidden /> Add hint
          </Button>
        )}
        <Field orientation="horizontal" className="ml-auto w-auto">
          <FieldLabel
            htmlFor={`${q.key}-time`}
            className="font-normal text-muted-foreground"
          >
            Time limit
          </FieldLabel>
          <InputGroup className="h-8 w-28">
            <InputGroupInput
              id={`${q.key}-time`}
              type="number"
              min={5}
              value={q.timeLimitSeconds}
              onChange={(e) =>
                onChange({ timeLimitSeconds: Number(e.target.value) })
              }
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>sec</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </CardFooter>
    </Card>
  );
}

function ChoiceOptions({
  q,
  onChange,
}: {
  q: DraftQuestion;
  onChange: (patch: Partial<DraftQuestion>) => void;
}) {
  const single = q.type === 'SELECT_ONE_IN_LOT';
  const setOption = (key: string, patch: Partial<DraftOption>) =>
    onChange({
      options: q.options.map((o) => (o.key === key ? { ...o, ...patch } : o)),
    });
  const remove = (key: string) =>
    q.options.length > 2
      ? () => onChange({ options: q.options.filter((x) => x.key !== key) })
      : undefined;

  const rows = q.options.map((o, i) => (
    <OptionRow
      key={o.key}
      o={o}
      index={i}
      marker={
        single ? (
          <RadioGroupItem
            value={o.key}
            aria-label={`Option ${i + 1} is correct`}
          />
        ) : (
          <Checkbox
            checked={o.correct}
            onCheckedChange={(c) => setOption(o.key, { correct: c === true })}
            aria-label={`Option ${i + 1} is correct`}
          />
        )
      }
      onChange={(patch) => setOption(o.key, patch)}
      onRemove={remove(o.key)}
    />
  ));

  return (
    <FieldSet>
      <FieldLegend variant="label">Options</FieldLegend>
      <FieldDescription>
        {single ? 'Select the correct answer.' : 'Tick every correct answer.'}
      </FieldDescription>
      {single ? (
        <RadioGroup
          value={q.options.find((o) => o.correct)?.key ?? ''}
          onValueChange={(key) =>
            onChange({
              options: q.options.map((o) => ({ ...o, correct: o.key === key })),
            })
          }
          className="gap-2"
        >
          {rows}
        </RadioGroup>
      ) : (
        <div className="grid gap-2">{rows}</div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => onChange({ options: [...q.options, blankOption()] })}
      >
        <PlusIcon aria-hidden /> Add option
      </Button>
    </FieldSet>
  );
}

function OrderOptions({
  q,
  onChange,
}: {
  q: DraftQuestion;
  onChange: (patch: Partial<DraftQuestion>) => void;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...q.options];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange({ options: next });
  };
  return (
    <FieldSet>
      <FieldLegend variant="label">Items, in the correct order</FieldLegend>
      <FieldDescription>
        Students have to put them back in this order.
      </FieldDescription>
      <div className="grid gap-2">
        {q.options.map((o, i) => (
          <OptionRow
            key={o.key}
            o={o}
            index={i}
            marker={
              <InputGroupText className="w-4 justify-center tabular-nums">
                {i + 1}
              </InputGroupText>
            }
            extraActions={
              <>
                <InputGroupButton
                  size="icon-xs"
                  aria-label={`Move item ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
                <InputGroupButton
                  size="icon-xs"
                  aria-label={`Move item ${i + 1} down`}
                  disabled={i === q.options.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDownIcon />
                </InputGroupButton>
              </>
            }
            onChange={(patch) =>
              onChange({
                options: q.options.map((x) =>
                  x.key === o.key ? { ...x, ...patch } : x,
                ),
              })
            }
            onRemove={
              q.options.length > 2
                ? () =>
                    onChange({
                      options: q.options.filter((x) => x.key !== o.key),
                    })
                : undefined
            }
          />
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => onChange({ options: [...q.options, blankOption()] })}
      >
        <PlusIcon aria-hidden /> Add item
      </Button>
    </FieldSet>
  );
}

/** One option: marker (radio/checkbox/number), text, and actions, as a single InputGroup; the explanation opens below it. */
function OptionRow({
  o,
  index,
  marker,
  extraActions,
  onChange,
  onRemove,
}: {
  o: DraftOption;
  index: number;
  marker: ReactNode;
  extraActions?: ReactNode;
  onChange: (patch: Partial<DraftOption>) => void;
  onRemove?: () => void;
}) {
  const [explain, setExplain] = useState(!!o.explanation);
  return (
    <div className="grid gap-1.5">
      <InputGroup
        className={cn(
          o.correct &&
            'border-emerald-600/50 bg-emerald-500/5 dark:border-emerald-500/50',
        )}
      >
        <InputGroupAddon>{marker}</InputGroupAddon>
        <InputGroupInput
          value={o.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={`Option ${index + 1}`}
          aria-label={`Option ${index + 1}`}
        />
        <InputGroupAddon align="inline-end">
          {extraActions}
          {!explain && (
            <InputGroupButton
              onClick={() => setExplain(true)}
              aria-label={`Explain option ${index + 1}`}
              className="text-muted-foreground"
            >
              <MessageSquareTextIcon className="sm:hidden" aria-hidden />
              <span className="max-sm:hidden">Explain</span>
            </InputGroupButton>
          )}
          {onRemove && (
            <InputGroupButton
              size="icon-xs"
              aria-label={`Remove option ${index + 1}`}
              onClick={onRemove}
            >
              <XIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      {explain && (
        <InputGroup className="ml-6 w-[calc(100%-1.5rem)]">
          <InputGroupAddon>
            <InputGroupText>Why</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            value={o.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            placeholder="Why this is right or wrong (shown after submitting)"
            aria-label={`Option ${index + 1} explanation`}
            autoFocus={!o.explanation}
          />
        </InputGroup>
      )}
    </div>
  );
}

function QuizSettingsSheet({
  open,
  onOpenChange,
  details,
  setDetail,
  perAttempt,
  setPerAttempt,
  questionCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: QuizDetails;
  setDetail: <K extends keyof QuizDetails>(k: K, v: QuizDetails[K]) => void;
  perAttempt: number | null;
  setPerAttempt: (v: number | null) => void;
  questionCount: number;
}) {
  const minutes = (() => {
    const parts = details.approximateTimeToComplete.split(':').map(Number);
    return parts.length === 3 ? parts[0] * 60 + parts[1] : parts[0];
  })();
  const toggles: [keyof QuizDetails, string, string][] = [
    [
      'showScoreAfterSubmission',
      'Show score',
      'Students see their score when they submit.',
    ],
    [
      'showCorrectAnswersAfterSubmission',
      'Show correct answers',
      'Reveal the right answers after submitting.',
    ],
    [
      'showExplanationAfterSubmission',
      'Show explanations',
      'Show each option’s explanation after submitting.',
    ],
    ['allowHint', 'Allow hints', 'Students can open a question’s hint.'],
    ['allowSkip', 'Allow skipping', 'Students can leave questions unanswered.'],
    [
      'allowPartialGrading',
      'Partial credit',
      'Answers that are partly right can earn some points.',
    ],
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Quiz settings</SheetTitle>
          <SheetDescription>Grading and what students see.</SheetDescription>
        </SheetHeader>
        <FieldGroup className="px-4 pb-8">
          <Field>
            <FieldLabel htmlFor="quiz-pass">Pass mark</FieldLabel>
            <InputGroup className="w-32">
              <InputGroupInput
                id="quiz-pass"
                type="number"
                min={0}
                max={100}
                value={Math.round(details.passThreshold * 100)}
                onChange={(e) =>
                  setDetail(
                    'passThreshold',
                    Math.min(100, Math.max(0, Number(e.target.value))) / 100,
                  )
                }
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Score needed to pass and move on.
            </FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="quiz-unlimited">
                Unlimited attempts
              </FieldLabel>
              {details.maxAttempts !== -1 && (
                <InputGroup className="mt-1 w-36">
                  <InputGroupInput
                    type="number"
                    min={1}
                    value={details.maxAttempts}
                    onChange={(e) =>
                      setDetail(
                        'maxAttempts',
                        Math.max(1, Number(e.target.value)),
                      )
                    }
                    aria-label="Number of attempts"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>attempts</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              )}
            </FieldContent>
            <Switch
              id="quiz-unlimited"
              checked={details.maxAttempts === -1}
              onCheckedChange={(c) => setDetail('maxAttempts', c ? -1 : 3)}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="quiz-all">
                Every question, every attempt
              </FieldLabel>
              {perAttempt === null ? (
                <FieldDescription>
                  Turn off to pick a random subset each attempt.
                </FieldDescription>
              ) : (
                <InputGroup className="mt-1 w-44">
                  <InputGroupInput
                    type="number"
                    min={1}
                    max={Math.max(1, questionCount)}
                    value={perAttempt}
                    onChange={(e) =>
                      setPerAttempt(Math.max(1, Number(e.target.value)))
                    }
                    aria-label="Questions per attempt"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>of {questionCount}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              )}
            </FieldContent>
            <Switch
              id="quiz-all"
              checked={perAttempt === null}
              onCheckedChange={(c) =>
                setPerAttempt(
                  c ? null : Math.max(1, Math.min(5, questionCount)),
                )
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="quiz-time">Expected time</FieldLabel>
            <InputGroup className="w-36">
              <InputGroupInput
                id="quiz-time"
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => {
                  const m = Math.max(1, Number(e.target.value));
                  setDetail(
                    'approximateTimeToComplete',
                    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`,
                  );
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>min</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Shown to students before they start.
            </FieldDescription>
          </Field>

          <FieldSeparator />

          {toggles.map(([key, label, help]) => (
            <Field key={key} orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`quiz-${key}`}>{label}</FieldLabel>
                <FieldDescription>{help}</FieldDescription>
              </FieldContent>
              <Switch
                id={`quiz-${key}`}
                checked={!!details[key]}
                onCheckedChange={(c) => setDetail(key, (c === true) as never)}
              />
            </Field>
          ))}
        </FieldGroup>
      </SheetContent>
    </Sheet>
  );
}
