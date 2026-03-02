import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentLedger, useHpStudents, useRevertHpEntry, useRestoreHpEntry } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Zap, ExternalLink, Undo2, RotateCcw, User, Mail, Clock } from "lucide-react";

export default function StudentLedgerPage() {
    const { courseVersionId, cohortName, studentId } = useParams({ strict: false });
    const navigate = useNavigate();

    const { data: students } = useHpStudents(courseVersionId || '', cohortName || '');
    const student = students.find(s => s._id === studentId);

    const { data: ledger, isLoading, refetch } = useHpStudentLedger(
        studentId || '', courseVersionId || '', cohortName || ''
    );

    const { mutateAsync: revertEntry, isPending: isReverting } = useRevertHpEntry();
    const { mutateAsync: restoreEntry, isPending: isRestoring } = useRestoreHpEntry();

    const [actionEntryId, setActionEntryId] = useState<string | null>(null);
    const [reasonDialog, setReasonDialog] = useState<{
        open: boolean;
        entryId: string;
        action: 'revert' | 'restore';
    }>({ open: false, entryId: '', action: 'revert' });
    const [reason, setReason] = useState('');

    const openReasonDialog = (entryId: string, action: 'revert' | 'restore') => {
        setReason('');
        setReasonDialog({ open: true, entryId, action });
    };

    const handleConfirmAction = async () => {
        const { entryId, action } = reasonDialog;
        setReasonDialog({ ...reasonDialog, open: false });
        setActionEntryId(entryId);
        try {
            if (action === 'revert') {
                await revertEntry(entryId);
            } else {
                await restoreEntry(entryId);
            }
            refetch();
        } finally {
            setActionEntryId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUBMITTED':
                return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Submitted</Badge>;
            case 'PENDING':
                return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pending</Badge>;
            case 'REVERTED':
                return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Reverted</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const formatDateTime = (iso?: string) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const totalHp = ledger.reduce((sum, e) => sum + e.currentHp, 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex items-center gap-4 border-b pb-4">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate({
                        to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName || '')}/activities`
                    })}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold tracking-tight">HP History</h2>
                    <p className="text-muted-foreground">
                        Transaction ledger for {decodeURIComponent(cohortName || '')}
                    </p>
                </div>
            </div>

            {/* Student Info Card */}
            <Card className="bg-gradient-to-r from-card to-muted/30">
                <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-semibold text-lg">
                            {student ? student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {student?.name || 'Loading...'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                {student?.email || '—'}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 text-3xl font-bold">
                            <Zap className="h-7 w-7 text-yellow-500" />
                            {totalHp}
                        </div>
                        <div className="text-sm text-muted-foreground">Current Total HP</div>
                    </div>
                </CardContent>
            </Card>

            {/* Ledger Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : ledger.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    No HP transactions found for this student.
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Transaction History</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[200px]">Activity</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Submission</TableHead>
                                    <TableHead className="text-right">Base HP</TableHead>
                                    <TableHead className="text-right">Current HP</TableHead>
                                    <TableHead className="min-w-[160px]">Submitted At</TableHead>
                                    <TableHead className="min-w-[200px]">Note / Reason</TableHead>
                                    <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ledger.map(entry => (
                                    <TableRow key={entry._id}>
                                        <TableCell>
                                            <div className="font-medium">{entry.activityTitle}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {formatDateTime(entry.createdAt)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(entry.status)}</TableCell>
                                        <TableCell>
                                            {entry.submissionLink ? (
                                                <a
                                                    href={entry.submissionLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                    View
                                                </a>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-semibold text-muted-foreground">{entry.baseHp}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-semibold ${entry.currentHp > 0 ? 'text-green-600 dark:text-green-400' : entry.currentHp < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                                {entry.currentHp > 0 ? '+' : ''}{entry.currentHp}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {entry.submittedAt ? (
                                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                                    <span>{formatDateTime(entry.submittedAt)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">
                                                {entry.note || '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {entry.status === 'REVERTED' ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isRestoring && actionEntryId === entry._id}
                                                    onClick={() => openReasonDialog(entry._id, 'restore')}
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                                    {isRestoring && actionEntryId === entry._id ? 'Restoring...' : 'Restore'}
                                                </Button>
                                            ) : entry.status === 'SUBMITTED' ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    disabled={isReverting && actionEntryId === entry._id}
                                                    onClick={() => openReasonDialog(entry._id, 'revert')}
                                                >
                                                    <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                                    {isReverting && actionEntryId === entry._id ? 'Reverting...' : 'Revert'}
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Reason Dialog */}
            <Dialog open={reasonDialog.open} onOpenChange={(open) => setReasonDialog({ ...reasonDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {reasonDialog.action === 'revert' ? 'Revert HP Entry' : 'Restore HP Entry'}
                        </DialogTitle>
                        <DialogDescription>
                            {reasonDialog.action === 'revert'
                                ? 'Provide a reason for reverting this HP entry. This will set the current HP to 0.'
                                : 'Provide a reason for restoring this HP entry. The original HP will be reinstated.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <label className="text-sm font-medium">Reason / Note</label>
                        <Textarea
                            placeholder="Enter the reason for this action..."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="min-h-[80px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReasonDialog({ ...reasonDialog, open: false })}>Cancel</Button>
                        <Button
                            variant={reasonDialog.action === 'revert' ? 'destructive' : 'default'}
                            onClick={handleConfirmAction}
                        >
                            {reasonDialog.action === 'revert' ? 'Confirm Revert' : 'Confirm Restore'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
