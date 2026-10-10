import { ApiError } from '@vibe/api';
import { Loader2Icon, ShieldCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useAllUsers, useMakeAdmin } from './queries';

function Status({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={cn('text-sm', kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
      {children}
    </p>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function UsersPage() {
  const users = useAllUsers();
  const makeAdmin = useMakeAdmin();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-aleo text-3xl tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every account in the system. Promote someone to admin here - there's no way to demote one yet.</p>

      <div className="mt-6">
        {users.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {users.isError && <Status kind="error">{errorMessage(users.error)}</Status>}
        {users.data && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u._id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2">
                      {u.firstName} {u.lastName ?? ''}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2">
                      {u.roles === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <ShieldCheckIcon className="size-3.5" aria-hidden /> Admin
                        </span>
                      ) : (
                        'User'
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {u.roles !== 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={makeAdmin.isPending}
                          onClick={() => makeAdmin.mutate(u._id)}
                        >
                          {makeAdmin.isPending && makeAdmin.variables === u._id ? <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> : null}
                          Make admin
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {makeAdmin.isError && <Status kind="error">{errorMessage(makeAdmin.error)}</Status>}
      </div>
    </div>
  );
}
