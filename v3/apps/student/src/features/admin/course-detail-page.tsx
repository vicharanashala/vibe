import { Link } from '@tanstack/react-router';
import { ApiError } from '@vibe/api';
import {
  ArrowLeftIcon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  TrashIcon,
  VideoIcon,
  XIcon,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useCourseVersion, useSectionItems, type CourseModule, type CourseSection } from '@/features/courses/queries';
import { useCourseSettings } from '@/features/learn/queries';
import { cn } from '@/lib/utils';

import {
  useCourse,
  useCourseEnrollments,
  useCreateItem,
  useCreateModule,
  useCreateSection,
  useDeleteItem,
  useDeleteModule,
  useDeleteSection,
  useInviteUser,
  useItemDetail,
  useUpdateCourseSettings,
  useUpdateItem,
  useUpdateModule,
  useUpdateSection,
  type NewItemInput,
} from './queries';

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

const ITEM_ICON: Record<string, typeof VideoIcon> = { VIDEO: VideoIcon, QUIZ: FileTextIcon };

/** Mirrors the backend's ProctoringComponent enum order exactly (ISettingRepository.ts). */
const DETECTORS = [
  { key: 'cameraMic', label: 'Camera + microphone', implemented: true },
  { key: 'blurDetection', label: 'Blur detection', implemented: true },
  { key: 'faceCountDetection', label: 'Face count', implemented: true },
  { key: 'handGestureDetection', label: 'Hand gesture', implemented: true },
  { key: 'voiceDetection', label: 'Voice detection', implemented: true },
  { key: 'virtualBackgroundDetection', label: 'Virtual background', implemented: false },
  { key: 'rightClickDisabled', label: 'Right-click disabled', implemented: true },
  { key: 'faceRecognition', label: 'Face recognition', implemented: true },
] as const;

export function CourseDetailPage({ courseId, versionId }: { courseId: string; versionId: string }) {
  const course = useCourse(courseId);
  const version = useCourseVersion(versionId);
  const [addingModule, setAddingModule] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All courses
      </Link>

      <h1 className="mt-3 font-aleo text-3xl tracking-tight">{course.data?.name ?? '…'}</h1>
      {course.data?.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{course.data.description}</p>}

      <section className="mt-8 border-b border-border pb-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Content</h2>
          {version.data?.itemCounts && (
            <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.entries(version.data.itemCounts).map(([type, count]) => {
                const Icon = ITEM_ICON[type] ?? FileTextIcon;
                return (
                  <span key={type} className="inline-flex items-center gap-1">
                    <Icon className="size-3.5" aria-hidden /> {count} {type.toLowerCase()}
                  </span>
                );
              })}
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-4">
          {version.isPending && <Spinner className="text-muted-foreground" />}
          {version.isError && <Status kind="error">{errorMessage(version.error)}</Status>}
          {version.data?.modules.map((module, mi) => (
            <ModuleCard key={module.moduleId} versionId={versionId} courseId={courseId} module={module} index={mi} />
          ))}
          {version.data && version.data.modules.length === 0 && <p className="text-sm text-muted-foreground">No modules yet.</p>}
        </div>

        <div className="mt-4">
          {addingModule ? (
            <NewModuleForm versionId={versionId} onDone={() => setAddingModule(false)} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddingModule(true)}>
              <PlusIcon className="size-4" aria-hidden /> Add module
            </Button>
          )}
        </div>
      </section>

      <section className="mt-8 border-b border-border pb-8">
        <h2 className="font-semibold">Proctoring</h2>
        <div className="mt-4 max-w-sm">
          <ProctoringSection courseId={courseId} versionId={versionId} />
        </div>
      </section>

      <section className="mt-8 border-b border-border pb-8">
        <h2 className="font-semibold">Enrollments</h2>
        <div className="mt-4">
          <EnrollmentsTable courseId={courseId} versionId={versionId} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Invite someone</h2>
        <div className="mt-4 max-w-sm">
          <InviteUserForm courseId={courseId} versionId={versionId} />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

function NewModuleForm({ versionId, onDone }: { versionId: string; onDone: () => void }) {
  const createModule = useCreateModule();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createModule.mutate({ versionId, name, description }, { onSuccess: onDone });
  }

  return (
    <Card size="sm" className="max-w-md gap-0 p-4">
      <form onSubmit={onSubmit} className="grid gap-2">
        <Input placeholder="Module name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={createModule.isPending}>
            {createModule.isPending ? <Spinner className="size-4" /> : null}
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
        {createModule.isError && <Status kind="error">{errorMessage(createModule.error)}</Status>}
      </form>
    </Card>
  );
}

function ModuleCard({ versionId, courseId, module, index }: { versionId: string; courseId: string; module: CourseModule; index: number }) {
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(module.name);
  const [description, setDescription] = useState(module.description ?? '');
  const [addingSection, setAddingSection] = useState(false);

  function onSave(e: FormEvent) {
    e.preventDefault();
    updateModule.mutate({ versionId, moduleId: module.moduleId, name, description }, { onSuccess: () => setEditing(false) });
  }

  return (
    <Card size="sm" className="gap-0 p-4">
      {editing ? (
        <form onSubmit={onSave} className="grid gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={updateModule.isPending}>
              {updateModule.isPending ? <Spinner className="size-4" /> : null}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          {updateModule.isError && <Status kind="error">{errorMessage(updateModule.error)}</Status>}
        </form>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {index + 1}. {module.name}
            </p>
            {module.description && <p className="mt-0.5 text-xs text-muted-foreground">{module.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" aria-label="Edit module" onClick={() => setEditing(true)}>
              <PencilIcon className="size-3.5" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Delete module"
              disabled={deleteModule.isPending}
              onClick={() => deleteModule.mutate({ versionId, moduleId: module.moduleId })}
            >
              {deleteModule.isPending ? <Spinner className="size-3.5" /> : <TrashIcon className="size-3.5" aria-hidden />}
            </Button>
          </div>
        </div>
      )}
      {deleteModule.isError && <Status kind="error">{errorMessage(deleteModule.error)}</Status>}

      <div className="mt-3 ml-4 grid gap-2 border-l border-border pl-4">
        {module.sections.map((section, si) => (
          <SectionCard
            key={section.sectionId}
            versionId={versionId}
            courseId={courseId}
            moduleId={module.moduleId}
            section={section}
            label={`${index + 1}.${si + 1}`}
          />
        ))}
        {addingSection ? (
          <NewSectionForm versionId={versionId} moduleId={module.moduleId} onDone={() => setAddingSection(false)} />
        ) : (
          <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => setAddingSection(true)}>
            <PlusIcon className="size-3.5" aria-hidden /> Add section
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function NewSectionForm({ versionId, moduleId, onDone }: { versionId: string; moduleId: string; onDone: () => void }) {
  const createSection = useCreateSection();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    createSection.mutate({ versionId, moduleId, name, description }, { onSuccess: onDone });
  }

  return (
    <Card size="sm" className="gap-0 p-3">
      <form onSubmit={onSubmit} className="grid gap-2">
        <Input placeholder="Section name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={createSection.isPending}>
            {createSection.isPending ? <Spinner className="size-4" /> : null}
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
        {createSection.isError && <Status kind="error">{errorMessage(createSection.error)}</Status>}
      </form>
    </Card>
  );
}

function SectionCard({
  versionId,
  courseId,
  moduleId,
  section,
  label,
}: {
  versionId: string;
  courseId: string;
  moduleId: string;
  section: CourseSection;
  label: string;
}) {
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [description, setDescription] = useState(section.description ?? '');
  const [addingItem, setAddingItem] = useState(false);
  const itemsGroupId = (section as unknown as { itemsGroupId?: string }).itemsGroupId ?? '';

  function onSave(e: FormEvent) {
    e.preventDefault();
    updateSection.mutate({ versionId, moduleId, sectionId: section.sectionId, name, description }, { onSuccess: () => setEditing(false) });
  }

  return (
    <Card size="sm" className="gap-0 p-3">
      {editing ? (
        <form onSubmit={onSave} className="grid gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={updateSection.isPending}>
              {updateSection.isPending ? <Spinner className="size-4" /> : null}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          {updateSection.isError && <Status kind="error">{errorMessage(updateSection.error)}</Status>}
        </form>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-foreground/90">
            {label} {section.name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" aria-label="Edit section" onClick={() => setEditing(true)}>
              <PencilIcon className="size-3.5" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Delete section"
              disabled={deleteSection.isPending}
              onClick={() => deleteSection.mutate({ versionId, moduleId, sectionId: section.sectionId })}
            >
              {deleteSection.isPending ? <Spinner className="size-3.5" /> : <TrashIcon className="size-3.5" aria-hidden />}
            </Button>
          </div>
        </div>
      )}
      {deleteSection.isError && <Status kind="error">{errorMessage(deleteSection.error)}</Status>}

      <div className="mt-2 ml-4 grid gap-1.5 border-l border-border pl-3">
        <ItemList versionId={versionId} courseId={courseId} moduleId={moduleId} sectionId={section.sectionId} itemsGroupId={itemsGroupId} />
        {addingItem ? (
          <NewItemForm versionId={versionId} moduleId={moduleId} sectionId={section.sectionId} onDone={() => setAddingItem(false)} />
        ) : (
          <Button variant="ghost" size="sm" className="justify-start text-xs text-muted-foreground" onClick={() => setAddingItem(true)}>
            <PlusIcon className="size-3" aria-hidden /> Add item
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function ItemList({
  versionId,
  courseId,
  moduleId,
  sectionId,
  itemsGroupId,
}: {
  versionId: string;
  courseId: string;
  moduleId: string;
  sectionId: string;
  itemsGroupId: string;
}) {
  const items = useSectionItems(versionId, moduleId, sectionId);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  if (items.isPending) return <p className="text-xs text-muted-foreground">Loading items…</p>;
  if (items.isError) return <Status kind="error">{errorMessage(items.error)}</Status>;
  if (items.data.length === 0) return <p className="text-xs text-muted-foreground">No items yet.</p>;

  return (
    <>
      {items.data.map((item) => {
        const Icon = ITEM_ICON[item.type] ?? FileTextIcon;
        return editingItemId === item._id ? (
          <EditItemForm
            key={item._id}
            courseId={courseId}
            versionId={versionId}
            moduleId={moduleId}
            sectionId={sectionId}
            itemId={item._id}
            onDone={() => setEditingItemId(null)}
          />
        ) : (
          <ItemRow
            key={item._id}
            name={item.name}
            Icon={Icon}
            onEdit={() => setEditingItemId(item._id)}
            courseId={courseId}
            itemsGroupId={itemsGroupId}
            itemId={item._id}
            versionId={versionId}
          />
        );
      })}
    </>
  );
}

function ItemRow({
  name,
  Icon,
  onEdit,
  courseId,
  itemsGroupId,
  itemId,
  versionId,
}: {
  name: string;
  Icon: typeof VideoIcon;
  onEdit: () => void;
  courseId: string;
  itemsGroupId: string;
  itemId: string;
  versionId: string;
}) {
  const deleteItem = useDeleteItem();
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{name}</span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" aria-label="Edit item" onClick={onEdit}>
          <PencilIcon className="size-3" aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Delete item"
          disabled={deleteItem.isPending || !itemsGroupId}
          onClick={() => deleteItem.mutate({ courseId, itemsGroupId, itemId, versionId })}
        >
          {deleteItem.isPending ? <Spinner className="size-3" /> : <TrashIcon className="size-3" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

function NewItemForm({
  versionId,
  moduleId,
  sectionId,
  onDone,
}: {
  versionId: string;
  moduleId: string;
  sectionId: string;
  onDone: () => void;
}) {
  const createItem = useCreateItem();
  const [type, setType] = useState<'VIDEO' | 'QUIZ'>('VIDEO');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [startTime, setStartTime] = useState('0:00');
  const [endTime, setEndTime] = useState('');
  const [points, setPoints] = useState(10);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input: NewItemInput = {
      versionId,
      moduleId,
      sectionId,
      name,
      description,
      type,
      ...(type === 'VIDEO' ? { videoDetails: { URL: url, startTime, endTime, points } } : {}),
    };
    createItem.mutate(input, { onSuccess: onDone });
  }

  return (
    <Card size="sm" className="gap-0 p-2.5">
      <form onSubmit={onSubmit} className="grid gap-1.5">
        <ToggleGroup aria-label="Item type" variant="outline" size="sm" value={[type]} onValueChange={(v: string[]) => v[0] && setType(v[0] as 'VIDEO' | 'QUIZ')}>
          {(['VIDEO', 'QUIZ'] as const).map((t) => (
            <ToggleGroupItem key={t} value={t} className="text-xs">
              {t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
        {type === 'VIDEO' && (
          <>
            <Input placeholder="YouTube URL" value={url} onChange={(e) => setUrl(e.target.value)} required />
            <div className="grid grid-cols-3 gap-1.5">
              <Input placeholder="Start (m:ss)" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              <Input placeholder="End (m:ss)" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              <Input type="number" placeholder="Points" value={points} onChange={(e) => setPoints(Number(e.target.value))} required />
            </div>
          </>
        )}
        {type === 'QUIZ' && <p className="text-xs text-muted-foreground">Creates an empty quiz shell - attach a question bank separately.</p>}
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={createItem.isPending}>
            {createItem.isPending ? <Spinner className="size-4" /> : null}
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
        {createItem.isError && <Status kind="error">{errorMessage(createItem.error)}</Status>}
      </form>
    </Card>
  );
}

function EditItemForm({
  courseId,
  versionId,
  moduleId,
  sectionId,
  itemId,
  onDone,
}: {
  courseId: string;
  versionId: string;
  moduleId: string;
  sectionId: string;
  itemId: string;
  onDone: () => void;
}) {
  const detail = useItemDetail(courseId, versionId, moduleId, sectionId, itemId);
  const updateItem = useUpdateItem();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [points, setPoints] = useState(0);
  const [loaded, setLoaded] = useState(false);

  if (detail.data && !loaded) {
    setName(detail.data.name);
    setDescription(detail.data.description);
    if (detail.data.type === 'VIDEO') {
      setUrl(detail.data.details?.URL ?? '');
      setStartTime(detail.data.details?.startTime ?? '');
      setEndTime(detail.data.details?.endTime ?? '');
      setPoints(detail.data.details?.points ?? 0);
    }
    setLoaded(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!detail.data) return;
    const details = detail.data.type === 'VIDEO' ? { ...detail.data.details, URL: url, startTime, endTime, points } : detail.data.details;
    updateItem.mutate({ courseId, versionId, itemId, name, description, type: detail.data.type, details }, { onSuccess: onDone });
  }

  if (detail.isPending) return <Spinner className="text-muted-foreground" />;
  if (detail.isError) return <Status kind="error">{errorMessage(detail.error)}</Status>;

  return (
    <Card size="sm" className="gap-0 p-2.5">
      <form onSubmit={onSubmit} className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{detail.data?.type}</span>
          <Button type="button" size="sm" variant="ghost" aria-label="Cancel" onClick={onDone}>
            <XIcon className="size-3.5" aria-hidden />
          </Button>
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
        {detail.data?.type === 'VIDEO' && (
          <>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} required />
            <div className="grid grid-cols-3 gap-1.5">
              <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              <Input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} required />
            </div>
          </>
        )}
        {detail.data?.type !== 'VIDEO' && <p className="text-xs text-muted-foreground">Only name/description are editable for this item type here.</p>}
        <Button type="submit" size="sm" disabled={updateItem.isPending}>
          {updateItem.isPending ? <Spinner className="size-4" /> : null}
          Save
        </Button>
        {updateItem.isError && <Status kind="error">{errorMessage(updateItem.error)}</Status>}
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Proctoring
// ---------------------------------------------------------------------------

function ProctoringSection({ courseId, versionId }: { courseId: string; versionId: string }) {
  const settings = useCourseSettings(courseId, versionId);
  const updateSettings = useUpdateCourseSettings(courseId, versionId);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  if (settings.data && !loaded) {
    const current = settings.data.settings.proctors?.detectors ?? [];
    setToggles(Object.fromEntries(DETECTORS.map((d) => [d.key, current.find((c) => c.detectorName === d.key)?.settings.enabled ?? false])));
    setLoaded(true);
  }

  function save() {
    if (!settings.data) return;
    const { proctors: _proctors, ...rest } = settings.data.settings;
    updateSettings.mutate({
      ...rest,
      linearProgressionEnabled: settings.data.settings.linearProgressionEnabled ?? false,
      seekForwardEnabled: settings.data.settings.seekForwardEnabled ?? false,
      detectors: DETECTORS.map((d) => ({ detectorName: d.key, settings: { enabled: toggles[d.key] ?? false } })),
    });
  }

  if (settings.isPending) return <Spinner className="text-muted-foreground" />;
  if (settings.isError) return <Status kind="error">{errorMessage(settings.error)}</Status>;

  return (
    <div className="grid gap-3">
      {DETECTORS.map((d) => (
        <Field key={d.key} orientation="horizontal" data-disabled={!d.implemented || undefined}>
          <Switch
            id={`detector-${d.key}`}
            checked={toggles[d.key] ?? false}
            disabled={!d.implemented}
            onCheckedChange={(c) => setToggles((prev) => ({ ...prev, [d.key]: c === true }))}
          />
          <FieldLabel htmlFor={`detector-${d.key}`} className="font-normal">
            {d.label}
            {!d.implemented && <span className="text-xs text-muted-foreground">(not implemented yet)</span>}
          </FieldLabel>
        </Field>
      ))}
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={updateSettings.isPending}>
          {updateSettings.isPending && <Spinner className="size-4" />}
          Save
        </Button>
        {updateSettings.isSuccess && <Status kind="ok">Saved.</Status>}
        {updateSettings.isError && <Status kind="error">{errorMessage(updateSettings.error)}</Status>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enrollments + invite (unchanged from before)
// ---------------------------------------------------------------------------

function EnrollmentsTable({ courseId, versionId }: { courseId: string; versionId: string }) {
  const enrollments = useCourseEnrollments(courseId, versionId);

  if (enrollments.isPending) return <Spinner className="text-muted-foreground" />;
  if (enrollments.isError) return <Status kind="error">{errorMessage(enrollments.error)}</Status>;
  if (enrollments.data.length === 0) return <p className="text-sm text-muted-foreground">No one is enrolled yet.</p>;

  return (
    <Card size="sm" className="gap-0 py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enrollments.data.map((e) => (
            <TableRow key={e.user._id}>
              <TableCell>
                {e.user.firstName} {e.user.lastName ?? ''}
              </TableCell>
              <TableCell className="text-muted-foreground">{e.user.email}</TableCell>
              <TableCell>{e.role}</TableCell>
              <TableCell className="text-muted-foreground">{e.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function InviteUserForm({ courseId, versionId }: { courseId: string; versionId: string }) {
  const invite = useInviteUser();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    invite.mutate({ courseId, versionId, email, role }, { onSuccess: () => setEmail('') });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <ToggleGroup aria-label="Invite as" variant="outline" size="sm" value={[role]} onValueChange={(v: string[]) => v[0] && setRole(v[0] as 'STUDENT' | 'INSTRUCTOR')}>
        {(['STUDENT', 'INSTRUCTOR'] as const).map((r) => (
          <ToggleGroupItem key={r} value={r} className="text-xs">
            {r}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex items-end gap-2">
        <Field className="flex-1 gap-1.5">
          <FieldLabel htmlFor="invite-email" className="text-xs">
            Email
          </FieldLabel>
          <Input id="invite-email" type="email" placeholder="student@vibe.local" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Button type="submit" variant="outline" disabled={invite.isPending}>
          {invite.isPending ? <Spinner className="size-4" /> : <SendIcon className="size-4" aria-hidden />}
          Invite
        </Button>
      </div>
      {invite.isSuccess && <Status kind="ok">Invited as {role.toLowerCase()}.</Status>}
      {invite.isError && <Status kind="error">{errorMessage(invite.error)}</Status>}
    </form>
  );
}
