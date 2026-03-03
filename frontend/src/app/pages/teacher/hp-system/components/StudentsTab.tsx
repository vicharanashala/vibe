import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHpStudents } from "@/hooks/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, History, User, Mail, Zap, FileText } from "lucide-react";

interface StudentsTabProps {
    courseVersionId: string;
    cohortName: string;
}

export function StudentsTab({ courseVersionId, cohortName }: StudentsTabProps) {
    const [search, setSearch] = useState("");
    const navigate = useNavigate();
    const { data: students, isLoading } = useHpStudents(courseVersionId, cohortName);

    const filteredStudents = students.filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search students by name or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Students Count */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Students List */}
            {filteredStudents.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    No students found{search ? ` matching "${search}"` : ''}.
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredStudents.map(student => (
                        <Card key={student._id} className="hover:border-primary/50 transition-colors">
                            <CardContent className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    {/* Avatar */}
                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-semibold text-sm">
                                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>

                                    {/* Name & Email */}
                                    <div className="min-w-0">
                                        <div className="font-medium truncate">{student.name}</div>
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                                            <Mail className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate">{student.email}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 flex-shrink-0">
                                    {/* Completion */}
                                    <div className="flex items-center gap-2 min-w-[140px]">
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all bg-primary"
                                                style={{ width: `${student.completionPercentage}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-muted-foreground w-[36px] text-right">
                                            {student.completionPercentage}%
                                        </span>
                                    </div>

                                    {/* HP Badge */}
                                    <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                                        <Zap className="h-3.5 w-3.5 text-yellow-500" />
                                        <span className="font-semibold">{student.totalHp}</span>
                                        <span className="text-muted-foreground text-xs">HP</span>
                                    </Badge>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate({
                                            to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName)}/student/${student._id}/submissions`
                                        })}
                                    >
                                        <FileText className="h-4 w-4 mr-2" />
                                        View Submissions
                                    </Button>
                                    {/* View HP History */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate({
                                            to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(cohortName)}/student/${student._id}/ledger`
                                        })}
                                    >
                                        <History className="h-4 w-4 mr-2" />
                                        View HP History
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
