import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { unwrap } from '@vibe/api';
import { updateProfile } from 'firebase/auth';
import { ArrowLeftIcon, PartyPopperIcon } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { ProgressBar } from '@/features/courses/course-ui';
import { Spinner } from '@/components/ui/spinner';
import { NAME_PATTERN } from '@/features/auth/signup-page';
import { useAuth } from '@/features/auth/auth-provider';
import { api } from '@/lib/api';
import { auth } from '@/lib/firebase';

import { MediaCheck, type MediaCheckStatus } from './media-check';
import { writeOnboarding } from './onboarding-state';

const STEPS = ['name', 'media', 'done'] as const;
type Step = (typeof STEPS)[number];

/** Uxcel-style onboarding: progress bar on top, one question per screen, sticky action bar. */
export function OnboardingPage({ redirect }: { redirect?: string } = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('name');
  const [firstName, setFirstName] = useState(() => user?.displayName?.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(() => user?.displayName?.split(' ').slice(1).join(' ') ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaStatus, setMediaStatus] = useState<MediaCheckStatus>('idle');

  const index = STEPS.indexOf(step);
  const progress = ((index + 1) / STEPS.length) * 100;
  const uid = user?.uid ?? '';

  const finish = useCallback(async () => {
    writeOnboarding(uid, { completedAt: new Date().toISOString() });
    await navigate({ to: redirect ?? '/home', replace: true });
  }, [navigate, redirect, uid]);

  async function saveName(e?: FormEvent) {
    e?.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    if (!NAME_PATTERN.test(first) || (last && !NAME_PATTERN.test(last))) {
      setError('Names can only contain letters and spaces.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      unwrap(await api.PATCH('/api/users/edit', { body: { firstName: first, lastName: last || undefined } }));
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: [first, last].filter(Boolean).join(' ') });
      await queryClient.invalidateQueries();
      setStep('media');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step === 'name') return void saveName();
    if (step === 'media') {
      if (mediaStatus === 'passed') writeOnboarding(uid, { mediaCheckPassedAt: new Date().toISOString() });
      return setStep('done');
    }
    return void finish();
  }

  // Uxcel's "or press Enter" shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'BUTTON') return;
      next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 pt-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => setStep(STEPS[Math.max(0, index - 1)])}
          disabled={index === 0}
          className="disabled:invisible"
        >
          <ArrowLeftIcon />
        </Button>
        <ProgressBar value={progress} label="Onboarding progress" className="flex-1 [&_[data-slot=progress-track]]:h-2" />
        <span className="grid size-8 place-items-center rounded-lg bg-primary font-aleo text-sm font-semibold text-primary-foreground" aria-hidden>
          V
        </span>
      </header>

      <main className="flex flex-1 justify-center px-4 pt-14 pb-32 sm:pt-20">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          {step === 'name' && (
            <>
              <h1 className="font-aleo text-3xl tracking-tight">What should we call you?</h1>
              <p className="mt-2 text-sm text-muted-foreground">This is the name your course team and certificates will show.</p>
              <form onSubmit={saveName} className="mt-8 grid w-full gap-4 text-left sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="first-name">First name</FieldLabel>
                  <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" autoCapitalize="words" className="h-11 sm:h-10" autoFocus />
                </Field>
                <Field>
                  <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                  <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" autoCapitalize="words" className="h-11 sm:h-10" />
                </Field>
                <Button type="submit" hidden />
              </form>
              {error && (
                <FieldError className="mt-4">{error}</FieldError>
              )}
            </>
          )}

          {step === 'media' && (
            <>
              <h1 className="font-aleo text-3xl tracking-tight">Check your camera and microphone</h1>
              <p className="mt-2 mb-8 text-sm text-muted-foreground">
                Proctored lessons need both. Nothing is recorded during this check.
              </p>
              <MediaCheck onStatusChange={setMediaStatus} />
            </>
          )}

          {step === 'done' && (
            <>
              <span className="mb-6 grid size-16 place-items-center rounded-2xl bg-primary/15 text-primary">
                <PartyPopperIcon className="size-8" aria-hidden />
              </span>
              <h1 className="font-aleo text-3xl tracking-tight">You’re all set{firstName ? `, ${firstName}` : ''}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your courses appear on your home page once your course team enrols you. Each lesson is short, and a
                checkpoint question follows every segment.
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-muted/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          {step !== 'done' ? (
            <Button type="button" variant="ghost" onClick={() => (step === 'media' ? setStep('done') : finish())}>
              Skip for now
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              or press <Kbd>Enter</Kbd>
            </span>
            <Button
              type="button"
              size="lg"
              onClick={next}
              disabled={saving || (step === 'name' && !firstName.trim())}
            >
              {saving && <Spinner />}
              {step === 'done' && !redirect ? 'Go to home' : 'Continue'}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
