import { Link, useBlocker } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  EyeIcon,
  PencilLineIcon,
  SettingsIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

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
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
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
 * Substack-style editor chrome: a collapsible outline of the module on the
 * left, a slim top bar (back, save status, preview, settings, save) and a
 * centred writing column. Leaving with unsaved changes asks first.
 */
export function EditorFrame({
  loc,
  itemId,
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
  const status = STATUS[state];
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  return (
    <SidebarProvider>
      <EditorOutline loc={loc} itemId={itemId} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur [box-sizing:content-box] sm:px-4">
          <SidebarTrigger aria-label="Toggle module outline" />
          <Separator
            orientation="vertical"
            className="mx-1 data-[orientation=vertical]:h-5"
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
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {kind}
          </span>
          <Badge
            variant="outline"
            role="status"
            className="gap-1.5 font-normal text-muted-foreground"
          >
            <span
              className={cn('size-1.5 rounded-full', status.dot)}
              aria-hidden
            />
            {status.label}
          </Badge>
          <div className="ml-auto flex items-center gap-1.5">
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
            <Button onClick={onSave} disabled={!canSave || state === 'saving'}>
              {state === 'saving' && <Spinner className="size-4" />}
              {saveLabel}
            </Button>
          </div>
        </header>
        <main
          className={cn(
            'mx-auto w-full px-5 pt-10 pb-32 sm:px-8',
            wide ? 'max-w-3xl' : 'max-w-[44rem]',
          )}
        >
          {children}
        </main>
      </SidebarInset>

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
    </SidebarProvider>
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
        className="font-aleo text-4xl leading-tight font-semibold tracking-tight placeholder:text-muted-foreground/45"
      />
      <AutoGrowTextarea
        aria-label="Subtitle"
        value={subtitle}
        onChange={onSubtitle}
        placeholder={subtitlePlaceholder}
        className="text-lg leading-7 text-muted-foreground placeholder:text-muted-foreground/45"
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
