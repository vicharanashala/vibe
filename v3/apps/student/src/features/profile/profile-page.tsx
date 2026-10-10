import { useNavigate } from '@tanstack/react-router';
import { unwrap } from '@vibe/api';
import { updateProfile } from 'firebase/auth';
import { CheckCircle2Icon, LogOutIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { PasswordInput } from '@/components/password-input';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';
import { GeneratedAvatar } from '@/components/generated-art';
import { useAuth } from '@/features/auth/auth-provider';
import { NAME_PATTERN, PASSWORD_RULES } from '@/features/auth/signup-page';
import { api } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-border py-6 last:border-b-0 sm:gap-6 sm:py-8 md:grid-cols-[240px_1fr]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="max-w-lg">{children}</div>
    </section>
  );
}

function Status({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={cn('flex items-center gap-2 text-sm', kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
      {kind === 'ok' && <CheckCircle2Icon className="size-4" aria-hidden />}
      {children}
    </p>
  );
}

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const usesPassword = user?.providerData.some((p) => p.providerId === 'password') ?? false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex items-center gap-4">
        <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'student'} size={64} label="Your avatar" />
        <div className="min-w-0">
          <h1 className="truncate font-aleo text-3xl tracking-tight">{user?.displayName || 'Your profile'}</h1>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="mt-6">
        <Panel title="Your name" description="Shown to your course team and on certificates.">
          <NameForm />
        </Panel>
        {usesPassword && (
          <Panel title="Password" description="Choose a new password for signing in with your email.">
            <PasswordForm />
          </Panel>
        )}
        <Panel title="Appearance" description="ViBe uses the light theme unless you choose otherwise.">
          <ToggleGroup
            aria-label="Theme"
            variant="outline"
            value={[theme]}
            onValueChange={(v: string[]) => v[0] && setTheme(v[0] as 'light' | 'dark')}
            className="w-full sm:w-fit"
          >
            <ToggleGroupItem value="light" className="flex-1 sm:flex-none">
              <SunIcon aria-hidden /> Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="flex-1 sm:flex-none">
              <MoonIcon aria-hidden /> Dark
            </ToggleGroupItem>
          </ToggleGroup>
        </Panel>
        <Panel title="Session">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={async () => {
              await signOut();
              await navigate({ to: '/login', replace: true });
            }}
          >
            <LogOutIcon /> Log out
          </Button>
        </Panel>
      </div>
    </div>
  );
}

function NameForm() {
  const { user } = useAuth();
  const [first, setFirst] = useState(user?.displayName?.split(' ')[0] ?? '');
  const [last, setLast] = useState(user?.displayName?.split(' ').slice(1).join(' ') ?? '');
  const [state, setState] = useState<{ pending: boolean; ok?: boolean; error?: string }>({ pending: false });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!NAME_PATTERN.test(first.trim()) || (last.trim() && !NAME_PATTERN.test(last.trim()))) {
      return setState({ pending: false, error: 'Names can only contain letters and spaces.' });
    }
    setState({ pending: true });
    try {
      unwrap(await api.PATCH('/api/users/edit', { body: { firstName: first.trim(), lastName: last.trim() || undefined } }));
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: [first.trim(), last.trim()].filter(Boolean).join(' ') });
        await auth.currentUser.reload();
      }
      setState({ pending: false, ok: true });
    } catch (err) {
      setState({ pending: false, error: (err as Error).message });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="profile-first">First name</FieldLabel>
          <Input id="profile-first" autoComplete="given-name" autoCapitalize="words" value={first} onChange={(e) => setFirst(e.target.value)} className="h-11 sm:h-10" />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-last">Last name</FieldLabel>
          <Input id="profile-last" autoComplete="family-name" autoCapitalize="words" value={last} onChange={(e) => setLast(e.target.value)} className="h-11 sm:h-10" />
        </Field>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={state.pending || !first.trim()}>
          {state.pending && <Spinner />}
          Save name
        </Button>
        {state.ok && <Status kind="ok">Saved</Status>}
        {state.error && <Status kind="error">{state.error}</Status>}
      </div>
    </form>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<{ pending: boolean; ok?: boolean; error?: string }>({ pending: false });
  const valid = PASSWORD_RULES.every((r) => r.test(password)) && password === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setState({ pending: true });
    try {
      unwrap(await api.PATCH('/api/auth/change-password', { body: { newPassword: password, newPasswordConfirm: confirm } }));
      setPassword('');
      setConfirm('');
      setState({ pending: false, ok: true });
    } catch (err) {
      setState({ pending: false, error: (err as Error).message });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="new-password">New password</FieldLabel>
        <PasswordInput id="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field data-invalid={confirm && password !== confirm ? true : undefined}>
        <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
        <PasswordInput id="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={confirm && password !== confirm ? true : undefined} />
        {confirm && password !== confirm && <FieldError>Passwords don’t match.</FieldError>}
      </Field>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((r) => (
          <li key={r.label} className={cn('text-xs', r.test(password) ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
            {r.test(password) ? '✓' : '·'} {r.label}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!valid || state.pending}>
          {state.pending && <Spinner />}
          Update password
        </Button>
        {state.ok && <Status kind="ok">Password updated</Status>}
        {state.error && <Status kind="error">{state.error}</Status>}
      </div>
    </form>
  );
}
