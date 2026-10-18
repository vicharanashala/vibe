import { useNavigate } from '@tanstack/react-router';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CircleDotIcon,
  CopyIcon,
  HashIcon,
  LightbulbIcon,
  ListChecksIcon,
  ListOrderedIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TextIcon,
  TrashIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { toEditorHtml, toStoredText } from '@/components/rich-content';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { ErrorText } from '../studio-ui';
import { EditorFrame, TitleFields, type SaveState } from './editor-frame';
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

const TYPES: Record<QuestionType, { label: string; short: string; icon: LucideIcon }> = {
  SELECT_ONE_IN_LOT: { label: 'Single choice', short: 'One correct answer', icon: CircleDotIcon },
  SELECT_MANY_IN_LOT: { label: 'Multiple choice', short: 'One or more correct answers', icon: ListChecksIcon },
  ORDER_THE_LOTS: { label: 'Put in order', short: 'Arrange items in the right order', icon: ListOrderedIcon },
  NUMERIC_ANSWER_TYPE: { label: 'Number', short: 'A numeric answer within a range', icon: HashIcon },
  DESCRIPTIVE: { label: 'Written answer', short: 'Free text, graded by you', icon: TextIcon },
};

function problemWith(q: DraftQuestion): string | null {
  if (!q.text.trim()) return 'is missing its question text';
  if (q.type === 'SELECT_ONE_IN_LOT' || q.type === 'SELECT_MANY_IN_LOT' || q.type === 'ORDER_THE_LOTS') {
    if (q.options.length < 2) return 'needs at least two options';
    if (q.options.some((o) => !o.text.trim())) return 'has an empty option';
  }
  if (q.type === 'SELECT_ONE_IN_LOT' && q.options.filter((o) => o.correct).length !== 1) return 'needs exactly one correct answer';
  if (q.type === 'SELECT_MANY_IN_LOT' && !q.options.some((o) => o.correct)) return 'needs at least one correct answer';
  if (q.type === 'NUMERIC_ANSWER_TYPE' && q.upperLimit < q.lowerLimit) return 'has a range that ends below its start';
  return null;
}

/** Quiz builder: title, settings, and a list of question cards. Questions live in the quiz's own question bank. */
export function QuizEditor({ loc, item }: { loc: LessonLocation; item?: LessonItem }) {
  const existing = useQuizQuestions(item?._id);
  if (item && existing.isPending) {
    return (
      <EditorFrame courseId={loc.courseId} versionId={loc.versionId} kind="Quiz" state="clean" onSave={() => undefined} saveLabel="Save" canSave={false}>
        <div className="grid gap-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </EditorFrame>
    );
  }
  return <QuizEditorBody loc={loc} item={item} bank={existing.data?.bank ?? null} initial={existing.data?.questions ?? []} loadError={existing.error} />;
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
  const [details, setDetails] = useState<QuizDetails>(() => ({ ...DEFAULT_QUIZ_DETAILS, releaseTime: new Date().toISOString(), ...(item?.details ?? {}) }));
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => (initial.length ? initial : item ? [] : [blankQuestion()]));
  const [serverQuestions, setServerQuestions] = useState<DraftQuestion[]>(initial);
  const [serverBank, setServerBank] = useState(bank);
  const [perAttempt, setPerAttempt] = useState<number | null>(bank && initial.length && bank.count < initial.length ? bank.count : null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  const totalPoints = questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const state: SaveState = saving ? 'saving' : error ? 'error' : dirty ? (item ? 'dirty' : 'new') : savedOnce ? 'saved' : item ? 'clean' : 'new';

  function update(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
    setDirty(true);
  }
  function setDetail<K extends keyof QuizDetails>(k: K, v: QuizDetails[K]) {
    setDetails((d) => ({ ...d, [k]: v }));
    setDirty(true);
  }

  async function onSave() {
    const bad = questions.map((q, i) => [i, problemWith(q)] as const).find(([, p]) => p);
    if (!name.trim()) return void toast.error('Add a title');
    if (!description.trim()) return void toast.error('Add a subtitle');
    if (questions.length === 0) return void toast.error('Add at least one question');
    if (bad) {
      document.getElementById(`question-${questions[bad[0]].key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return void toast.error(`Question ${bad[0] + 1} ${bad[1]}.`);
    }
    setSaving(true);
    setError(null);
    try {
      const quizId = await saveItem.mutateAsync({ type: 'QUIZ', name: name.trim(), description: description.trim(), details });
      const saved = await syncQuizQuestions({ quizId, loc, quizName: name.trim(), bank: serverBank, before: serverQuestions, after: questions, questionsPerAttempt: perAttempt });
      const count = Math.max(1, perAttempt === null ? saved.length : Math.min(perAttempt, saved.length));
      setQuestions(saved);
      setServerQuestions(saved);
      setServerBank((b) => ({ bankId: b?.bankId ?? '', count }));
      setDirty(false);
      setSavedOnce(true);
      toast.success(item ? 'Quiz saved.' : 'Quiz published.');
      if (!item) void navigate({ to: '/admin/courses/$courseId/$versionId/lesson', params: loc, search: { module: loc.moduleId, section: loc.sectionId, item: quizId }, replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorFrame
      courseId={loc.courseId}
      versionId={loc.versionId}
      kind="Quiz"
      state={state}
      onSave={() => void onSave()}
      saveLabel={item ? 'Save' : 'Publish'}
      onOpenSettings={() => setSettingsOpen(true)}
      wide
    >
      {loadError ? <ErrorText error={loadError} className="mb-6 rounded-lg bg-destructive/10 px-3 py-2" /> : null}
      {error ? <ErrorText error={error} className="mb-6 rounded-lg bg-destructive/10 px-3 py-2" /> : null}

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

      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="mt-6 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary"
      >
        <span className="font-medium">
          {questions.length} {questions.length === 1 ? 'question' : 'questions'}
        </span>
        <span className="text-muted-foreground">{totalPoints} points</span>
        <span className="text-muted-foreground">Pass at {Math.round(details.passThreshold * 100)}%</span>
        <span className="text-muted-foreground">{details.maxAttempts === -1 ? 'Unlimited attempts' : `${details.maxAttempts} ${details.maxAttempts === 1 ? 'attempt' : 'attempts'}`}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <SlidersHorizontalIcon className="size-4" aria-hidden /> Settings
        </span>
      </button>

      <ol className="mt-6 grid gap-4">
        {questions.map((q, i) => (
          <li key={q.key} id={`question-${q.key}`}>
            <QuestionCard
              q={q}
              index={i}
              onChange={(patch) => update(q.key, patch)}
              onDuplicate={() => {
                setQuestions((qs) => {
                  const copy: DraftQuestion = { ...q, key: newKey(), id: undefined, options: q.options.map((o) => ({ ...o, key: newKey() })) };
                  return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
                });
                setDirty(true);
              }}
              onDelete={() => {
                setQuestions((qs) => qs.filter((x) => x.key !== q.key));
                setDirty(true);
              }}
            />
          </li>
        ))}
      </ol>

      <AddQuestionMenu
        onAdd={(type) => {
          const q = blankQuestion(type);
          setQuestions((qs) => [...qs, q]);
          setDirty(true);
          setTimeout(() => document.getElementById(`question-${q.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        }}
      />

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
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card hover:text-foreground"
          />
        }
      >
        <PlusIcon className="size-4" aria-hidden /> Add question
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-72">
        {(Object.keys(TYPES) as QuestionType[]).map((t) => {
          const meta = TYPES[t];
          return (
            <DropdownMenuItem key={t} onClick={() => onAdd(t)} className="items-start gap-3 py-2">
              <meta.icon className="mt-0.5" />
              <span>
                <span className="block font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">{meta.short}</span>
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

  return (
    <section aria-label={`Question ${index + 1}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground tabular-nums">{index + 1}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <meta.icon className="size-4 text-muted-foreground" aria-hidden /> {meta.label}
        </span>
        {q.passthrough.isParameterized && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Parameterized</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Points
            <Input type="number" min={0} value={q.points} onChange={(e) => onChange({ points: Number(e.target.value) })} className="h-8 w-16 text-sm" aria-label={`Question ${index + 1} points`} />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Question ${index + 1}: actions`} className="text-muted-foreground" />}>
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
        </div>
      </header>

      <div className="grid gap-5 p-4 sm:p-5">
        <RichTextEditor
          value={editorSeed}
          onChange={(html) => onChange({ text: toStoredText(html) })}
          placeholder="Type the question…"
          ariaLabel={`Question ${index + 1} text`}
          className="[&_.tiptap]:text-[15px]"
        />

        {(q.type === 'SELECT_ONE_IN_LOT' || q.type === 'SELECT_MANY_IN_LOT') && <ChoiceOptions q={q} onChange={onChange} />}
        {q.type === 'ORDER_THE_LOTS' && <OrderOptions q={q} onChange={onChange} />}
        {q.type === 'NUMERIC_ANSWER_TYPE' && (
          <div>
            <p className="text-sm font-medium">Accepted answer</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel htmlFor={`${q.key}-lo`} className="text-xs font-normal text-muted-foreground">From</FieldLabel>
                <Input id={`${q.key}-lo`} type="number" value={q.lowerLimit} onChange={(e) => onChange({ lowerLimit: Number(e.target.value) })} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${q.key}-hi`} className="text-xs font-normal text-muted-foreground">To</FieldLabel>
                <Input id={`${q.key}-hi`} type="number" value={q.upperLimit} onChange={(e) => onChange({ upperLimit: Number(e.target.value) })} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${q.key}-dp`} className="text-xs font-normal text-muted-foreground">Decimal places</FieldLabel>
                <Input id={`${q.key}-dp`} type="number" min={0} max={10} value={q.decimalPrecision} onChange={(e) => onChange({ decimalPrecision: Number(e.target.value) })} />
              </Field>
            </div>
            <FieldDescription className="mt-2">Any answer from “From” to “To” counts as correct. Use the same number in both for an exact answer.</FieldDescription>
          </div>
        )}
        {q.type === 'DESCRIPTIVE' && (
          <Field>
            <FieldLabel htmlFor={`${q.key}-model`}>Model answer</FieldLabel>
            <Textarea id={`${q.key}-model`} rows={3} value={q.solutionText} onChange={(e) => onChange({ solutionText: e.target.value })} placeholder="What a good answer includes. Used when grading." />
          </Field>
        )}

        <div className="flex flex-wrap items-end gap-4 border-t border-dashed border-border pt-4">
          {showHint ? (
            <Field className="min-w-60 flex-1">
              <FieldLabel htmlFor={`${q.key}-hint`} className="text-xs font-normal text-muted-foreground">
                <LightbulbIcon className="size-3.5" aria-hidden /> Hint
              </FieldLabel>
              <div className="flex gap-1">
                <Input id={`${q.key}-hint`} value={q.hint} onChange={(e) => onChange({ hint: e.target.value })} placeholder="A nudge, shown if hints are allowed" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove hint"
                  onClick={() => {
                    onChange({ hint: '' });
                    setShowHint(false);
                  }}
                >
                  <XIcon aria-hidden />
                </Button>
              </div>
            </Field>
          ) : (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowHint(true)}>
              <LightbulbIcon aria-hidden /> Add hint
            </Button>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            Time limit
            <Input type="number" min={5} value={q.timeLimitSeconds} onChange={(e) => onChange({ timeLimitSeconds: Number(e.target.value) })} className="h-8 w-20 text-sm" aria-label={`Question ${index + 1} time limit in seconds`} />
            sec
          </label>
        </div>
      </div>
    </section>
  );
}

function ChoiceOptions({ q, onChange }: { q: DraftQuestion; onChange: (patch: Partial<DraftQuestion>) => void }) {
  const single = q.type === 'SELECT_ONE_IN_LOT';
  const setOption = (key: string, patch: Partial<DraftOption>) => onChange({ options: q.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  const markCorrect = (key: string) =>
    onChange({ options: q.options.map((o) => (single ? { ...o, correct: o.key === key } : o.key === key ? { ...o, correct: !o.correct } : o)) });

  return (
    <div>
      <p className="text-sm font-medium">Options</p>
      <p className="text-xs text-muted-foreground">{single ? 'Click the circle next to the correct answer.' : 'Tick every correct answer.'}</p>
      <ul className="mt-3 grid gap-2">
        {q.options.map((o, i) => (
          <OptionRow
            key={o.key}
            o={o}
            index={i}
            marker={
              <button
                type="button"
                role={single ? 'radio' : 'checkbox'}
                aria-checked={o.correct}
                aria-label={`Mark option ${i + 1} as correct`}
                onClick={() => markCorrect(o.key)}
                className={cn(
                  'grid size-6 shrink-0 place-items-center border-2 transition-colors',
                  single ? 'rounded-full' : 'rounded-md',
                  o.correct ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500' : 'border-input hover:border-emerald-600/60',
                )}
              >
                {o.correct && <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden />}
              </button>
            }
            onChange={(patch) => setOption(o.key, patch)}
            onRemove={q.options.length > 2 ? () => onChange({ options: q.options.filter((x) => x.key !== o.key) }) : undefined}
          />
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => onChange({ options: [...q.options, blankOption()] })}>
        <PlusIcon aria-hidden /> Add option
      </Button>
    </div>
  );
}

function OrderOptions({ q, onChange }: { q: DraftQuestion; onChange: (patch: Partial<DraftQuestion>) => void }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...q.options];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange({ options: next });
  };
  return (
    <div>
      <p className="text-sm font-medium">Items, in the correct order</p>
      <p className="text-xs text-muted-foreground">Students have to put them back in this order.</p>
      <ol className="mt-3 grid gap-2">
        {q.options.map((o, i) => (
          <OptionRow
            key={o.key}
            o={o}
            index={i}
            marker={
              <span className="flex shrink-0 items-center gap-0.5">
                <span className="w-5 text-center text-sm font-medium text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex flex-col">
                  <button type="button" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ArrowUpIcon className="size-3.5" aria-hidden />
                  </button>
                  <button type="button" aria-label={`Move item ${i + 1} down`} disabled={i === q.options.length - 1} onClick={() => move(i, 1)} className="rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ArrowDownIcon className="size-3.5" aria-hidden />
                  </button>
                </span>
              </span>
            }
            onChange={(patch) => onChange({ options: q.options.map((x) => (x.key === o.key ? { ...x, ...patch } : x)) })}
            onRemove={q.options.length > 2 ? () => onChange({ options: q.options.filter((x) => x.key !== o.key) }) : undefined}
          />
        ))}
      </ol>
      <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => onChange({ options: [...q.options, blankOption()] })}>
        <PlusIcon aria-hidden /> Add item
      </Button>
    </div>
  );
}

function OptionRow({
  o,
  index,
  marker,
  onChange,
  onRemove,
}: {
  o: DraftOption;
  index: number;
  marker: React.ReactNode;
  onChange: (patch: Partial<DraftOption>) => void;
  onRemove?: () => void;
}) {
  const [explain, setExplain] = useState(!!o.explanation);
  return (
    <li className={cn('rounded-xl border bg-background/60 p-2 transition-colors', o.correct ? 'border-emerald-600/40 bg-emerald-50/50 dark:bg-emerald-500/5' : 'border-border')}>
      <div className="flex items-center gap-2.5">
        {marker}
        <Input value={o.text} onChange={(e) => onChange({ text: e.target.value })} placeholder={`Option ${index + 1}`} aria-label={`Option ${index + 1}`} className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent" />
        {!explain && (
          <Button variant="ghost" size="sm" className="shrink-0 text-xs text-muted-foreground" onClick={() => setExplain(true)}>
            Explain
          </Button>
        )}
        {onRemove && (
          <Button variant="ghost" size="icon-sm" aria-label={`Remove option ${index + 1}`} className="shrink-0 text-muted-foreground" onClick={onRemove}>
            <XIcon aria-hidden />
          </Button>
        )}
      </div>
      {explain && (
        <Input
          value={o.explanation}
          onChange={(e) => onChange({ explanation: e.target.value })}
          placeholder="Why this is right or wrong (shown after submitting)"
          aria-label={`Option ${index + 1} explanation`}
          className="mt-1.5 ml-[2.125rem] w-[calc(100%-2.125rem)] text-sm"
          autoFocus={!o.explanation}
        />
      )}
    </li>
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
    ['showScoreAfterSubmission', 'Show score', 'Students see their score when they submit.'],
    ['showCorrectAnswersAfterSubmission', 'Show correct answers', 'Reveal the right answers after submitting.'],
    ['showExplanationAfterSubmission', 'Show explanations', 'Show each option’s explanation after submitting.'],
    ['allowHint', 'Allow hints', 'Students can open a question’s hint.'],
    ['allowSkip', 'Allow skipping', 'Students can leave questions unanswered.'],
    ['allowPartialGrading', 'Partial credit', 'Answers that are partly right can earn some points.'],
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Quiz settings</SheetTitle>
          <SheetDescription>Grading and what students see.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 pb-8">
          <Field>
            <FieldLabel htmlFor="quiz-pass">Pass mark</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="quiz-pass"
                type="number"
                min={0}
                max={100}
                value={Math.round(details.passThreshold * 100)}
                onChange={(e) => setDetail('passThreshold', Math.min(100, Math.max(0, Number(e.target.value))) / 100)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">% to pass and move on</span>
            </div>
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="quiz-unlimited">Unlimited attempts</FieldLabel>
              <Switch id="quiz-unlimited" checked={details.maxAttempts === -1} onCheckedChange={(c) => setDetail('maxAttempts', c ? -1 : 3)} />
            </div>
            {details.maxAttempts !== -1 && (
              <div className="flex items-center gap-2">
                <Input type="number" min={1} value={details.maxAttempts} onChange={(e) => setDetail('maxAttempts', Math.max(1, Number(e.target.value)))} className="w-24" aria-label="Number of attempts" />
                <span className="text-sm text-muted-foreground">attempts</span>
              </div>
            )}
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="quiz-all">Every question, every attempt</FieldLabel>
              <Switch id="quiz-all" checked={perAttempt === null} onCheckedChange={(c) => setPerAttempt(c ? null : Math.max(1, Math.min(5, questionCount)))} />
            </div>
            {perAttempt !== null && (
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={Math.max(1, questionCount)} value={perAttempt} onChange={(e) => setPerAttempt(Math.max(1, Number(e.target.value)))} className="w-24" aria-label="Questions per attempt" />
                <span className="text-sm text-muted-foreground">picked at random from {questionCount}</span>
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="quiz-time">Expected time</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="quiz-time"
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => {
                  const m = Math.max(1, Number(e.target.value));
                  setDetail('approximateTimeToComplete', `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`);
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">minutes (shown to students)</span>
            </div>
          </Field>

          <div className="grid gap-4 border-t border-border pt-5">
            {toggles.map(([key, label, help]) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <label htmlFor={`quiz-${key}`} className="cursor-pointer">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{help}</span>
                </label>
                <Switch id={`quiz-${key}`} checked={!!details[key]} onCheckedChange={(c) => setDetail(key, (c === true) as never)} />
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
