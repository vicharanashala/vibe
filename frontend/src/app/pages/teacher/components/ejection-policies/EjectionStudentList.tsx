import { useState, useMemo } from 'react';
import {
  Shield, ShieldAlert, ShieldOff, Search, Clock,
  UserX, UserCheck, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, X, CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useEjectionStudents, useManualEject, useReinstate,
  useBulkEject, useBulkReinstate,
} from '@/hooks/ejection-policy-hooks';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface EjectionStudentListProps {
  courseId: string;
  courseVersionId: string;
  cohortId: string;
  cohortName: string;
}

type StatusFilter = 'all' | 'active' | 'ejected';

export function EjectionStudentList({
  courseId, courseVersionId, cohortId, cohortName,
}: EjectionStudentListProps) {
  // ── Filters & pagination ──────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  // ── Selection ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Expand history ────────────────────────────────────────────────
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // ── Single eject modal ────────────────────────────────────────────
  const [ejectTarget, setEjectTarget] = useState<{ userId: string; name: string } | null>(null);
  const [ejectReason, setEjectReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  // ── Single reinstate modal ────────────────────────────────────────
  const [reinstateTarget, setReinstateTarget] = useState<{ userId: string; name: string } | null>(null);

  // ── Bulk eject modal ──────────────────────────────────────────────
  const [bulkEjectOpen, setBulkEjectOpen] = useState(false);
  const [bulkEjectReason, setBulkEjectReason] = useState('');
  const [bulkReasonError, setBulkReasonError] = useState('');

  // ── Bulk reinstate modal ──────────────────────────────────────────
  const [bulkReinstateOpen, setBulkReinstateOpen] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────
  const { students, totalPages, totalDocuments, isLoading, refetch } =
    useEjectionStudents(courseId, courseVersionId, cohortId, page, 20, debouncedSearch, statusFilter);

  const ejectMutation = useManualEject();
  const reinstateMutation = useReinstate();
  const bulkEjectMutation = useBulkEject();
  const bulkReinstateMutation = useBulkReinstate();

  // ── Derived selection state ───────────────────────────────────────
  const selectedStudents = useMemo(
    () => students.filter((s: any) => selectedIds.has(s.userId)),
    [students, selectedIds],
  );
  const selectedActiveCount = selectedStudents.filter((s: any) => !s.isEjected).length;
  const selectedEjectedCount = selectedStudents.filter((s: any) => s.isEjected).length;
  const allSelected = students.length > 0 && students.every((s: any) => selectedIds.has(s.userId));
  const someSelected = selectedIds.size > 0;

  // ── Handlers ─────────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__ejectionSearchTimer);
    (window as any).__ejectionSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const toggleStudent = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s: any) => s.userId)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Single eject
  const handleConfirmEject = async () => {
    if (!ejectTarget) return;
    if (!ejectReason.trim() || ejectReason.trim().length < 10) {
      setReasonError('Reason must be at least 10 characters');
      return;
    }
    try {
      await ejectMutation.mutateAsync({
        params: { path: { courseId, courseVersionId, userId: ejectTarget.userId } },
        body: { reason: ejectReason.trim(), cohortId },
      });
      toast.success(`${ejectTarget.name} has been ejected`);
      setEjectTarget(null);
      setEjectReason('');
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to eject student');
    }
  };

  // Single reinstate
  const handleConfirmReinstate = async () => {
    if (!reinstateTarget) return;
    try {
      await reinstateMutation.mutateAsync({
        params: { path: { courseId, courseVersionId, userId: reinstateTarget.userId } },
        body: { cohortId },
      });
      toast.success(`${reinstateTarget.name} has been reinstated`);
      setReinstateTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reinstate student');
    }
  };

  // Bulk eject — only active students from selection
  const handleConfirmBulkEject = async () => {
    if (!bulkEjectReason.trim() || bulkEjectReason.trim().length < 10) {
      setBulkReasonError('Reason must be at least 10 characters');
      return;
    }
    const activeUserIds = selectedStudents
      .filter((s: any) => !s.isEjected)
      .map((s: any) => s.userId);

    try {
      const result = await bulkEjectMutation.mutateAsync({
        body: {
          userIds: activeUserIds,
          courseId,
          courseVersionId,
          cohortId,
          reason: bulkEjectReason.trim(),
        },
      });
      const res = result as any;
      if (res.failureCount > 0) {
        toast.warning(`Ejected ${res.successCount} students. ${res.failureCount} failed.`);
      } else {
        toast.success(`Successfully ejected ${res.successCount} students`);
      }
      setBulkEjectOpen(false);
      setBulkEjectReason('');
      clearSelection();
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Bulk eject failed');
    }
  };

  // Bulk reinstate — only ejected students from selection
  const handleConfirmBulkReinstate = async () => {
    const ejectedUserIds = selectedStudents
      .filter((s: any) => s.isEjected)
      .map((s: any) => s.userId);

    try {
      const result = await bulkReinstateMutation.mutateAsync({
        body: { userIds: ejectedUserIds, courseId, courseVersionId, cohortId },
      });
      const res = result as any;
      if (res.failureCount > 0) {
        toast.warning(`Reinstated ${res.successCount} students. ${res.failureCount} failed.`);
      } else {
        toast.success(`Successfully reinstated ${res.successCount} students`);
      }
      setBulkReinstateOpen(false);
      clearSelection();
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Bulk reinstate failed');
    }
  };

  // ── UI helpers ────────────────────────────────────────────────────
  const getStatusBadge = (student: any) => {
    if (student.ejectionStatus === 'ejected') return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300 flex items-center gap-1">
        <ShieldOff className="h-3 w-3" /> Ejected
      </Badge>
    );
    if (student.ejectionStatus === 'warning') return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 flex items-center gap-1">
        <ShieldAlert className="h-3 w-3" /> At Risk
      </Badge>
    );
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 flex items-center gap-1">
        <Shield className="h-3 w-3" /> Active
      </Badge>
    );
  };

  const getRowHighlight = (student: any) => {
    if (selectedIds.has(student.userId)) return 'bg-primary/5';
    if (student.ejectionStatus === 'ejected') return 'bg-red-50/30 dark:bg-red-950/10';
    if (student.ejectionStatus === 'warning') return 'bg-amber-50/30 dark:bg-amber-950/10';
    return '';
  };

  const formatDate = (date: any) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-4 mt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Students in <span className="text-primary">{cohortName}</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalDocuments} student{totalDocuments !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Active</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />At Risk</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Ejected</span>
        </div>
      </div>

      {/* Search + Status filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-9"
          />
          {search && (
            <X
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
              onClick={() => handleSearchChange('')}
            />
          )}
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); clearSelection(); }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="ejected">Ejected Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading students...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <UserX className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No students found</p>
              {(debouncedSearch || statusFilter !== 'all') && (
                <p className="text-sm mt-1">Try adjusting your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {/* Select All */}
                    <TableHead className="w-[48px] pl-4">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-[260px]">Student</TableHead>
                    <TableHead className="w-[120px]">Enrolled</TableHead>
                    <TableHead className="w-[150px]">Progress</TableHead>
                    <TableHead className="w-[150px]">Last Active</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student: any) => (
                    <>
                      <TableRow
                        key={student.enrollmentId}
                        className={`transition-colors ${getRowHighlight(student)}`}
                      >
                        {/* Checkbox */}
                        <TableCell className="pl-4 py-4">
                          <Checkbox
                            checked={selectedIds.has(student.userId)}
                            onCheckedChange={() => toggleStudent(student.userId)}
                            aria-label={`Select ${student.name}`}
                          />
                        </TableCell>

                        {/* Student */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border-2 border-primary/10">
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-bold text-sm">
                                {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{student.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Enrolled */}
                        <TableCell className="py-4 text-sm text-muted-foreground">
                          {formatDate(student.enrollmentDate)}
                        </TableCell>

                        {/* Progress */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden w-20">
                              <div
                                className={`h-full rounded-full ${
                                  student.percentCompleted >= 80 ? 'bg-emerald-500'
                                  : student.percentCompleted >= 40 ? 'bg-amber-500'
                                  : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(student.percentCompleted, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-foreground min-w-[3rem]">
                              {(student.percentCompleted ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>

                        {/* Last Active */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className={`h-3.5 w-3.5 ${student.ejectionStatus === 'warning' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                            <span className={student.ejectionStatus === 'warning' ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-muted-foreground'}>
                              {student.lastActiveAt ? `${student.daysSinceLastActive}d ago` : 'Never'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-4">{getStatusBadge(student)}</TableCell>

                        {/* Actions */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1">
                            {student.ejectionHistory?.length > 0 && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setExpandedStudent(expandedStudent === student.enrollmentId ? null : student.enrollmentId)}
                                className="h-8 px-2 text-muted-foreground"
                              >
                                {expandedStudent === student.enrollmentId
                                  ? <ChevronDown className="h-4 w-4" />
                                  : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            )}
                            {!student.isEjected && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => { setEjectTarget({ userId: student.userId, name: student.name }); setEjectReason(''); setReasonError(''); }}
                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <UserX className="h-4 w-4 mr-1" /> Eject
                              </Button>
                            )}
                            {student.isEjected && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setReinstateTarget({ userId: student.userId, name: student.name })}
                                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                              >
                                <UserCheck className="h-4 w-4 mr-1" /> Reinstate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Ejection History Row */}
                      {expandedStudent === student.enrollmentId && student.ejectionHistory?.length > 0 && (
                        <TableRow key={`${student.enrollmentId}-history`} className="bg-muted/10">
                          <TableCell colSpan={7} className="py-3 pl-16 pr-6">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ejection History</p>
                              {student.ejectionHistory.map((entry: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border/50 text-sm">
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-red-600">Ejected</span>
                                      <span className="text-muted-foreground text-xs">{formatDate(entry.ejectedAt)}</span>
                                      {(entry.ejectedByName || entry.ejectedBy) && (
                                        <span className="text-muted-foreground text-xs">
                                          by {entry.ejectedByName || entry.ejectedBy}
                                        </span>
                                      )}
                                      {entry.reinstatedAt && (
                                        <>
                                          <span className="text-muted-foreground">→</span>
                                          <span className="font-medium text-green-600">Reinstated</span>
                                          <span className="text-muted-foreground text-xs">{formatDate(entry.reinstatedAt)}</span>
                                        </>
                                      )}
                                    </div>
                                    <p className="text-muted-foreground">{entry.ejectionReason}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* ── Sticky Bulk Action Bar ──────────────────────────────────── */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckSquare className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedActiveCount > 0 && `${selectedActiveCount} active`}
                  {selectedActiveCount > 0 && selectedEjectedCount > 0 && ' · '}
                  {selectedEjectedCount > 0 && `${selectedEjectedCount} ejected`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="h-8"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>

              {/* Bulk Reinstate — only if ejected students are selected */}
              <Button
                size="sm"
                disabled={selectedEjectedCount === 0}
                onClick={() => setBulkReinstateOpen(true)}
                className="h-8 bg-green-600 hover:bg-green-700 text-white disabled:opacity-40"
              >
                <UserCheck className="h-3.5 w-3.5 mr-1" />
                Reinstate {selectedEjectedCount > 0 ? `(${selectedEjectedCount})` : ''}
              </Button>

              {/* Bulk Eject — only if active students are selected */}
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedActiveCount === 0}
                onClick={() => { setBulkEjectOpen(true); setBulkEjectReason(''); setBulkReasonError(''); }}
                className="h-8 disabled:opacity-40"
              >
                <UserX className="h-3.5 w-3.5 mr-1" />
                Eject {selectedActiveCount > 0 ? `(${selectedActiveCount})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Eject Modal ──────────────────────────────────────── */}
      {ejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setEjectTarget(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 space-y-6 animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Eject Student</h2>
              <Button variant="ghost" size="sm" onClick={() => setEjectTarget(null)} className="h-8 w-8 p-0 rounded-full"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">
                You are about to eject <strong>{ejectTarget.name}</strong>. Their progress is preserved and can be restored on reinstatement.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eject-reason">Reason <span className="text-red-500">*</span></Label>
              <Textarea
                id="eject-reason"
                placeholder="Describe the reason (min. 10 characters)..."
                value={ejectReason}
                onChange={e => { setEjectReason(e.target.value); if (reasonError) setReasonError(''); }}
                rows={3}
                className={reasonError ? 'border-destructive' : ''}
              />
              {reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEjectTarget(null)} disabled={ejectMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={handleConfirmEject} disabled={ejectMutation.isPending}>
                {ejectMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Ejecting...</> : <><UserX className="h-4 w-4 mr-2" />Confirm Eject</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Reinstate Modal ──────────────────────────────────── */}
      {reinstateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setReinstateTarget(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 space-y-6 animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Reinstate Student</h2>
              <Button variant="ghost" size="sm" onClick={() => setReinstateTarget(null)} className="h-8 w-8 p-0 rounded-full"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 rounded-xl">
              <UserCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 dark:text-green-200">
                You are about to reinstate <strong>{reinstateTarget.name}</strong>. They will regain course access and their previous progress will be restored.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReinstateTarget(null)} disabled={reinstateMutation.isPending}>Cancel</Button>
              <Button onClick={handleConfirmReinstate} disabled={reinstateMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                {reinstateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reinstating...</> : <><UserCheck className="h-4 w-4 mr-2" />Confirm Reinstate</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Eject Modal ────────────────────────────────────────── */}
      {bulkEjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setBulkEjectOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 space-y-6 animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Bulk Eject Students</h2>
              <Button variant="ghost" size="sm" onClick={() => setBulkEjectOpen(false)} className="h-8 w-8 p-0 rounded-full"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200 space-y-1">
                <p>You are about to eject <strong>{selectedActiveCount} active student{selectedActiveCount !== 1 ? 's' : ''}</strong>.</p>
                {selectedEjectedCount > 0 && (
                  <p className="text-xs opacity-80">{selectedEjectedCount} already-ejected student{selectedEjectedCount !== 1 ? 's' : ''} in your selection will be skipped.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-eject-reason">Reason <span className="text-red-500">*</span></Label>
              <Textarea
                id="bulk-eject-reason"
                placeholder="Shared reason for all ejections (min. 10 characters)..."
                value={bulkEjectReason}
                onChange={e => { setBulkEjectReason(e.target.value); if (bulkReasonError) setBulkReasonError(''); }}
                rows={3}
                className={bulkReasonError ? 'border-destructive' : ''}
              />
              {bulkReasonError && <p className="text-xs text-destructive">{bulkReasonError}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setBulkEjectOpen(false)} disabled={bulkEjectMutation.isPending}>Cancel</Button>
              <Button variant="destructive" onClick={handleConfirmBulkEject} disabled={bulkEjectMutation.isPending}>
                {bulkEjectMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Ejecting...</> : <><UserX className="h-4 w-4 mr-2" />Eject {selectedActiveCount} Student{selectedActiveCount !== 1 ? 's' : ''}</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Reinstate Modal ────────────────────────────────────── */}
      {bulkReinstateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setBulkReinstateOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 space-y-6 animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Bulk Reinstate Students</h2>
              <Button variant="ghost" size="sm" onClick={() => setBulkReinstateOpen(false)} className="h-8 w-8 p-0 rounded-full"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 rounded-xl">
              <UserCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <p>You are about to reinstate <strong>{selectedEjectedCount} ejected student{selectedEjectedCount !== 1 ? 's' : ''}</strong>.</p>
                {selectedActiveCount > 0 && (
                  <p className="text-xs opacity-80">{selectedActiveCount} active student{selectedActiveCount !== 1 ? 's' : ''} in your selection will be skipped.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setBulkReinstateOpen(false)} disabled={bulkReinstateMutation.isPending}>Cancel</Button>
              <Button onClick={handleConfirmBulkReinstate} disabled={bulkReinstateMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                {bulkReinstateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reinstating...</> : <><UserCheck className="h-4 w-4 mr-2" />Reinstate {selectedEjectedCount} Student{selectedEjectedCount !== 1 ? 's' : ''}</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}