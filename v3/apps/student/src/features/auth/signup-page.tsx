import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2Icon, CircleIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { AuthLayout, FormError, GoogleIcon, OrDivider } from './auth-layout';
import { splitName, useAuth } from './auth-provider';

/** The backend documents these rules for sign-up passwords (AuthValidators.SignUpBody). */
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /\d/.test(p) },
  { label: 'A symbol, e.g. ! @ # $', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

/** Backend rule: names may only contain letters and spaces. */
export const NAME_PATTERN = /^[A-Za-z ]+$/;

export function SignupPage({ redirect }: { redirect?: string } = {}) {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'details' | 'password'>('details');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameValid = NAME_PATTERN.test(fullName.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));

  function onDetails(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nameValid) return setError('Your name can only contain letters and spaces.');
    if (!emailValid) return setError('Enter a valid email address.');
    setStep('password');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!passwordValid) return;
    setError(null);
    setPending('email');
    try {
      await signUp({ ...splitName(fullName), email: email.trim(), password });
      await navigate({ to: '/onboarding', search: { redirect }, replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function onGoogle() {
    setError(null);
    setPending('google');
    try {
      const { isNewUser } = await signInWithGoogle();
      await (isNewUser
        ? navigate({ to: '/onboarding', search: { redirect }, replace: true })
        : navigate({ to: redirect ?? '/home', replace: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  const loginFooter = (
    <>
      Already have an account?{' '}
      <Link to="/login" search={{ redirect }} className="font-medium text-foreground hover:underline">
        Log in
      </Link>
    </>
  );

  if (step === 'password') {
    return (
      <AuthLayout
        title="Create a password"
        subtitle={
          <>
            For <span className="font-medium text-foreground">{email.trim()}</span>.{' '}
            <Button variant="link" size="xs" className="h-auto p-0 text-muted-foreground" onClick={() => setStep('details')}>
              Not you?
            </Button>
          </>
        }
        footer={loginFooter}
      >
        <form onSubmit={onCreate} noValidate>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-rules"
              />
              <ul id="password-rules" className="mt-1 flex flex-col gap-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <li key={rule.label} className={cn('flex items-center gap-2 text-xs', ok ? 'text-foreground' : 'text-muted-foreground')}>
                      {ok ? <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden /> : <CircleIcon className="size-4" aria-hidden />}
                      {rule.label}
                      <span className="sr-only">{ok ? '(met)' : '(not met)'}</span>
                    </li>
                  );
                })}
              </ul>
            </Field>

            <FormError message={error} />

            <Button type="submit" size="lg" className="w-full" disabled={!passwordValid || pending !== null}>
              {pending === 'email' && <Spinner />}
              Create account
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You&apos;ll be asked for consent before any proctored course uses your camera or microphone.
            </p>
          </FieldGroup>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your ViBe account" subtitle="Learn in short segments and prove what you know as you go." footer={loginFooter}>
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={onGoogle} disabled={pending !== null}>
        {pending === 'google' ? <Spinner /> : <GoogleIcon className="size-4" />}
        Continue with Google
      </Button>

      <OrDivider />

      <form onSubmit={onDetails} noValidate>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input id="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 sm:h-10" />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input id="email" type="email" autoCapitalize="none" spellCheck={false} autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 sm:h-10" />
          </Field>

          <FormError message={error} />

          <Button type="submit" size="lg" className="w-full" disabled={!fullName.trim() || !email.trim()}>
            Continue
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
