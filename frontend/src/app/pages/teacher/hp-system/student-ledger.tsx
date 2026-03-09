import { useParams, useNavigate } from "@tanstack/react-router";
import { useHpStudentLedger, useHpStudents } from "@/hooks/hooks";
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
import { ArrowLeft, Zap, User, Mail, TrendingUp, TrendingDown } from "lucide-react";

export default function StudentLedgerPage() {
    const { courseVersionId, cohortName, studentId } = useParams({ strict: false });
    const navigate = useNavigate();

    // Use students list to get basic student info
    const { data: students } = useHpStudents(courseVersionId || '', cohortName || '');
    const student = students.find(s => s._id === studentId);

    const { data: ledger, isLoading, error } = useHpStudentLedger(
        studentId || '', courseVersionId || '', cohortName || ''
    );

    const getDirectionBadge = (direction: string) => {
        if (direction === 'CREDIT') {
            return (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1 w-fit">
                    <TrendingUp size={12} /> Credit
                </Badge>
            );
        }
        return (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1 w-fit">
                <TrendingDown size={12} /> Debit
            </Badge>
        );
    };

    const formatDateTime = (iso?: string | Date) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const totalHp = ledger.reduce((sum, e) => {
        return e.direction === 'CREDIT' ? sum + (e.amount ?? 0) : sum - (e.amount ?? 0);
    }, 0);

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
                        <div className="text-sm text-muted-foreground">Net HP (from ledger)</div>
                    </div>
                </CardContent>
            </Card>

            {/* Ledger Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : error ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-destructive">
                    Failed to load ledger: {error}
                </div>
            ) : ledger.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    No HP transactions found for this student.
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Transaction History ({ledger.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Direction</TableHead>
                                    <TableHead className="text-right">Amount (HP)</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Note</TableHead>
                                    <TableHead className="min-w-[160px]">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ledger.map(entry => (
                                    <TableRow key={entry._id}>
                                        <TableCell>
                                            <div className="font-medium text-sm">{entry.eventType || '—'}</div>
                                            {entry.calc?.reasonCode && (
                                                <div className="text-xs text-muted-foreground mt-0.5">{entry.calc.reasonCode}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getDirectionBadge(entry.direction)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-bold text-base ${entry.direction === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {entry.direction === 'CREDIT' ? '+' : '-'}{entry.amount ?? 0}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {entry.calc?.reasonCode || '—'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                                            {entry.meta?.note || '—'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {formatDateTime(entry.createdAt)}
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
