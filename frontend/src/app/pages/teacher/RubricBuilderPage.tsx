import React, {useState, useRef, useEffect} from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  Lock,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Copy,
} from 'lucide-react';
import {
  useRubricsByCourseVersion,
  useCreateRubric,
  useUpdateRubric,
  useDeleteRubric,
  Rubric,
  RubricCriterion,
} from '@/hooks/hooks';
import {AlertDialog} from '@/components/ui/alert-dialog';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';

// ─── Criterion row editor ─────────────────────────────────────────────────

interface CriterionRowProps {
  criterion: Omit<RubricCriterion, 'id'> & {id?: string};
  index: number;
  onChange: (index: number, field: string, value: string | number) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function CriterionRow({criterion, index, onChange, onRemove, disabled}: CriterionRowProps) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-start border border-border rounded-lg p-3 bg-muted/10">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Criterion Name *</Label>
        <Input
          placeholder="e.g. Code Quality"
          value={criterion.name}
          onChange={e => onChange(index, 'name', e.target.value)}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Input
          placeholder="Optional description"
          value={criterion.description || ''}
          onChange={e => onChange(index, 'description', e.target.value)}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1 w-24">
        <Label className="text-xs text-muted-foreground">Max Points *</Label>
        <Input
          type="number"
          min={1}
          placeholder="100"
          value={criterion.maxPoints || ''}
          onChange={e => onChange(index, 'maxPoints', Number(e.target.value))}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>
      <div className="pt-5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={disabled}
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Remove criterion"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Rubric card (view/edit existing) ────────────────────────────────────

interface RubricCardProps {
  rubric: Rubric;
  courseId: string;
  versionId: string;
  onClone?: (rubric: Rubric) => void;
}

function RubricCard({rubric, courseId, versionId, onClone}: RubricCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(rubric.title);
  const [description, setDescription] = useState(rubric.description || '');
  const [criteria, setCriteria] = useState(rubric.criteria.map(c => ({...c})));
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isLocked = (rubric.assessmentCount ?? 0) > 0;

  const {mutateAsync: updateRubric, isPending: isUpdating} = useUpdateRubric();
  const {mutateAsync: deleteRubric, isPending: isDeleting} = useDeleteRubric();

  const handleSave = async () => {
    if (!title.trim()) return;
    if (criteria.some(c => !c.name.trim() || c.maxPoints <= 0)) return;
    try {
      await updateRubric({rubricId: rubric.id, courseId, versionId, title, description, criteria});
      setEditing(false);
    } catch (_err) {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRubric({rubricId: rubric.id, courseId, versionId});
      setShowDeleteDialog(false);
    } catch (_err) {
      setShowDeleteDialog(false);
    }
  };

  const handleCriterionChange = (i: number, field: string, value: string | number) => {
    setCriteria(prev => prev.map((c, idx) => idx === i ? {...c, [field]: value} : c));
  };
  const handleRemoveCriterion = (i: number) => {
    setCriteria(prev => prev.filter((_, idx) => idx !== i));
  };
  const handleAddCriterion = () => {
    setCriteria(prev => [...prev, {id: '', name: '', description: '', maxPoints: 10}]);
  };

  const lockTooltipMessage = "This rubric has been used to assess submissions and cannot be edited or deleted.";

  return (
    <>
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">{rubric.title}</CardTitle>
              {isLocked && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full cursor-help">
                      <Lock className="h-3 w-3" /> Locked — has assessments
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {lockTooltipMessage}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Clone Button (always available) */}
              {!editing && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => onClone?.(rubric)}
                  title="Clone this rubric into the creation form"
                >
                  <Copy className="h-3.5 w-3.5" /> Clone
                </Button>
              )}

              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : null}

              {editing && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={isUpdating}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                    {isUpdating ? 'Saving…' : 'Save'}
                  </Button>
                </>
              )}

              {/* Delete Button */}
              {!editing && (
                isLocked ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-block">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground opacity-50 cursor-not-allowed"
                          disabled
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      This rubric has been used to assess submissions and cannot be deleted.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteDialog(true)}
                    title="Delete rubric"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(p => !p)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {rubric.description && (
            <CardDescription className="text-xs mt-1">{rubric.description}</CardDescription>
          )}
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-3 pt-0">
            {editing ? (
              <>
                {isLocked && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md font-medium">
                    This rubric has existing assessments. Pre-existing criteria are locked and cannot be modified or deleted, but you can append new criteria below.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Title *</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Criteria</Label>
                  {criteria.map((c, i) => {
                    const isPreExisting = isLocked && Boolean(c.id && rubric.criteria.some(rc => rc.id === c.id));
                    return (
                      <CriterionRow
                        key={c.id || i}
                        criterion={c}
                        index={i}
                        onChange={handleCriterionChange}
                        onRemove={handleRemoveCriterion}
                        disabled={isPreExisting || isUpdating}
                      />
                    );
                  })}
                  <Button type="button" variant="ghost" size="sm" onClick={handleAddCriterion} className="gap-1 text-xs">
                    <Plus className="h-3 w-3" /> Add Criterion
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {rubric.criteria.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm border-b border-border pb-1 last:border-0 last:pb-0">
                    <div>
                      <span className="font-medium">{c.name}</span>
                      {c.description && <span className="text-xs text-muted-foreground ml-2">— {c.description}</span>}
                    </div>
                    <span className="text-xs font-semibold text-primary">{c.maxPoints} pts</span>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground text-right pt-1">
                  Total: <strong>{rubric.criteria.reduce((s, c) => s + c.maxPoints, 0)} pts</strong>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Rubric?"
        description={`Are you sure you want to delete "${rubric.title}"? This action cannot be undone.`}
        actionLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ─── Create rubric form ───────────────────────────────────────────────────

interface CreateFormProps {
  courseId: string;
  versionId: string;
  onCreated: () => void;
  cloneData?: Rubric | null;
  onClearClone?: () => void;
}

function CreateRubricForm({courseId, versionId, onCreated, cloneData, onClearClone}: CreateFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState([{name: '', description: '', maxPoints: 10}]);

  const formRef = useRef<HTMLDivElement>(null);
  const {mutateAsync: createRubric, isPending} = useCreateRubric();

  useEffect(() => {
    if (cloneData) {
      setTitle(`${cloneData.title} (Copy)`);
      setDescription(cloneData.description || '');
      setCriteria(
        cloneData.criteria.map(c => ({
          name: c.name,
          description: c.description || '',
          maxPoints: c.maxPoints,
        })),
      );
      formRef.current?.scrollIntoView({behavior: 'smooth'});
    }
  }, [cloneData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (criteria.some(c => !c.name.trim() || c.maxPoints <= 0)) return;
    await createRubric({
      courseId,
      versionId,
      title,
      description: description || undefined,
      criteria: criteria.map(({name, description: d, maxPoints}) => ({name, description: d || undefined, maxPoints})),
    });
    setTitle('');
    setDescription('');
    setCriteria([{name: '', description: '', maxPoints: 10}]);
    if (onClearClone) onClearClone();
    onCreated();
  };

  const handleCriterionChange = (i: number, field: string, value: string | number) => {
    setCriteria(prev => prev.map((c, idx) => idx === i ? {...c, [field]: value} : c));
  };
  const handleRemoveCriterion = (i: number) => {
    if (criteria.length === 1) return;
    setCriteria(prev => prev.filter((_, idx) => idx !== i));
  };

  return (
    <Card ref={formRef} className="border-2 border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-primary" />
            {cloneData ? 'Cloning Rubric' : 'New Rubric'}
          </span>
          {cloneData && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setTitle('');
                setDescription('');
                setCriteria([{name: '', description: '', maxPoints: 10}]);
                if (onClearClone) onClearClone();
              }}
            >
              Clear Cloned Data
            </Button>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          {cloneData
            ? `Pre-filled from "${cloneData.title}". Adjust title, criteria, or point values below and save as a new rubric.`
            : 'Define a reusable grading rubric for this course version. Criterion IDs are auto-generated.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="rubric-title" className="text-xs font-medium">Title *</Label>
              <Input
                id="rubric-title"
                placeholder="e.g. Code Quality Rubric"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rubric-desc" className="text-xs font-medium">Description</Label>
              <Input
                id="rubric-desc"
                placeholder="Optional — describe what this rubric assesses"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Criteria *</Label>
            {criteria.map((c, i) => (
              <CriterionRow
                key={i}
                criterion={c}
                index={i}
                onChange={handleCriterionChange}
                onRemove={handleRemoveCriterion}
                disabled={isPending}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCriteria(prev => [...prev, {name: '', description: '', maxPoints: 10}])}
              className="gap-1 text-xs"
              disabled={isPending}
            >
              <Plus className="h-3 w-3" /> Add Criterion
            </Button>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? 'Creating…' : 'Create Rubric'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function RubricBuilderPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const courseId = searchParams.get('courseId') || '';
  const versionId = searchParams.get('versionId') || '';
  const [cloneData, setCloneData] = useState<Rubric | null>(null);

  const {data: rubrics = [], isLoading, refetch} = useRubricsByCourseVersion(courseId, versionId);

  return (
    <main className="mx-auto max-w-5xl space-y-6 my-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Rubric Builder
          </h1>
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          Create and manage reusable grading rubrics for this course version.
          Once a rubric has been used to assess a submission, it is locked and cannot be edited or deleted.
        </p>
      </header>

      {/* Create form */}
      <CreateRubricForm
        courseId={courseId}
        versionId={versionId}
        onCreated={refetch}
        cloneData={cloneData}
        onClearClone={() => setCloneData(null)}
      />

      {/* Existing rubrics */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Existing Rubrics ({rubrics.length})
        </h2>
        {isLoading ? (
          <Card className="border border-border">
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </CardContent>
          </Card>
        ) : rubrics.length === 0 ? (
          <Card className="border border-border bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-2">
              <BookOpen className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No rubrics yet</p>
              <p className="text-xs text-muted-foreground">Create your first rubric above to start assessing submissions.</p>
            </CardContent>
          </Card>
        ) : (
          rubrics.map(rubric => (
            <RubricCard
              key={rubric.id}
              rubric={rubric}
              courseId={courseId}
              versionId={versionId}
              onClone={targetRubric => setCloneData(targetRubric)}
            />
          ))
        )}
      </section>
    </main>
  );
}
