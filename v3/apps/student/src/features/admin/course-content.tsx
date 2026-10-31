import {
  BookOpenTextIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FolderKanbanIcon,
  LayersIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  VideoIcon,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useCourseVersion, useSectionItems, type CourseModule, type CourseSection } from '@/features/courses/queries';
import { cn } from '@/lib/utils';

import {
  useCreateModule,
  useCreateSection,
  useDeleteItem,
  useDeleteModule,
  useDeleteSection,
  useUpdateModule,
  useUpdateSection,
} from './queries';
import { ClampedText, ConfirmDialog, ErrorText } from './studio-ui';

export const ITEM_TYPES: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  VIDEO: { label: 'Video', icon: VideoIcon, tone: 'bg-blush text-blush-foreground' },
  QUIZ: { label: 'Quiz', icon: ClipboardCheckIcon, tone: 'bg-secondary text-secondary-foreground' },
  BLOG: { label: 'Reading', icon: BookOpenTextIcon, tone: 'bg-muted text-foreground/80' },
  PROJECT: { label: 'Project', icon: FolderKanbanIcon, tone: 'bg-muted text-foreground/80' },
  FEEDBACK: { label: 'Feedback', icon: MessageSquareTextIcon, tone: 'bg-muted text-foreground/80' },
  REFLECTION: { label: 'Reflection', icon: SparklesIcon, tone: 'bg-muted text-foreground/80' },
  CASE_STUDY: { label: 'Case study', icon: LayersIcon, tone: 'bg-muted text-foreground/80' },
};

function itemType(type: string) {
  return ITEM_TYPES[type] ?? { label: type.toLowerCase(), icon: FileTextIcon, tone: 'bg-muted text-foreground/80' };
}

function ordered<T extends { order: string; isDeleted?: boolean }>(list: T[]) {
  return list.filter((x) => !x.isDeleted).sort((a, b) => a.order.localeCompare(b.order));
}

type Ids = { courseId: string; versionId: string };

/** Uxcel-style course outline: numbered modules, their sections, and each section's lessons. */
export function CourseContent({ courseId, versionId }: Ids) {
  const version = useCourseVersion(versionId);
  const [moduleDialog, setModuleDialog] = useState(false);

  if (version.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }
  if (version.isError) return <ErrorText error={version.error} />;

  const modules = ordered(version.data.modules);
  const counts = Object.entries(version.data.itemCounts ?? {}).filter(([, n]) => (n ?? 0) > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {modules.length} {modules.length === 1 ? 'module' : 'modules'}
          </span>
          {counts.map(([type, n]) => {
            const t = itemType(type);
            return (
              <span key={type} className="inline-flex items-center gap-1">
                · <t.icon className="size-3.5" aria-hidden /> {n} {t.label.toLowerCase()}
              </span>
            );
          })}
        </div>
        <Button onClick={() => setModuleDialog(true)}>
          <PlusIcon aria-hidden /> Add module
        </Button>
      </div>

      {modules.length === 0 ? (
        <Empty className="mt-4 rounded-2xl border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayersIcon />
            </EmptyMedia>
            <EmptyTitle>No content yet</EmptyTitle>
            <EmptyDescription>Courses are made of modules, modules of sections, and sections of lessons. Start with a module.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setModuleDialog(true)}>Add module</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ol className="mt-4 grid gap-4 [&>*]:min-w-0">
          {modules.map((m, i) => (
            <li key={m.moduleId}>
              <ModuleBlock courseId={courseId} versionId={versionId} module={m} index={i} />
            </li>
          ))}
        </ol>
      )}

      <NameDialog
        open={moduleDialog}
        onOpenChange={setModuleDialog}
        title="New module"
        description="A module is a chapter of the course, e.g. “Getting started”."
        kind="module"
        create={(name, description) => ({ versionId, name, description })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module / section blocks
// ---------------------------------------------------------------------------

function ModuleBlock({ courseId, versionId, module, index }: Ids & { module: CourseModule; index: number }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteModule = useDeleteModule();
  const sections = ordered(module.sections);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <CollapsibleTrigger
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={open ? `Collapse ${module.name}` : `Expand ${module.name}`}
        >
          <ChevronDownIcon className={cn('size-4 transition-transform', !open && '-rotate-90')} aria-hidden />
        </CollapsibleTrigger>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
            Module {String(index + 1).padStart(2, '0')}
            {module.isHidden && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-muted-foreground normal-case">Hidden</span>}
          </p>
          <h3 className="mt-0.5 font-aleo text-lg leading-snug break-words">{module.name}</h3>
          {/* Two lines, then "Show more" (tap, so it works on phones). */}
          {module.description && <ClampedText className="mt-0.5">{module.description}</ClampedText>}
        </div>
        <RowMenu
          label={`Module ${module.name}`}
          onEdit={() => setEditing(true)}
          onAdd={{ label: 'Add section', run: () => setAddingSection(true) }}
          onDelete={() => setDeleting(true)}
        />
      </div>

      <CollapsibleContent>
        <div className="grid gap-3 border-t border-border bg-background/60 p-3 sm:p-4 [&>*]:min-w-0">
          {sections.length === 0 && <p className="px-1 text-sm text-muted-foreground">No sections yet.</p>}
          {sections.map((s, si) => (
            <SectionBlock key={s.sectionId} courseId={courseId} versionId={versionId} moduleId={module.moduleId} section={s} label={`${index + 1}.${si + 1}`} />
          ))}
          <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => setAddingSection(true)}>
            <PlusIcon aria-hidden /> Add section
          </Button>
        </div>
      </CollapsibleContent>

      <NameDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit module"
        kind="module"
        initial={{ name: module.name, description: module.description ?? '' }}
        update={(name, description) => ({ versionId, moduleId: module.moduleId, name, description })}
      />
      <NameDialog
        open={addingSection}
        onOpenChange={setAddingSection}
        title="New section"
        description={`Sections group lessons inside “${module.name}”.`}
        kind="section"
        create={(name, description) => ({ versionId, moduleId: module.moduleId, name, description })}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${module.name}”?`}
        description="This removes the module with all its sections and lessons. Students lose access to them."
        confirmLabel="Delete module"
        onConfirm={() => deleteModule.mutateAsync({ versionId, moduleId: module.moduleId })}
      />
    </Collapsible>
  );
}

function SectionBlock({ courseId, versionId, moduleId, section, label }: Ids & { moduleId: string; section: CourseSection; label: string }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteSection = useDeleteSection();
  const itemsGroupId = (section as unknown as { itemsGroupId?: string }).itemsGroupId ?? '';

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{label}</span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {section.name}
          {section.isHidden && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">Hidden</span>}
        </p>
        <RowMenu label={`Section ${section.name}`} onEdit={() => setEditing(true)} onDelete={() => setDeleting(true)} />
      </div>
      <ItemRows courseId={courseId} versionId={versionId} moduleId={moduleId} sectionId={section.sectionId} itemsGroupId={itemsGroupId} />
      <div className="border-t border-border px-2 py-1.5">
        <AddLessonMenu courseId={courseId} versionId={versionId} moduleId={moduleId} sectionId={section.sectionId} />
      </div>

      <NameDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit section"
        kind="section"
        initial={{ name: section.name, description: section.description ?? '' }}
        update={(name, description) => ({ versionId, moduleId, sectionId: section.sectionId, name, description })}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${section.name}”?`}
        description="This removes the section and all its lessons."
        confirmLabel="Delete section"
        onConfirm={() => deleteSection.mutateAsync({ versionId, moduleId, sectionId: section.sectionId })}
      />
    </div>
  );
}

function ItemRows({ courseId, versionId, moduleId, sectionId, itemsGroupId }: Ids & { moduleId: string; sectionId: string; itemsGroupId: string }) {
  const items = useSectionItems(versionId, moduleId, sectionId);
  const deleteItem = useDeleteItem();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  if (items.isPending) return <div className="border-t border-border px-3.5 py-3"><Skeleton className="h-5 w-1/2" /></div>;
  if (items.isError) return <ErrorText error={items.error} className="border-t border-border px-3.5 py-3" />;
  if (items.data.length === 0) return <p className="border-t border-border px-3.5 py-3 text-sm text-muted-foreground">No lessons yet.</p>;

  return (
    <>
      <ul className="divide-y divide-border border-t border-border">
        {[...items.data].sort((a, b) => a.order.localeCompare(b.order)).map((item) => {
          const t = itemType(item.type);
          const editable = EDITABLE.includes(item.type);
          const open = () =>
            void navigate({ to: '/admin/courses/$courseId/$versionId/lesson', params: { courseId, versionId }, search: { module: moduleId, section: sectionId, item: item._id } });
          return (
            <li key={item._id} className="group flex items-center gap-3 px-3.5 py-2 transition-colors hover:bg-muted/40">
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-md', t.tone)}>
                <t.icon className="size-3.5" aria-hidden />
              </span>
              {editable ? (
                <button type="button" onClick={open} className="min-w-0 flex-1 truncate text-left text-sm hover:underline hover:underline-offset-4">
                  {item.name}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
              )}
              <span className="hidden text-xs text-muted-foreground sm:inline">{t.label}</span>
              {item.isOptional && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Optional</span>}
              <RowMenu
                label={`Lesson ${item.name}`}
                onEdit={editable ? open : undefined}
                onDelete={itemsGroupId ? () => setDeleting({ id: item._id, name: item.name }) : undefined}
              />
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="Students lose this lesson and any progress on it."
        confirmLabel="Delete lesson"
        onConfirm={() => deleteItem.mutateAsync({ courseId, itemsGroupId, itemId: deleting!.id, versionId })}
      />
    </>
  );
}

/** Lesson types the studio editors handle. */
const EDITABLE = ['VIDEO', 'BLOG', 'QUIZ', 'FEEDBACK'];

function AddLessonMenu({ courseId, versionId, moduleId, sectionId }: Ids & { moduleId: string; sectionId: string }) {
  const navigate = useNavigate();
  const go = (type: 'VIDEO' | 'BLOG' | 'QUIZ' | 'FEEDBACK') =>
    void navigate({ to: '/admin/courses/$courseId/$versionId/lesson', params: { courseId, versionId }, search: { module: moduleId, section: sectionId, type } });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <PlusIcon aria-hidden /> Add lesson
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {(
          [
            ['VIDEO', 'A YouTube video, or a clip of one'],
            ['BLOG', 'Text with headings, images and links'],
            ['QUIZ', 'Questions to check understanding'],
            ['FEEDBACK', 'A short form about the lesson before it'],
          ] as const
        ).map(([type, help]) => {
          const t = itemType(type);
          return (
            <DropdownMenuItem key={type} onClick={() => go(type)} className="items-start gap-3 py-2">
              <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-md', t.tone)}>
                <t.icon className="size-3.5" />
              </span>
              <span>
                <span className="block font-medium">{t.label === 'Reading' ? 'Article' : t.label}</span>
                <span className="block text-xs text-muted-foreground">{help}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowMenu({
  label,
  onEdit,
  onAdd,
  onDelete,
}: {
  label: string;
  onEdit?: () => void;
  onAdd?: { label: string; run: () => void };
  onDelete?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`${label}: actions`} className="shrink-0 text-muted-foreground" />}>
        <MoreHorizontalIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon /> Edit
          </DropdownMenuItem>
        )}
        {onAdd && (
          <DropdownMenuItem onClick={onAdd.run}>
            <PlusIcon /> {onAdd.label}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            {(onEdit || onAdd) && <DropdownMenuSeparator />}
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <TrashIcon /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

type ModuleArgs = { versionId: string; name: string; description: string };
type ModuleUpdateArgs = ModuleArgs & { moduleId: string };
type SectionArgs = ModuleUpdateArgs;
type SectionUpdateArgs = SectionArgs & { sectionId: string };

/** Create or rename a module/section (both are just a name and a description). */
function NameDialog(
  props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    initial?: { name: string; description: string };
  } & (
    | { kind: 'module'; create: (name: string, description: string) => ModuleArgs; update?: never }
    | { kind: 'module'; update: (name: string, description: string) => ModuleUpdateArgs; create?: never }
    | { kind: 'section'; create: (name: string, description: string) => SectionArgs; update?: never }
    | { kind: 'section'; update: (name: string, description: string) => SectionUpdateArgs; create?: never }
  ),
) {
  const createModule = useCreateModule();
  const updateModule = useUpdateModule();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const [name, setName] = useState(props.initial?.name ?? '');
  const [description, setDescription] = useState(props.initial?.description ?? '');

  const mutation =
    props.kind === 'module' ? (props.create ? createModule : updateModule) : props.create ? createSection : updateSection;

  function close(next: boolean) {
    props.onOpenChange(next);
    if (!next) {
      setName(props.initial?.name ?? '');
      setDescription(props.initial?.description ?? '');
      mutation.reset();
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (props.kind === 'module') {
      if (props.create) await createModule.mutateAsync(props.create(name, description));
      else await updateModule.mutateAsync(props.update(name, description));
    } else if (props.create) await createSection.mutateAsync(props.create(name, description));
    else await updateSection.mutateAsync(props.update(name, description));
    close(false);
  }

  const id = `${props.kind}-${props.create ? 'new' : 'edit'}`;
  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description && <DialogDescription>{props.description}</DialogDescription>}
        </DialogHeader>
        <form id={id} onSubmit={(e) => void onSubmit(e).catch(() => undefined)} className="grid gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
            <Textarea id={`${id}-description`} value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} />
          </Field>
          {mutation.isError && <ErrorText error={mutation.error} />}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" form={id} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="size-4" />}
            {props.create ? 'Add' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
