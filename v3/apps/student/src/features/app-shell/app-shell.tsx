import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  BookOpenIcon,
  HomeIcon,
  LogOutIcon,
  MoonIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { GeneratedAvatar } from '@/components/generated-art';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/auth-provider';
import { useCurrentUserProfile } from '@/features/admin/queries';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { Wordmark } from '@/features/landing/wordmark';
import { cn } from '@/lib/utils';

const NAV: { label: string; to: '/home' | '/courses' | '/profile'; icon: LucideIcon }[] = [
  { label: 'Home', to: '/home', icon: HomeIcon },
  { label: 'My courses', to: '/courses', icon: BookOpenIcon },
  { label: 'Profile', to: '/profile', icon: UserIcon },
];

const COLLAPSE_KEY = 'sidebar-collapsed';

/** Uxcel-style shell on shadcn Sidebar: collapses to icons (⌘/Ctrl+B), slim top bar, account menu. */
export function AppShell() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  function onOpenChange(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '0' : '1');
    } catch {
      // ignore
    }
  }

  return (
    <SidebarProvider open={open} onOpenChange={onOpenChange}>
      {/* Phones use the bottom tab bar instead. */}
      <Sidebar collapsible="icon" aria-label="Sidebar" className="max-md:hidden">
        <SidebarHeader className="h-14 justify-center">
          <Link to="/home" aria-label="ViBe home" className="flex items-center px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <span className="group-data-[collapsible=icon]:hidden">
              <Wordmark />
            </span>
            <span className="hidden size-8 place-items-center rounded-lg bg-primary font-aleo font-semibold text-primary-foreground group-data-[collapsible=icon]:grid">
              V
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Learn</SidebarGroupLabel>
            <SidebarNav />
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md [box-sizing:content-box] sm:px-6">
          <SidebarTrigger className="max-md:hidden" />
          <Link to="/home" aria-label="ViBe home" className="md:hidden">
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <AccountMenu />
          </div>
        </header>
        {/* Bottom padding keeps content clear of the phone tab bar. */}
        {/* SidebarInset is the <main> landmark; this is its scrollable content. */}
        <div id="main" className="relative flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {/* Soft Luma-style tint behind the top of every app page */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/8 to-transparent" />
          <div className="relative">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <TabBar />
    </SidebarProvider>
  );
}

function SidebarNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <SidebarMenu aria-label="App">
      {NAV.map(({ label, to, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton
            tooltip={label}
            isActive={pathname === to || (to === '/courses' && pathname.startsWith('/courses/'))}
            render={<Link to={to} />}
          >
            <Icon aria-hidden />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

/** Uxcel Go-style bottom tab bar on phones; the sidebar takes over from md up. */
function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
        {NAV.map(({ label, to, icon: Icon }) => {
          // "My courses" stays selected inside a course.
          const active = pathname === to || (to === '/courses' && pathname.startsWith('/courses/'));
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-primary/12')}>
                  <Icon className="size-5" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const profile = useCurrentUserProfile();
  const isAdmin = profile.data?.roles === 'admin';

  async function onSignOut() {
    await signOut();
    await navigate({ to: '/login', replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full p-0" aria-label="Account menu" />}>
        <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'student'} size={36} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex flex-col items-center gap-1 px-3 py-3 text-center">
          <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'student'} size={44} />
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
        {isAdmin && (
          <DropdownMenuItem onClick={() => navigate({ to: '/admin' })}>
            <ShieldIcon /> Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
