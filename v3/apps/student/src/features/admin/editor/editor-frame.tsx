import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon, EyeIcon, PencilLineIcon, SettingsIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { ThemeButton } from '../admin-shell';

export type SaveState = 'new' | 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

const STATUS: Record<SaveState, { label: string; dot: string }> = {
  new: { label: 'Draft', dot: 'bg-muted-foreground/50' },
  clean: { label: 'Published', dot: 'bg-emerald-500' },
  dirty: { label: 'Unsaved changes', dot: 'bg-amber-500' },
  saving: { label: 'Saving…', dot: 'bg-amber-500 animate-pulse' },
  saved: { label: 'Saved', dot: 'bg-emerald-500' },
  error: { label: 'Not saved', dot: 'bg-destructive' },
};

/**
 * Substack-style editor chrome: a slim top bar (back, save status, preview,
 * settings, save) over a centred writing column.
 */
export function EditorFrame({
  courseId,
  versionId,
  kind,
  state,
  onSave,
  saveLabel,
  canSave = true,
  preview,
  onPreviewChange,
  onOpenSettings,
  children,
  wide,
}: {
  courseId: string;
  versionId: string;
  kind: string;
  state: SaveState;
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

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (state !== 'dirty' && state !== 'error' && state !== 'new') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur [box-sizing:content-box] sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to course content"
          nativeButton={false}
          render={<Link to="/admin/courses/$courseId/$versionId" params={{ courseId, versionId }} search={{ tab: 'content' }} />}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <span className="hidden text-sm text-muted-foreground sm:inline">{kind}</span>
        <span role="status" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
          <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden />
          {status.label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeButton />
          {onOpenSettings && (
            <Button variant="ghost" size="icon" aria-label="Lesson settings" onClick={onOpenSettings}>
              <SettingsIcon aria-hidden />
            </Button>
          )}
          {onPreviewChange && (
            <Button variant="secondary" onClick={() => onPreviewChange(!preview)}>
              {preview ? <PencilLineIcon aria-hidden /> : <EyeIcon aria-hidden />}
              {preview ? 'Edit' : 'Preview'}
            </Button>
          )}
          <Button onClick={onSave} disabled={!canSave || state === 'saving'}>
            {state === 'saving' && <Spinner className="size-4" />}
            {saveLabel}
          </Button>
        </div>
      </header>
      <main className={cn('mx-auto w-full px-5 pt-10 pb-32 sm:px-8', wide ? 'max-w-3xl' : 'max-w-[44rem]')}>{children}</main>
    </div>
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

function AutoGrowTextarea({ value, onChange, className, ...rest }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; 'aria-label': string }) {
  return (
    <textarea
      {...rest}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      className={cn('field-sizing-content w-full resize-none border-0 bg-transparent p-0 outline-none focus-visible:ring-0', className)}
    />
  );
}
