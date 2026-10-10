import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, BookOpenIcon, LogOutIcon, MoonIcon, SunIcon, UserIcon, UsersIcon } from 'lucide-react';

import { GeneratedAvatar } from '@/components/generated-art';
import { useTheme } from '@/components/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/auth-provider';
import { Wordmark } from '@/features/landing/wordmark';

const NAV = [
  { label: 'Courses', to: '/admin' as const, icon: BookOpenIcon },
  { label: 'Users', to: '/admin/users' as const, icon: UsersIcon },
];

/** Separate chrome from the student AppShell - admin's own nav, not Home/My courses/Profile. */
export function AdminShell() {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside aria-label="Admin sidebar" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-muted/40 md:flex">
        <div className="flex h-14 items-center px-4">
          <Link to="/admin" aria-label="Admin home">
            <Wordmark />
          </Link>
        </div>
        <p className="px-4.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Admin</p>
        <nav aria-label="Admin" className="flex flex-col gap-0.5 p-2">
          {NAV.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: 'bg-background font-medium text-foreground shadow-xs ring-1 ring-border' }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-2">
          <Link
            to="/home"
            className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4 shrink-0" aria-hidden />
            Exit to student app
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md [box-sizing:content-box] sm:px-6">
          <Link to="/admin" aria-label="Admin home" className="md:hidden">
            <Wordmark />
          </Link>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary md:ml-0">Admin</span>
          <div className="ml-auto">
            <AdminAccountMenu />
          </div>
        </header>
        <main className="relative flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminAccountMenu() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    await navigate({ to: '/login', replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="grid size-9 place-items-center rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'admin'} size={36} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex flex-col items-center gap-1 px-3 py-3 text-center">
          <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'admin'} size={44} />
          {user?.displayName && <span className="text-sm font-medium">{user.displayName}</span>}
          <span className="max-w-full truncate text-xs text-muted-foreground">{user?.email}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
          <UserIcon /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
