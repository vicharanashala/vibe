import React, {useState, useMemo} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Label} from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Star,
  ExternalLink,
  Search,
  Sparkles,
  ClipboardList,
  X,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import {
  useProjectSubmissions,
  useSetFeaturedSubmission,
  useRubricsByCourseVersion,
  useSaveAssessment,
  useSubmissionAssessment,
  Rubric,
} from '@/hooks/hooks';

// ─── Assessment Panel (per-submission inline panel) ───────────────────────

interface AssessPanelProps {
  submissionId: string;
  courseId: string;
  versionId: string;
  onClose: () => void;
}

function AssessPanel({submissionId, courseId, versionId, onClose}: AssessPanelProps) {
  const {data: rubrics, isLoading: rubricsLoading} = useRubricsByCourseVersion(courseId, versionId);
  const {data: existing, isLoading: assessmentLoading} = useSubmissionAssessment(submissionId);
  const {mutateAsync: saveAssessment, isPending: saving} = useSaveAssessment();

  const [selectedRubricId, setSelectedRubricId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [saved, setSaved] = useState(false);

  // Pre-fill from existing assessment when it loads
  React.useEffect(() => {
    if (existing && !selectedRubricId) {
      setSelectedRubricId(existing.rubricId);
      const s: Record<string, number> = {};
      const f: Record<string, string> = {};
      existing.criteria.forEach(c => {
        s[c.criterionId] = c.points;
        if (c.feedback) f[c.criterionId] = c.feedback;
      });
      setScores(s);
      setFeedbacks(f);
      setOverallFeedback(existing.overallFeedback || '');
    }
  }, [existing]);

  const selectedRubric: Rubric | undefined = rubrics.find(r => r.id === selectedRubricId);
  const totalMax = selectedRubric?.criteria.reduce((s, c) => s + c.maxPoints, 0) ?? 0;
  const totalAwarded = selectedRubric
    ? selectedRubric.criteria.reduce((s, c) => s + (scores[c.id] ?? 0), 0)
    : 0;

  const handleSave = async () => {
    if (!selectedRubric) return;
    const criteria = selectedRubric.criteria.map(c => ({
      criterionId: c.id,
      points: scores[c.id] ?? 0,
      feedback: feedbacks[c.id] || undefined,
    }));
    await saveAssessment({submissionId, rubricId: selectedRubricId, criteria, overallFeedback: overallFeedback || undefined});
    setSaved(true);
  };

  const isLoading = rubricsLoading || assessmentLoading;

  return (
    <div className="mt-3 border border-border rounded-xl bg-muted/10 p-4 space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2 text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" />
          Assess Submission
        </h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      ) : rubrics.length === 0 ? (
        // Non-blocking hint per spec: redirect to rubric builder when no rubrics exist
        <div className="text-center space-y-2 py-4">
          <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">No rubrics found for this course version.</p>
          <p className="text-xs text-muted-foreground">
            Create a rubric first, then come back to assess submissions.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.location.href = `/teacher/courses/rubric-builder?courseId=${courseId}&versionId=${versionId}`;
            }}
            className="gap-2"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Go to Rubric Builder
          </Button>
        </div>
      ) : (
        <>
          {/* Rubric selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Select Rubric</Label>
            <select
              className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedRubricId}
              onChange={e => {
                setSelectedRubricId(e.target.value);
                setScores({});
                setFeedbacks({});
                setSaved(false);
              }}
            >
              <option value="">— Choose a rubric —</option>
              {rubrics.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.criteria.reduce((s, c) => s + c.maxPoints, 0)} pts total)
                </option>
              ))}
            </select>
          </div>

          {/* Criteria scoring */}
          {selectedRubric && (
            <div className="space-y-3">
              {selectedRubric.criteria.map(criterion => (
                <div key={criterion.id} className="border border-border rounded-lg p-3 space-y-2 bg-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground">{criterion.name}</span>
                      {criterion.description && (
                        <span className="text-xs text-muted-foreground ml-2">— {criterion.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        max={criterion.maxPoints}
                        value={scores[criterion.id] ?? ''}
                        onChange={e => {
                          const v = Math.min(Number(e.target.value), criterion.maxPoints);
                          setScores(prev => ({...prev, [criterion.id]: Math.max(0, v)}));
                          setSaved(false);
                        }}
                        className="h-7 w-20 text-sm text-right"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/ {criterion.maxPoints}</span>
                    </div>
                  </div>
                  <Input
                    placeholder="Feedback for this criterion (optional)"
                    value={feedbacks[criterion.id] || ''}
                    onChange={e => {
                      setFeedbacks(prev => ({...prev, [criterion.id]: e.target.value}));
                      setSaved(false);
                    }}
                    className="h-7 text-xs"
                  />
                </div>
              ))}

              {/* Score summary */}
              <div className="flex items-center justify-between px-1 py-1 rounded-lg bg-primary/5 border border-primary/10">
                <span className="text-xs font-semibold text-muted-foreground">Total Score</span>
                <span className="text-sm font-bold text-primary">
                  {totalAwarded} / {totalMax}
                  {totalMax > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({Math.round((totalAwarded / totalMax) * 100)}%)
                    </span>
                  )}
                </span>
              </div>

              {/* Overall feedback */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Overall Feedback (optional)</Label>
                <Textarea
                  placeholder="Overall comments for the student…"
                  value={overallFeedback}
                  onChange={e => {setOverallFeedback(e.target.value); setSaved(false);}}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              {/* Save button */}
              <div className="flex items-center gap-2 justify-end">
                {saved && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
                <Button size="sm" onClick={handleSave} disabled={saving || !selectedRubricId} className="gap-1">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {saving ? 'Saving…' : existing ? 'Update Assessment' : 'Save Assessment'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function CurateGalleryPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const courseId = searchParams.get('courseId') || '';
  const versionId = searchParams.get('versionId') || '';
  const cohortId = searchParams.get('cohortId') || undefined;
  const projectName = searchParams.get('projectName') || 'Project';

  const {data: projectSubmissions, isLoading} = useProjectSubmissions(courseId, versionId, cohortId);
  const {mutateAsync: setFeatured, isPending} = useSetFeaturedSubmission();

  const [searchTerm, setSearchTerm] = useState('');
  const [featuredMap, setFeaturedMap] = useState<Record<string, boolean>>({});
  // Track which submission's assess panel is open (only one at a time)
  const [assessingId, setAssessingId] = useState<string | null>(null);

  const userInfo = useMemo(() => {
    const list = projectSubmissions?.userInfo || [];
    const initialMap: Record<string, boolean> = {};
    list.forEach(u => {
      if (u.submissionId) {
        initialMap[u.submissionId] = u.featured ?? false;
      }
    });
    setFeaturedMap(prev => {
      const next = {...prev};
      Object.keys(initialMap).forEach(key => {
        if (next[key] === undefined) {
          next[key] = initialMap[key];
        }
      });
      return next;
    });
    return list;
  }, [projectSubmissions]);

  const handleToggle = async (submissionId: string) => {
    const next = !featuredMap[submissionId];
    setFeaturedMap(prev => ({...prev, [submissionId]: next}));
    try {
      await setFeatured({submissionId, featured: next});
    } catch {
      setFeaturedMap(prev => ({...prev, [submissionId]: !next}));
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return userInfo;
    const query = searchTerm.toLowerCase();
    return userInfo.filter(u => {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const comment = ((u as any).comment || '').toLowerCase();
      return fullName.includes(query) || email.includes(query) || comment.includes(query);
    });
  }, [userInfo, searchTerm]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 my-8 px-4">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Courses
        </Button>
      </div>

      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Curate Project Gallery
          </h1>
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          Review submissions for <strong className="text-foreground">{projectName}</strong> and select which ones to showcase in the student gallery.
        </p>
      </header>

      {isLoading ? (
        <Card className="w-full border border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">Loading submissions...</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full border border-border shadow-md bg-card">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Student Submissions</CardTitle>
                <CardDescription>
                  Showing {filteredUsers.length} of {userInfo.length} total submissions.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Link to rubric builder */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => {
                    window.location.href = `/teacher/courses/rubric-builder?courseId=${courseId}&versionId=${versionId}`;
                  }}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Manage Rubrics
                </Button>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search student or comments..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 w-full rounded-xl bg-muted/20 border-border focus-visible:ring-1"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Table header */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-y border-border">
                  <tr>
                    <th className="text-left px-6 py-3.5 font-semibold text-muted-foreground">Student Name</th>
                    <th className="text-left px-6 py-3.5 font-semibold text-muted-foreground">Email</th>
                    <th className="text-left px-6 py-3.5 font-semibold text-muted-foreground">Comments</th>
                    <th className="text-left px-6 py-3.5 font-semibold text-muted-foreground">Link</th>
                    <th className="text-center px-4 py-3.5 font-semibold text-muted-foreground">Assess</th>
                    <th className="text-center px-4 py-3.5 font-semibold text-muted-foreground">Showcase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((u, idx) => {
                    const sid = u.submissionId;
                    const isFeatured = sid ? featuredMap[sid] ?? false : false;
                    const isAssessing = assessingId === sid;
                    return (
                      <React.Fragment key={sid ?? idx}>
                        <tr className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                            {`${u.firstName || ''} ${u.lastName || ''}`}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                            {u.email || '—'}
                          </td>
                          <td className="px-6 py-4 max-w-xs truncate text-muted-foreground" title={(u as any).comment}>
                            {(u as any).comment || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <a
                              href={u.submissionURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                            >
                              View Work <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                          {/* Assess button — independent from Showcase */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {sid ? (
                              <Button
                                variant={isAssessing ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setAssessingId(isAssessing ? null : sid)}
                                className="gap-1 text-xs h-8"
                                title={isAssessing ? 'Close assessment panel' : 'Open assessment form'}
                              >
                                <ClipboardList className="h-3.5 w-3.5" />
                                {isAssessing ? 'Close' : 'Assess'}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          {/* Showcase (star) toggle — completely separate from Assess */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {sid ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggle(sid)}
                                disabled={isPending}
                                className={`h-9 w-9 rounded-full transition-all duration-300 hover:scale-105 ${
                                  isFeatured
                                    ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
                                    : 'text-muted-foreground hover:bg-muted'
                                }`}
                                title={isFeatured ? 'Remove from gallery' : 'Showcase in gallery'}
                              >
                                {isFeatured ? (
                                  <Star className="h-4.5 w-4.5 fill-yellow-500 text-yellow-500" />
                                ) : (
                                  <Star className="h-4.5 w-4.5" />
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                        {/* Assessment panel — only shown for the active row */}
                        {isAssessing && sid && (
                          <tr>
                            <td colSpan={6} className="px-6 pb-4">
                              <AssessPanel
                                submissionId={sid}
                                courseId={courseId}
                                versionId={versionId}
                                onClose={() => setAssessingId(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-16 space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">No submissions found</p>
                  <p className="text-xs text-muted-foreground">Try adjusting your search terms or verify student submissions.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
