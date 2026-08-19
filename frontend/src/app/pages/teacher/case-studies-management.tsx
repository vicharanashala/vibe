import {Fragment, useState} from 'react';
import {AlertTriangle, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, Video} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Badge} from '@/components/ui/badge';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {useCourseStore} from '@/store/course-store';
import {useCourseVersionById} from '@/hooks/hooks';
import {
  useInstructorCaseResponses,
  useMyCaseResponses,
  useCreateCase,
  useUpdateCase,
  useDeleteCase,
} from '@/hooks/case-study-hooks';
import type {
  CaseListEntry,
  CreateCaseBody,
  InstructorCaseGroup,
  InstructorResponseRow,
  UpdateCaseBody,
} from '@/lib/api/case-studies';
import CourseBackButton from './CourseBackButton';

interface VideoItem {
  itemId: string;
  name: string;
}

function extractVideoItems(versionData: any): VideoItem[] {
  const modules = (versionData as any)?.modules ?? (versionData as any)?.version?.modules ?? [];
  const items: VideoItem[] = [];
  for (const mod of modules) {
    for (const section of mod.sections ?? []) {
      for (const item of section.items ?? []) {
        if (item.type === 'VIDEO') {
          items.push({itemId: item._id, name: item.name ?? item.title ?? item._id});
        }
      }
    }
  }
  return items;
}

interface CaseFormValues {
  sequenceIndex: number;
  title: string;
  bodyMarkdown: string;
  linkedItemId: string;
}

const EMPTY_FORM: CaseFormValues = {sequenceIndex: 1, title: '', bodyMarkdown: '', linkedItemId: ''};

function CaseFormDialog({
  open,
  onClose,
  initialValues,
  onSubmit,
  isPending,
  videoItems,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  initialValues: CaseFormValues;
  onSubmit: (values: CaseFormValues) => void;
  isPending: boolean;
  videoItems: VideoItem[];
  mode: 'create' | 'edit';
}) {
  const [values, setValues] = useState<CaseFormValues>(initialValues);

  const set = (key: keyof CaseFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues(prev => ({...prev, [key]: key === 'sequenceIndex' ? Number(e.target.value) : e.target.value}));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.title.trim() || !values.bodyMarkdown.trim()) return;
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create case study' : 'Edit case study'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Sequence #</label>
            <Input
              type="number"
              min={1}
              value={values.sequenceIndex}
              onChange={set('sequenceIndex')}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={values.title}
              onChange={set('title')}
              placeholder="Case title"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Body (markdown)</label>
            <Textarea
              value={values.bodyMarkdown}
              onChange={set('bodyMarkdown')}
              placeholder="Describe the scenario…"
              rows={6}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Linked video</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={values.linkedItemId}
              onChange={set('linkedItemId')}
            >
              <option value="">— no video linked —</option>
              {videoItems.map(v => (
                <option key={v.itemId} value={v.itemId}>
                  {v.name}
                </option>
              ))}
            </select>
            {videoItems.length === 0 && (
              <p className="text-xs text-muted-foreground">No VIDEO items found in this course version.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !values.title.trim() || !values.bodyMarkdown.trim()}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  caseTitle,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  caseTitle: string;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete case study</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-medium text-foreground">"{caseTitle}"</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_LABEL: Record<InstructorResponseRow['status'], string> = {
  WON: 'Completed',
  OPEN: 'In review',
  WITHDRAWN: 'Withdrawn',
};

const STATUS_CLASS: Record<InstructorResponseRow['status'], string> = {
  WON: 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400',
  OPEN: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400',
  WITHDRAWN: 'border-destructive/50 text-destructive',
};

function ResponseDetail({row}: {row: InstructorResponseRow}) {
  const fields: Array<{label: string; value: string}> = [
    {label: 'What they thought going in', value: row.beat1a},
    {label: 'What challenged it', value: row.beat1b},
    {label: 'Where they landed', value: row.beat1c},
    {label: 'The strongest case against where they landed', value: row.steelman},
    {label: 'One perspective from the room', value: row.roomPerspective},
    {label: 'One thing they will change', value: row.changeCommitment},
  ];
  return (
    <tr>
      <td colSpan={6} className="bg-muted/30 px-4 py-3">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map(f => (
            <div key={f.label}>
              <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 text-sm">{f.value || <span className="text-muted-foreground">—</span>}</dd>
            </div>
          ))}
        </dl>
        {row.zoomSessionDate && (
          <p className="mt-2 text-xs text-muted-foreground">
            Zoom session date: <span className="font-medium text-foreground">{row.zoomSessionDate}</span>
          </p>
        )}
      </td>
    </tr>
  );
}

function CaseResponsesSection({group}: {group: InstructorCaseGroup}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/30 transition-colors"
      >
        <span>
          Case {group.sequenceIndex}: {group.title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({group.responses.length} {group.responses.length === 1 ? 'response' : 'responses'})
          </span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        group.responses.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground border-t">No responses yet.</p>
        ) : (
          <div className="border-t overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Student</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Zoom date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Wins / Streak</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {group.responses.map(row => (
                  <Fragment key={row.responseId}>
                    <tr className="bg-card hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{row.studentName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.studentEmail}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={STATUS_CLASS[row.status]}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.zoomSessionDate ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {row.winCount} / {row.weakStreak}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setExpandedId(id => id === row.responseId ? null : row.responseId)}
                        >
                          {expandedId === row.responseId ? 'Hide' : 'View'}
                        </Button>
                      </td>
                    </tr>
                    {expandedId === row.responseId && <ResponseDetail row={row} />}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function ResponsesTab({courseId, versionId}: {courseId: string; versionId: string}) {
  const ref = {courseId, versionId};
  const {cases, isLoading} = useInstructorCaseResponses(ref);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        No case studies found for this version.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cases
        .slice()
        .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
        .map(group => (
          <CaseResponsesSection key={group.caseStudyId} group={group} />
        ))}
    </div>
  );
}

export default function CaseStudiesManagement() {
  const {currentCourse} = useCourseStore();
  const courseId = currentCourse?.courseId ?? '';
  const versionId = currentCourse?.versionId ?? '';

  const ref = {courseId, versionId};

  const {cases, isLoading: casesLoading} = useMyCaseResponses(ref, Boolean(courseId && versionId));
  const {data: versionData} = useCourseVersionById(versionId, Boolean(versionId));
  const videoItems = versionData ? extractVideoItems(versionData) : [];

  const createCase = useCreateCase(ref);
  const updateCase = useUpdateCase(ref);
  const deleteCase = useDeleteCase(ref);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<CaseListEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CaseListEntry | null>(null);

  const videoNameById = new Map(videoItems.map(v => [v.itemId, v.name]));

  const handleCreate = async (values: CaseFormValues) => {
    const body: CreateCaseBody = {
      sequenceIndex: values.sequenceIndex,
      title: values.title.trim(),
      bodyMarkdown: values.bodyMarkdown.trim(),
      ...(values.linkedItemId ? {linkedItemId: values.linkedItemId} : {}),
    };
    await createCase.mutateAsync(body);
    setShowCreate(false);
  };

  const handleUpdate = async (values: CaseFormValues) => {
    if (!editTarget) return;
    const body: UpdateCaseBody = {
      sequenceIndex: values.sequenceIndex,
      title: values.title.trim(),
      bodyMarkdown: values.bodyMarkdown.trim(),
      ...(values.linkedItemId ? {linkedItemId: values.linkedItemId} : {}),
    };
    await updateCase.mutateAsync({caseStudyId: editTarget.caseStudyId, body});
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCase.mutateAsync(deleteTarget.caseStudyId);
    setDeleteTarget(null);
  };

  const nextSequenceIndex = cases.length > 0 ? Math.max(...cases.map(c => c.sequenceIndex)) + 1 : 1;

  if (!courseId || !versionId) {
    return (
      <div className="space-y-4 p-4">
        <CourseBackButton />
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Select a course version to manage its case studies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <CourseBackButton />

      <Tabs defaultValue="cases">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Case Studies</h1>
            <p className="text-sm text-muted-foreground">
              Manage cases and view student responses for this course version.
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="cases">Cases</TabsTrigger>
            <TabsTrigger value="responses">Responses</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cases" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add case
            </Button>
          </div>

          {casesLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : cases.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No case studies yet. Create the first one.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Linked video</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cases
                    .slice()
                    .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
                    .map(c => (
                      <tr key={c.caseStudyId} className="bg-card hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.sequenceIndex}</td>
                        <td className="px-4 py-3 font-medium">{c.title}</td>
                        <td className="px-4 py-3">
                          {c.linkedItemId ? (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Video className="h-3.5 w-3.5 shrink-0" />
                              {videoNameById.get(c.linkedItemId) ?? c.linkedItemId}
                            </span>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              No video linked
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditTarget(c)}
                              aria-label="Edit case"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(c)}
                              aria-label="Delete case"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="responses" className="mt-4">
          <ResponsesTab courseId={courseId} versionId={versionId} />
        </TabsContent>
      </Tabs>

      <CaseFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        initialValues={{...EMPTY_FORM, sequenceIndex: nextSequenceIndex}}
        onSubmit={handleCreate}
        isPending={createCase.isPending}
        videoItems={videoItems}
        mode="create"
      />

      {editTarget ? (
        <CaseFormDialog
          open={true}
          onClose={() => setEditTarget(null)}
          initialValues={{
            sequenceIndex: editTarget.sequenceIndex,
            title: editTarget.title,
            bodyMarkdown: editTarget.bodyMarkdown,
            linkedItemId: editTarget.linkedItemId ?? '',
          }}
          onSubmit={handleUpdate}
          isPending={updateCase.isPending}
          videoItems={videoItems}
          mode="edit"
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          open={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isPending={deleteCase.isPending}
          caseTitle={deleteTarget.title}
        />
      ) : null}
    </div>
  );
}
