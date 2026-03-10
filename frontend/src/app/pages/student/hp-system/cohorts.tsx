import { useHpStudentCohorts } from "@/hooks/hooks";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ArrowRight, Trophy, CheckCircle2, LayoutDashboard } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function StudentCohorts() {
    const { data: cohorts, isLoading, error } = useHpStudentCohorts();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 6;

    const filteredCohorts = (cohorts ?? []).filter((cohort) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            cohort.courseName?.toLowerCase().includes(q) ||
            cohort.cohortName?.toLowerCase().includes(q)
        );
    });

    const totalPages = Math.max(1, Math.ceil(filteredCohorts.length / pageSize));
    const paginatedCohorts = filteredCohorts.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    // The backend endpoint isn't wired yet so we use mock data from the hook
    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[50vh]">
            Loading your cohorts...
        </div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">
            Error: {error}
        </div>;
    }

    return (
        <div className="container mx-auto p-6 max-w-6xl space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">My Cohorts</h1>
                <p className="text-muted-foreground">
                    Select a cohort to view your activities, submissions, and current House Points (HP) standing.
                </p>
            </div>
            <div className="relative max-w-sm mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search cohorts..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                    }}
                />
            </div>

            {/* Mock Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="bg-primary/5 border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cohorts</CardTitle>
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{cohorts?.length || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Currently enrolled
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-green-500/5 border-green-500/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Cohorts fully finished
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/10 dark:bg-amber-900/10 dark:border-amber-900/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total HP</CardTitle>
                        <Trophy className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            House Points earned
                        </p>
                    </CardContent>
                </Card>
            </div>

            {(!cohorts || cohorts.length === 0) ? (
                <Card className="flex flex-col items-center justify-center p-12 mt-8 text-center border-dashed">
                    <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No Cohorts Found</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                        You don't seem to be enrolled in any active cohorts right now. If you believe this is an error, please contact your instructor.
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                    {paginatedCohorts.map((cohort, index) => (
                        <Card key={index} className="flex flex-col hover:border-primary/50 transition-colors">
                            <CardHeader>
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                        <CardTitle className="leading-tight">{cohort.courseName}</CardTitle>
                                        <CardDescription className="flex items-center gap-1.5 mt-1 font-medium text-foreground/70">
                                            {cohort.cohortName}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-muted-foreground">Completion</span>
                                            <span className="font-bold">10%</span>
                                        </div>
                                        <Progress value={10} className="h-2" />
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Your HP:</span>
                                        <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-500">
                                            <Trophy className="h-3.5 w-3.5" />
                                            0
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    className="w-full group"
                                    onClick={() => navigate({ to: `/student/hp-system/${cohort.courseVersionId}/${cohort.cohortName}/activities` })}
                                >
                                    View activities
                                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            <Card className="mt-8">
                <CardContent className="flex flex-col items-center gap-3 py-3">
                    <div className="text-sm text-muted-foreground">
                        Page {page} of {totalPages} • {filteredCohorts.length} total
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage(page - 1)}>
                            ‹
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => {
                            const pageNumber = i + 1;
                            return (
                                <Button
                                    key={pageNumber}
                                    size="icon"
                                    variant={page === pageNumber ? "default" : "outline"}
                                    onClick={() => setPage(pageNumber)}
                                >
                                    {pageNumber}
                                </Button>
                            );
                        })}
                        <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                            ›
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
