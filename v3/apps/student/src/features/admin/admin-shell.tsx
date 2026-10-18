import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  HomeIcon,
  LogOutIcon,
  MoonIcon,
  PlusIcon,
  ShieldAlertIcon,
  SunIcon,
  PaletteIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { AppearancePicker } from '@/components/appearance-picker';
import { GeneratedAvatar } from '@/components/generated-art';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/features/auth/auth-provider';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/features/notifications/notification-bell';

import { NewCourseDialog } from './new-course-dialog';
import { useCurrentUserProfile } from './queries';

type NavTo = '/admin' | '/admin/courses' | '/admin/users';

const NAV_GROUPS: {
  label?: string;
  items: { label: string; to: NavTo; icon: LucideIcon }[];
}[] = [
  { items: [{ label: 'Home', to: '/admin', icon: HomeIcon }] },
  {
    label: 'Content',
    items: [{ label: 'Courses', to: '/admin/courses', icon: BookOpenIcon }],
  },
  {
    label: 'People',
    items: [{ label: 'Users', to: '/admin/users', icon: UsersIcon }],
  },
];

/** Page name shown in the top bar, Substack-style. */
function titleFor(pathname: string) {
  if (pathname.startsWith('/admin/courses')) return 'Courses';
  if (pathname.startsWith('/admin/users')) return 'Users';
  return 'Home';
}

/**
 * Studio: the teacher/admin area. Its own chrome (Substack-like sidebar with a
 * "New course" call to action) and its own warm theme, applied by putting
 * `studio` on <html> while mounted so portalled menus and dialogs match.
 */
/** Admin check for every studio page: the sidebar shell and the full-screen editors. */
export function StudioGuard({
  children,
}: {
  children: (profile: { email: string }) => ReactNode;
}) {
  const profile = useCurrentUserProfile();

  if (profile.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (profile.isError || profile.data?.roles !== 'admin') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlertIcon />
            </EmptyMedia>
            <EmptyTitle className="font-aleo text-2xl">Admins only</EmptyTitle>
            <EmptyDescription>
              You need an admin account to use the studio.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/home" />}
          >
            <ArrowLeftIcon aria-hidden /> Back to learning
          </Button>
        </Empty>
      </div>
    );
  }

  return <>{children(profile.data)}</>;
}

/** Studio: the teacher/admin area, with a Substack-like sidebar and a "New course" call to action. */
export function AdminShell() {
  return (
    <StudioGuard>
      {(profile) => <StudioChrome email={profile.email} />}
    </StudioGuard>
  );
}

/** Full-screen studio pages (the lesson editors): admin check and theme, no sidebar. */
export function StudioEditorShell() {
  return <StudioGuard>{() => <Outlet />}</StudioGuard>;
}

function StudioChrome({ email }: { email: string }) {
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <SidebarProvider>
        <Sidebar aria-label="Studio sidebar">
          <SidebarHeader className="gap-3 p-3">
            <Link
              to="/admin"
              aria-label="Studio home"
              className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-card px-2.5 py-2 shadow-xs"
            >
              <span className="grid size-7 place-items-center rounded-md bg-primary font-aleo text-sm font-semibold text-primary-foreground">
                V
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block font-aleo text-sm font-semibold">
                  ViBe Studio
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {email}
                </span>
              </span>
            </Link>
            <Button className="w-full" onClick={() => setNewCourseOpen(true)}>
              <PlusIcon aria-hidden /> New course
            </Button>
          </SidebarHeader>

          <SidebarContent>
            {NAV_GROUPS.map((group, i) => (
              <SidebarGroup key={group.label ?? i} className="py-1">
                {group.label && (
                  <SidebarGroupLabel className="text-[11px] tracking-wider uppercase">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <StudioNav items={group.items} pathname={pathname} />
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/home" />}
                  className="text-muted-foreground"
                >
                  <ArrowLeftIcon aria-hidden />
                  <span>Back to learning</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md [box-sizing:content-box] sm:px-6">
            <SidebarTrigger className="-ml-1.5 max-md:hidden" />
            <Link
              to="/admin"
              aria-label="Studio home"
              className="grid size-8 place-items-center rounded-lg bg-primary font-aleo text-sm font-semibold text-primary-foreground md:hidden"
            >
              V
            </Link>
            <span className="text-lg font-semibold tracking-tight">
              {titleFor(pathname)}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <ThemeButton className="max-sm:hidden" />
              <NotificationBell />
              <StudioAccountMenu />
            </div>
          </header>
          {/* Bottom padding keeps content clear of the phone tab bar. */}
          <div
            id="main"
            className="relative flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0"
          >
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <StudioTabBar
        pathname={pathname}
        onNewCourse={() => setNewCourseOpen(true)}
      />
      <NewCourseDialog open={newCourseOpen} onOpenChange={setNewCourseOpen} />
    </>
  );
}

/** Phones: Substack-style floating tab bar, with New course as the round primary action. */
function StudioTabBar({
  pathname,
  onNewCourse,
}: {
  pathname: string;
  onNewCourse: () => void;
}) {
  const items = NAV_GROUPS.flatMap((g) => g.items);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
      <nav
        aria-label="Studio"
        className="flex-1 rounded-full border border-border bg-background/90 p-1 shadow-lg backdrop-blur-md"
      >
        <ul className="grid grid-cols-3">
          {items.map(({ label, to, icon: Icon }) => {
            const active =
              to === '/admin'
                ? pathname === '/admin' || pathname === '/admin/'
                : pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors',
                    active
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon
                    className="size-5"
                    aria-hidden
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Button
        size="icon-lg"
        aria-label="New course"
        onClick={onNewCourse}
        className="size-14 shrink-0 rounded-full shadow-lg"
      >
        <PlusIcon className="size-6" aria-hidden />
      </Button>
    </div>
  );
}

function StudioNav({
  items,
  pathname,
}: {
  items: { label: string; to: NavTo; icon: LucideIcon }[];
  pathname: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map(({ label, to, icon: Icon }) => (
        <SidebarMenuItem key={to}>
          <SidebarMenuButton
            isActive={
              to === '/admin'
                ? pathname === '/admin' || pathname === '/admin/'
                : pathname.startsWith(to)
            }
            render={
              <Link to={to} onClick={() => isMobile && setOpenMobile(false)} />
            }
          >
            <Icon aria-hidden />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function ThemeButton({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      }
      onClick={toggleTheme}
      className={className}
    >
      {theme === 'dark' ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  );
}

function StudioAccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  async function onSignOut() {
    await signOut();
    await navigate({ to: '/login', replace: true });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="ml-1 grid size-9 place-items-center rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <GeneratedAvatar
            seed={user?.uid ?? user?.email ?? 'admin'}
            size={34}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <div className="flex flex-col items-center gap-1 px-3 py-3 text-center">
            <GeneratedAvatar
              seed={user?.uid ?? user?.email ?? 'admin'}
              size={44}
            />
            {user?.displayName && (
              <span className="text-sm font-medium">{user.displayName}</span>
            )}
            <span className="max-w-full truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: '/home' })}>
            <ArrowLeftIcon /> Back to learning
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
            <UserIcon /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAppearanceOpen(true)}>
            <PaletteIcon /> Appearance
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut}>
            <LogOutIcon /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Appearance</DialogTitle>
            <DialogDescription>
              Applies across ViBe on this device, in the studio and the student
              app.
            </DialogDescription>
          </DialogHeader>
          <AppearancePicker columns={3} />
          <DialogFooter>
            <Button onClick={() => setAppearanceOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
