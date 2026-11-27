import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@vibe/api';
import { CheckCircle2Icon, InfoIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { courseKeys, visibleInOrder, type SectionItem } from '@/features/courses/queries';
import { useCourseSettings, type LessonRef } from '@/features/learn/queries';
import { api } from '@/lib/api';

import { FeedbackFormFields } from './feedback-form';
import { fieldName, schemaToFields, toSubmission, validate, type FormValues } from './form-schema';
import { answeredOn, myFeedbackKey, useMyFeedback } from './my-feedback';

/** The lesson before the form, for "go back and watch it" links. */
export interface PreviousLessonLink {
  courseId: string;
  versionId: string;
  moduleId: string;
  sectionId: string;
  itemId: string;
}

/**
 * A feedback form in study mode. Strict mode is PC-only, so this is how
 * students on phones answer: fillable and sendable when the course allows it
 * (on by default), never touching strict progress. When the course doesn't
 * allow it, the questions stay read-only with the student's current answer.
 */
/**
 * The lesson right before the form in its own section (the one it is about):
 * one request, instead of waiting for the whole course syllabus.
 */
function usePreviousInSection(ref: LessonRef): PreviousLessonLink | null {
  const items = useQuery({
    queryKey: courseKeys.sectionItems(ref.versionId, ref.moduleId, ref.sectionId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items', {
          params: { path: { versionId: ref.versionId, moduleId: ref.moduleId, sectionId: ref.sectionId } },
        }),
      ) as unknown as SectionItem[],
  });
  const list = visibleInOrder(items.data ?? []);
  const index = list.findIndex((i) => i._id === ref.itemId);
  const before = index > 0 ? list[index - 1] : undefined;
  return before
    ? { courseId: ref.courseId, versionId: ref.versionId, moduleId: ref.moduleId, sectionId: ref.sectionId, itemId: before._id }
    : null;
}

export function StudyFeedbackForm({
  lessonRef: ref,
  jsonSchema,
  uiSchema,
  previous,
}: {
  lessonRef: LessonRef;
  jsonSchema: unknown;
  uiSchema: unknown;
  /** Optional; otherwise looked up in the form's own section. */
  previous?: PreviousLessonLink | null;
}) {
  const inSection = usePreviousInSection(ref);
  const previousLesson = inSection ?? previous ?? null;
  const fields = useMemo(() => schemaToFields(jsonSchema as never, uiSchema as never), [jsonSchema, uiSchema]);
  const settings = useCourseSettings(ref.courseId, ref.versionId);
  const allowed = settings.data?.settings.studyModeFeedback !== false;
  const queryClient = useQueryClient();
  const mine = useMyFeedback(ref.itemId);
  const answered = mine.data ?? null;

  const [values, setValues] = useState<FormValues>({});
  const [edited, setEdited] = useState(false);
  const prefilled = useRef(false);
  useEffect(() => {
    if (answered && !prefilled.current) {
      prefilled.current = true;
      setValues(answered.details);
    }
  }, [answered]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function send() {
    setRefusal(null);
    setError(null);
    const problems = validate(fields, values);
    setErrors(problems);
    if (Object.keys(problems).length) {
      document.getElementById(`fb-${fields.findIndex((f) => problems[fieldName(f)])}`)?.focus();
      return;
    }
    setSending(true);
    try {
      unwrap(
        await api.POST('/api/quizzes/{itemId}/feedback/submit', {
          params: { path: { itemId: ref.itemId } },
          body: {
            details: toSubmission(fields, values),
            courseId: ref.courseId,
            courseVersionId: ref.versionId,
            sectionId: ref.sectionId,
            mode: 'study',
          } as never,
        }),
      );
      setEdited(false);
      toast.success('Thanks for your feedback.');
      await queryClient.invalidateQueries({ queryKey: myFeedbackKey(ref.itemId) });
    } catch (e) {
      const message = (e as Error).message;
      if (/previous video/i.test(message ?? '')) setRefusal(message);
      else setError(message || 'Couldn’t send your feedback. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (!allowed) {
    return (
      <div className="grid gap-6">
        <Alert>
          <InfoIcon />
          <AlertDescription>
            This is the feedback form for the previous lesson. Your course team accepts answers only in strict mode, on a
            computer.
            {answered && ` Showing what you answered on ${answeredOn(answered.createdAt)}.`}
          </AlertDescription>
        </Alert>
        <FeedbackFormFields fields={fields} values={answered?.details ?? {}} onChange={() => undefined} disabled />
      </div>
    );
  }

  const unchanged = !!answered && !edited;
  return (
    <form
      className="grid gap-6"
      aria-label="Feedback form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {answered ? (
        <Alert>
          <CheckCircle2Icon />
          <AlertDescription>
            You answered this on {answeredOn(answered.createdAt)}. Change any answer and press Update feedback to replace
            it.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <InfoIcon />
          <AlertDescription>This is the feedback form for the previous lesson. Answers sent here don’t change your strict-mode progress.</AlertDescription>
        </Alert>
      )}
      {refusal && (
        <Alert variant="destructive">
          <InfoIcon />
          <AlertDescription>
            <p>{refusal} Your answers are kept.</p>
            {previousLesson && (
              <Link
                to="/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId"
                params={previousLesson}
                search={{ track: 'blue' }}
                className="font-medium underline underline-offset-4"
              >
                Go to the previous lesson
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">This feedback form has no questions yet.</p>
      ) : (
        <FeedbackFormFields
          cards
          fields={fields}
          values={values}
          errors={errors}
          disabled={sending}
          onChange={(name, v) => {
            setEdited(true);
            setValues((prev) => ({ ...prev, [name]: v }));
            setErrors((prev) => {
              if (!prev[name]) return prev;
              const rest = { ...prev };
              delete rest[name];
              return rest;
            });
          }}
        />
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="lg" className="h-11 w-full sm:h-10 sm:w-auto" disabled={sending || fields.length === 0 || unchanged}>
          {sending && <Spinner />}
          {answered ? (unchanged ? 'Answer saved' : 'Update feedback') : 'Send feedback'}
        </Button>
      </div>
    </form>
  );
}
