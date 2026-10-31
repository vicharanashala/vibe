import { Link, useBlocker } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  EyeIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  SettingsIcon,
  SunIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useTheme } from '@/components/theme-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { ThemeButton } from '../admin-shell';
import { EditorOutline } from './editor-outline';
import type { LessonLocation } from './lesson-api';

export type SaveState =
  'new' | 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

const STATUS: Record<SaveState, { label: string; dot: string }> = {
  new: { label: 'Draft', dot: 'bg-muted-foreground/50' },
  clean: { label: 'Published', dot: 'bg-emerald-500' },
  dirty: { label: 'Unsaved changes', dot: 'bg-amber-500' },
  saving: { label: 'Saving…', dot: 'bg-amber-500 animate-pulse' },
  saved: { label: 'Saved', dot: 'bg-emerald-500' },
  error: { label: 'Not saved', dot: 'bg-destructive' },
};

/**
 * The editors' persistent layout: the module outline on the left (a sheet on
 * phones) and the editor on the right. It stays mounted while switching
 * lessons, so only the editor area shows loading, never the outline.
 */
export function EditorLayout({
  loc,
  itemId,
  children,
}: {
  loc: LessonLocation;
  itemId?: string;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <EditorOutline loc={loc} itemId={itemId} />
      <SidebarInset className="min-w-0 bg-background">{children}</SidebarInset>
    </SidebarProvider>
  );
}

function BarStart({
  loc,
  kind,
  status,
}: {
  loc: LessonLocation;
  kind: string;
  status?: { label: string; dot: string };
}) {
  return (
    <>
      <SidebarTrigger aria-label="Show module outline" />
      <Separator
        orientation="vertical"
        className="mx-0.5 data-[orientation=vertical]:h-5 data-[orientation=vertical]:self-center max-sm:hidden"
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Back to course content"
        nativeButton={false}
        render={
          <Link
            to="/admin/courses/$courseId/$versionId"
            params={{ courseId: loc.courseId, versionId: loc.versionId }}
            search={{ tab: 'content' }}
          />
        }
      >
        <ArrowLeftIcon aria-hidden />
      </Button>
      <span className="text-sm text-muted-foreground max-sm:hidden">
        {kind}
      </span>
      {status && (
        <Badge
          variant="outline"
          role="status"
          className="gap-1.5 font-normal text-muted-foreground"
        >
          <span
            className={cn('size-1.5 rounded-full', status.dot)}
            aria-hidden
          />
          <span className="max-[380px]:sr-only">{status.label}</span>
        </Badge>
      )}
    </>
  );
}

const BAR =
  'sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b border-border bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur [box-sizing:content-box] sm:gap-2 sm:px-4';

/**
 * Substack-style editor chrome: a slim top bar (outline, back, save status,
 * preview, settings, save) over a centred writing column. On phones the
 * secondary actions fold into a ⋯ menu. Leaving with unsaved changes asks first.
 */
export function EditorFrame({
  loc,
  kind,
  state,
  dirty,
  onSave,
  saveLabel,
  canSave = true,
  preview,
  onPreviewChange,
  onOpenSettings,
  children,
  wide,
}: {
  loc: LessonLocation;
  /** Kept for callers; the outline reads the current lesson from EditorLayout. */
  itemId?: string;
  kind: string;
  state: SaveState;
  /** Unsaved work: leaving the page asks first. */
  dirty: boolean;
  onSave: () => void;
  saveLabel: string;
  canSave?: boolean;
  preview?: boolean;
  onPreviewChange?: (preview: boolean) => void;
  onOpenSettings?: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  return (
    <>
      <header className={BAR}>
        <BarStart loc={loc} kind={kind} status={STATUS[state]} />
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 max-sm:hidden">
            <ThemeButton />
            {onOpenSettings && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Lesson settings"
                onClick={onOpenSettings}
              >
                <SettingsIcon aria-hidden />
              </Button>
            )}
            {onPreviewChange && (
              <Button
                variant="secondary"
                onClick={() => onPreviewChange(!preview)}
              >
                {preview ? (
                  <PencilLineIcon aria-hidden />
                ) : (
                  <EyeIcon aria-hidden />
                )}
                {preview ? 'Edit' : 'Preview'}
              </Button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="More actions"
                  className="sm:hidden"
                />
              }
            >
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onPreviewChange && (
                <DropdownMenuItem onClick={() => onPreviewChange(!preview)}>
                  {preview ? <PencilLineIcon /> : <EyeIcon />}{' '}
                  {preview ? 'Back to editing' : 'Preview'}
                </DropdownMenuItem>
              )}
              {onOpenSettings && (
                <DropdownMenuItem onClick={onOpenSettings}>
                  <SettingsIcon /> Lesson settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}{' '}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={onSave}
            disabled={!canSave || state === 'saving'}
            className="max-sm:rounded-full max-sm:px-4"
          >
            {state === 'saving' && <Spinner className="size-4" />}
            {saveLabel}
          </Button>
        </div>
      </header>
      <main
        className={cn(
          'mx-auto w-full px-4 pt-6 pb-32 sm:px-8 sm:pt-10',
          wide ? 'max-w-3xl' : 'max-w-[44rem]',
        )}
      >
        {children}
      </main>

      <AlertDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes to this lesson haven’t been saved and will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => blocker.proceed?.()}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** What the editor area shows while a lesson loads; the outline stays in place. */
export function EditorFrameSkeleton({
  loc,
  kind = 'Lesson',
}: {
  loc: LessonLocation;
  kind?: string;
}) {
  return (
    <>
      <header className={BAR}>
        <BarStart loc={loc} kind={kind} />
        <Skeleton className="ml-auto h-9 w-20 rounded-md" />
      </header>
      <main
        className="mx-auto grid w-full max-w-[44rem] gap-3 px-4 pt-6 sm:px-8 sm:pt-10"
        aria-busy="true"
        aria-label="Loading lesson"
      >
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="mt-4 h-64 rounded-2xl" />
      </main>
    </>
  );
}

/** Big serif title + quieter subtitle, written straight onto the page. */
export function TitleFields({
  title,
  onTitle,
  subtitle,
  onSubtitle,
  titlePlaceholder = 'Title',
  subtitlePlaceholder = 'Add a subtitle…',
}: {
  title: string;
  onTitle: (v: string) => void;
  subtitle: string;
  onSubtitle: (v: string) => void;
  titlePlaceholder?: string;
  subtitlePlaceholder?: string;
}) {
  return (
    <div className="grid gap-1">
      <AutoGrowTextarea
        aria-label="Title"
        value={title}
        onChange={onTitle}
        placeholder={titlePlaceholder}
        className="font-aleo text-3xl leading-tight font-semibold tracking-tight placeholder:text-muted-foreground/45 sm:text-4xl"
      />
      <AutoGrowTextarea
        aria-label="Subtitle"
        value={subtitle}
        onChange={onSubtitle}
        placeholder={subtitlePlaceholder}
        className="text-base leading-7 text-muted-foreground placeholder:text-muted-foreground/45 sm:text-lg"
      />
    </div>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  className,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  'aria-label': string;
}) {
  return (
    <textarea
      {...rest}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      className={cn(
        'field-sizing-content w-full resize-none border-0 bg-transparent p-0 outline-none focus-visible:ring-0',
        className,
      )}
    />
  );
}
