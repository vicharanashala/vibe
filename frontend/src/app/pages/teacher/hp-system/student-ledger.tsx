import { useMemo } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentLedger, useHpStudents, useHpCourseVersions } from "@/hooks/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Zap, User, Mail, Clock, MessageSquare } from "lucide-react";

export default function StudentLedgerPage() {
    const { courseVersionId, cohortName, studentId } = useParams({ strict: false });
    const navigate = useNavigate();

    const { data: students } = useHpStudents(courseVersionId || '', cohortName || '');
    const student = students.find(s => s._id === studentId);

    const { data: courses } = useHpCourseVersions();
    const courseId = useMemo(() => {
        if (!courses || !courseVersionId) return '';
        for (const c of courses) {
            if (c.versions.some((v: any) => v.courseVersionId === courseVersionId)) return c.courseId;
        }
        return '';
    }, [courses, courseVersionId]);

    const { data: ledgerResp, isLoading } = useHpStudentLedger(
        studentId || '', courseVersionId || '', cohortName || '', courseId
    );

    const ledger = ledgerResp?.data || [];
    const studentInfo = ledgerResp?.studentDetails || {
        studentName: student?.name || 'Loading...',
        studentEmail: student?.email || '—',
        hpPoints: 0
    };

    const getEventBadge = (eventType: string, direction: string) => {
        if (direction === 'CREDIT') {
            return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Credit</Badge>;
        }
        if (eventType === 'REVERSAL') {
            return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Reversal</Badge>;
        }
        if (eventType === 'REJECTION') {
            return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Rejection</Badge>;
        }
        return <Badge variant="secondary">{eventType}</Badge>;
    };

    const getReasonLabel = (reasonCode?: string) => {
        switch (reasonCode) {
            case 'SUBMISSION_REWARD': return 'Submission Reward';
            case 'REWARD_REVERSAL': return 'Reward Reversal';
            case 'REJECTION_PENALTY': return 'Rejection Penalty';
            default: return reasonCode || '—';
        }
    };

    const formatDateTime = (iso?: string) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const totalHp = studentInfo.hpPoints;

    return (
        <div className="space-y-6 w-full pb-12">
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
                            {studentInfo.studentName !== 'Loading...' ? studentInfo.studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {studentInfo.studentName}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                {studentInfo.studentEmail}
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
                                    <TableHead>Event</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Balance After</TableHead>
                                    <TableHead className="min-w-[160px]">Date</TableHead>
                                    <TableHead className="min-w-[250px]">Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ledger.map(entry => (
                                    <TableRow key={entry._id}>
                                        <TableCell>
                                            {getEventBadge(entry.eventType, entry.direction)}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">{getReasonLabel(entry.calc?.reasonCode)}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-semibold ${entry.direction === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {entry.direction === 'CREDIT' ? '+' : '-'}{entry.amount}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-semibold text-muted-foreground">
                                                {entry.calc?.computedAmount ?? '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span>{formatDateTime(entry.createdAt)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {entry.meta?.note ? (
                                                <div className="flex items-start gap-1.5 text-sm">
                                                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                                                    <span>{entry.meta.note}</span>
                                                </div>
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
        </div>
    );
}
