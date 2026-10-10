import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';

import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';

import { AuthLayout, FormError, GoogleIcon, OrDivider } from './auth-layout';
import { useAuth } from './auth-provider';

export function LoginPage({ redirect }: { redirect?: string }) {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goNext = (isNewUser = false) =>
    isNewUser ? navigate({ to: '/onboarding', search: { redirect }, replace: true }) : navigate({ to: redirect ?? '/home', replace: true });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending('email');
    try {
      await signIn(email.trim(), password);
      await goNext();
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
      await goNext(isNewUser);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <AuthLayout
      title="Welcome back to ViBe"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" search={{ redirect }} className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={onGoogle} disabled={pending !== null}>
        {pending === 'google' ? <Spinner /> : <GoogleIcon className="size-4" />}
        Continue with Google
      </Button>

      <OrDivider />

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input
              id="email"
              type="email"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 sm:h-10"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Link to="/forgot-password" className="w-fit text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Forgot my password
            </Link>
          </Field>

          <FormError message={error} />

          <Button type="submit" size="lg" className="w-full" disabled={pending !== null || !email || !password}>
            {pending === 'email' && <Spinner />}
            Continue
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
