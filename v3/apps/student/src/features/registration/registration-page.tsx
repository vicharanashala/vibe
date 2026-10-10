import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
  ClockIcon,
  LayersIcon,
  LockIcon,
  PartyPopperIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { GeneratedAvatar, GeneratedCover } from '@/components/generated-art';
import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet, FieldTitle } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { FormError } from '@/features/auth/auth-layout';
import { useAuth } from '@/features/auth/auth-provider';
import { useEnrollments } from '@/features/courses/queries';
import { Wordmark } from '@/features/landing/wordmark';
import { cn } from '@/lib/utils';

import {
  registrationErrorKind,
  usePendingRegistrations,
  useRegister,
  useRegistrationDetails,
  useRegistrationForm,
  useRejectedRegistrations,
  type RegistrationDetails,
  type RegistrationForm,
} from './queries';
import { SchemaFields, initialValues, toSubmission, validate, type FormErrors, type FormValues } from './schema-form';

/**
 * Course registration (the link instructors share). Luma-style event page:
 * cover + who teaches it on the left, title and a single registration card on
 * the right; the card is the whole flow — form → "Request sent" / "You're in".
 */
export function RegistrationPage({ versionId, cohortId }: { versionId: string; cohortId?: string }) {
  const details = useRegistrationDetails(versionId);

  return (
    <div className="relative min-h-dvh bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent" />
      <header className="relative flex items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/home" aria-label="ViBe home" className="rounded-md">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative mx-auto max-w-5xl px-4 pt-2 pb-16 sm:px-6 lg:pt-6">
        {details.isPending ? (
          <PageSkeleton />
        ) : details.isError ? (
          <Unavailable message={details.error.message} />
        ) : (
          <CourseRegistration details={details.data} versionId={versionId} cohortId={cohortId} />
        )}
      </main>
    </div>
  );
}

function CourseRegistration({ details, versionId, cohortId }: { details: RegistrationDetails; versionId: string; cohortId?: string }) {
  const name = details.course?.name ?? details.version;
  const description = details.description ?? details.course?.description;
  const cohort = cohortId ? details.cohorts?.find((c) => c.cohortId === cohortId) : undefined;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,300px)_1fr] lg:gap-12">
      <aside className="flex flex-col gap-6">
        <GeneratedCover seed={details.courseId} title={name} className="aspect-[5/2] w-full shadow-lg shadow-primary/10 sm:aspect-[16/9] md:aspect-square" />
        <Instructors instructors={details.instructors} className="hidden md:flex" />
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Course registration</Badge>
            {cohort && <Badge variant="outline">{cohort.cohortName}</Badge>}
          </div>
          <h1 className="mt-3 font-aleo text-3xl leading-tight tracking-tight sm:text-4xl">{name}</h1>
          <ul className="mt-4 flex flex-col gap-3 text-sm" aria-label="Course size">
            <Fact icon={LayersIcon} title={`${details.modules.length} ${details.modules.length === 1 ? 'module' : 'modules'}`} sub={`${details.totalItems} lessons`} />
          </ul>
        </div>

        <RegistrationCard details={details} versionId={versionId} cohortId={cohortId} />

        {description && (
          <section aria-labelledby="about-title">
            <SectionTitle id="about-title">About the course</SectionTitle>
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{description}</p>
          </section>
        )}

        {details.modules.length > 0 && (
          <section aria-labelledby="inside-title">
            <SectionTitle id="inside-title">What’s inside</SectionTitle>
            <ItemGroup className="rounded-3xl bg-card ring-1 ring-foreground/10">
              {details.modules.map((m, i) => (
                <Fragment key={m.id}>
                  {i > 0 && <ItemSeparator />}
                  <Item className="items-start">
                    <ItemMedia variant="icon" className="text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{m.name}</ItemTitle>
                      {m.description && <ItemDescription>{m.description}</ItemDescription>}
                    </ItemContent>
                    <ItemActions className="text-xs text-muted-foreground">
                      {m.itemsCount} {m.itemsCount === 1 ? 'lesson' : 'lessons'}
                    </ItemActions>
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
          </section>
        )}

        <Instructors instructors={details.instructors} className="md:hidden" />
      </div>
    </div>
  );
}

function RegistrationCard({ details, versionId, cohortId }: { details: RegistrationDetails; versionId: string; cohortId?: string }) {
  const form = useRegistrationForm(versionId);
  const enrollments = useEnrollments('active');
  const pending = usePendingRegistrations();
  const register = useRegister(versionId);
  const [outcome, setOutcome] = useState<'APPROVED' | 'PENDING' | 'already-enrolled' | 'closed' | null>(null);

  const enrolled = enrollments.data?.enrollments.some((e) => e.courseVersionId === versionId);
  const pendingRequest = pending.data?.find((r) => r.versionId === versionId && (!cohortId || r.cohortId === cohortId));
  const cohorts = (details.cohorts ?? []).filter((c) => c.isActive);
  const linkCohort = cohortId ? details.cohorts?.find((c) => c.cohortId === cohortId) : undefined;
  const courseLink = { to: '/courses/$courseId/$versionId' as const, params: { courseId: details.courseId, versionId } };

  if (form.isPending || enrollments.isPending || pending.isPending) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  if (outcome === 'APPROVED') {
    return (
      <StatusCard
        tone="success"
        icon={PartyPopperIcon}
        title="You’re in"
        body="Your registration was approved. The course is now in My courses."
        action={
          <Link {...courseLink} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
            Start learning <ArrowRightIcon data-icon="inline-end" />
          </Link>
        }
      />
    );
  }
  if (enrolled || outcome === 'already-enrolled') {
    return (
      <StatusCard
        tone="success"
        icon={CheckIcon}
        title="You’re already in this course"
        body="Pick up where you left off."
        action={
          <Link {...courseLink} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
            Go to course <ArrowRightIcon data-icon="inline-end" />
          </Link>
        }
      />
    );
  }
  if (outcome === 'PENDING' || pendingRequest) {
    return (
      <StatusCard
        tone="waiting"
        icon={ClockIcon}
        title="Request sent"
        body={
          <>
            Your course team will review your registration
            {pendingRequest ? ` (sent ${formatDate(pendingRequest.createdAt)})` : ''}. Once it’s approved, the course appears in My courses.
          </>
        }
        action={
          <Link to="/home" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto')}>
            Back to home
          </Link>
        }
      />
    );
  }
  if (form.isError) {
    return <StatusCard tone="closed" icon={LockIcon} title="Registration isn’t available" body={form.error.message} />;
  }
  if (outcome === 'closed' || !form.data.isActive || (cohortId && (!linkCohort || !linkCohort.isActive))) {
    return (
      <StatusCard
        tone="closed"
        icon={LockIcon}
        title="Registration is closed"
        body="This course isn’t taking registrations right now. If you think that’s a mistake, ask your course team for a new link."
      />
    );
  }

  return (
    <RegistrationFormCard
      form={form.data}
      versionId={versionId}
      cohorts={cohortId ? [] : cohorts}
      cohortId={cohortId}
      pending={register.isPending}
      onSubmit={async (detail) => {
        try {
          const result = await register.mutateAsync(detail);
          setOutcome(result.status);
          return null;
        } catch (err) {
          const message = (err as Error).message;
          const kind = registrationErrorKind(message);
          if (kind === 'already-registered') setOutcome('PENDING');
          else if (kind) setOutcome(kind);
          else return message;
          return null;
        }
      }}
    />
  );
}

function RegistrationFormCard({
  form,
  versionId,
  cohorts,
  cohortId,
  pending,
  onSubmit,
}: {
  form: RegistrationForm;
  versionId: string;
  cohorts: { cohortId: string; cohortName: string }[];
  cohortId?: string;
  pending: boolean;
  onSubmit: (detail: Record<string, unknown>) => Promise<string | null>;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const rejected = useRejectedRegistrations();
  const schema = form.jsonSchema;
  const prefill = useMemo(() => prefillFor(schema.properties ?? {}, user), [schema, user]);
  const [values, setValues] = useState<FormValues>(() => initialValues(schema, prefill));
  const [errors, setErrors] = useState<FormErrors>({});
  const [cohort, setCohort] = useState(cohortId ?? (cohorts.length === 1 ? cohorts[0].cohortId : ''));
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasRejected = rejected.data?.some((r) => r.versionId === versionId) ?? false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const found = validate(schema, values);
    const needsCohort = cohorts.length > 0 && !cohort;
    setErrors(found);
    setCohortError(needsCohort ? 'Choose a cohort to join.' : null);
    if (Object.keys(found).length || needsCohort) {
      const first = Object.keys(found)[0];
      // Centre the first problem so its label isn't hidden behind the screen edge on phones.
      const el = document.getElementById(first ? `reg-${first.replace(/\W+/g, '-')}` : 'reg-cohort');
      el?.focus({ preventScroll: true });
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      return;
    }
    setError(await onSubmit({ ...toSubmission(schema, values), ...(cohort ? { cohort } : {}) }));
  }

  async function switchAccount() {
    const here = window.location.pathname + window.location.search;
    await signOut();
    await navigate({ to: '/login', search: { redirect: here }, replace: true });
  }

  // overflow-clip (not hidden) so the phone Register bar can stay sticky inside the card.
  return (
    <Card role="region" aria-labelledby="register-title" className="gap-0 overflow-clip py-0">
      <CardHeader className="border-b bg-muted/50 py-2.5 [.border-b]:pb-2.5">
        <CardTitle id="register-title" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Registration
        </CardTitle>
      </CardHeader>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-4 sm:p-5">
        <div>
          <p className="text-sm">Welcome! To join the course, fill in a few details below.</p>
          <div className="mt-3 flex items-center gap-2.5 text-sm">
            <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'student'} size={24} />
            <span className="min-w-0 truncate">
              {user?.displayName && <span className="font-medium">{user.displayName} </span>}
              <span className="text-muted-foreground">{user?.email}</span>
            </span>
            <Button variant="link" size="xs" className="ml-auto h-auto shrink-0 p-0 text-muted-foreground" onClick={switchAccount}>
              Not you?
            </Button>
          </div>
        </div>

        {wasRejected && (
          <Alert className="bg-muted/50">
            <InfoIcon />
            <AlertDescription>Your earlier request for this course wasn’t approved. You’re welcome to register again.</AlertDescription>
          </Alert>
        )}

        {cohorts.length > 0 && (
          <FieldSet data-invalid={cohortError ? true : undefined} className="gap-2">
            <FieldLegend variant="label" id="reg-cohort-label">
              Cohort
            </FieldLegend>
            <RadioGroup
              id="reg-cohort"
              aria-labelledby="reg-cohort-label"
              value={cohort}
              onValueChange={(v) => setCohort(String(v))}
              className="grid gap-2 sm:grid-cols-2"
            >
              {cohorts.map((c) => (
                <FieldLabel key={c.cohortId} htmlFor={`cohort-${c.cohortId}`}>
                  <Field orientation="horizontal">
                    <RadioGroupItem id={`cohort-${c.cohortId}`} value={c.cohortId} />
                    <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
                    <FieldTitle className="font-normal">{c.cohortName}</FieldTitle>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
            {cohortError && <FieldError>{cohortError}</FieldError>}
          </FieldSet>
        )}

        <SchemaFields
          schema={schema}
          uiSchema={form.uiSchema}
          values={values}
          errors={errors}
          disabled={pending}
          onChange={(name, value) => {
            setValues((v) => ({ ...v, [name]: value }));
            if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest);
          }}
        />

        <FormError message={error} />

        {/* On phones the button stays pinned while scrolling through a long form. */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Spinner />}
          Register
        </Button>
        </div>
      </form>
    </Card>
  );
}

/** Fills the backend's default Name / Email questions from the signed-in account. */
function prefillFor(properties: Record<string, unknown>, user: { displayName: string | null; email: string | null } | null) {
  const prefill: Record<string, string | undefined> = {};
  for (const key of Object.keys(properties)) {
    if (/^(full\s*)?name$/i.test(key) && user?.displayName) prefill[key] = user.displayName;
    if (/^e-?mail$/i.test(key) && user?.email) prefill[key] = user.email;
  }
  return prefill;
}

function StatusCard({
  tone,
  icon: Icon,
  title,
  body,
  action,
}: {
  tone: 'success' | 'waiting' | 'closed';
  icon: LucideIcon;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card role="status" aria-label={title}>
      <CardHeader>
        <span
          className={cn(
            'mb-3 grid size-10 place-items-center rounded-full',
            tone === 'success' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
            tone === 'waiting' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
            tone === 'closed' && 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {action && <CardFooter>{action}</CardFooter>}
    </Card>
  );
}

function Instructors({ instructors, className }: { instructors: RegistrationDetails['instructors']; className?: string }) {
  if (!instructors.length) return null;
  return (
    <section aria-labelledby={`taught-by-${className ?? ''}`} className={cn('flex-col', className)}>
      <SectionTitle id={`taught-by-${className ?? ''}`}>Taught by</SectionTitle>
      <ItemGroup>
        {instructors.map((i) => (
          <Item key={i.name} size="xs" className="px-0">
            <ItemMedia>
              <GeneratedAvatar seed={i.name} src={i.profileImage} size={28} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{i.name}</ItemTitle>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}

function Fact({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <Item size="xs" className="px-0" render={<li />}>
      <ItemMedia variant="icon" className="size-10 rounded-lg bg-card ring-1 ring-border">
        <Icon className="text-muted-foreground" aria-hidden />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{sub}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-3 border-b border-border pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h1 className="font-aleo text-2xl font-normal">We couldn’t open this registration link</h1>
        </EmptyTitle>
        <EmptyDescription>Check the link with your course team. ({message})</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/home" className={buttonVariants({ variant: 'outline' })}>
          Go to home
        </Link>
      </EmptyContent>
    </Empty>
  );
}

function PageSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-[300px_1fr] lg:gap-12" aria-busy="true" aria-label="Loading">
      <Skeleton className="aspect-[16/9] rounded-2xl md:aspect-square" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'recently' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
