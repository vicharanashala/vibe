import { useHpStudentCohorts } from "@/hooks/hooks";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ArrowRight, Trophy, CheckCircle2, LayoutDashboard, History, RefreshCw } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function StudentCohorts() {
    const { data: cohorts, totalHp, isLoading, error, refetch, isRefetching } = useHpStudentCohorts();
    const navigate = useNavigate();

    const getProgressColor = (progress: number) => {
        if (progress >= 80) return "from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500"
        if (progress >= 50) return "from-amber-500 to-amber-600 dark:from-amber-400 dark:to-amber-500"
        return "from-red-500 to-red-600 dark:from-red-400 dark:to-red-500"
    }

    const getProgressBg = (progress: number) => {
        if (progress >= 80) return "bg-emerald-50 dark:bg-emerald-950/30"
        if (progress >= 50) return "bg-amber-50 dark:bg-amber-950/30"
        return "bg-red-50 dark:bg-red-950/30"
    }

    function EnrollmentProgress(props: { progress: number }) {
        const progress = props.progress;
        return (
            <div className={`flex  items-center gap-4 sm:w-75 w-full ${getProgressBg(progress)}`}>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden shadow-inner">
                <div
                className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(progress)}`}
                style={{
                    width: `${progress.toFixed(2)}%`,
                    transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
                }}
                />
            </div>
            </div>
        )
    }

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
        <TooltipProvider>
        <div className="container mx-auto p-6 max-w-6xl space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">My Cohorts</h1>
                    <p className="text-muted-foreground">
                        Select a cohort to view your activities, submissions, and current House Points (HP) standing.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isRefetching}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                        {isRefetching ? "Refreshing..." : "Refresh"}
                    </Button>
                    <Button
                        variant="outline"
                        className="gap-2 shrink-0"
                        onClick={() => navigate({ to: '/student/hp-system/ledger' as any })}
                    >
                        <History className="h-4 w-4" />
                        HP History
                    </Button>
                </div>
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
                        <div className="text-2xl font-bold">{cohorts?.filter(c => (c.percentCompleted ?? 0) >= 100).length || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                                Cohorts with All Activities Completed
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/10 dark:bg-amber-900/10 dark:border-amber-900/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total HP</CardTitle>
                        <Trophy className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalHp}</div>
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
                    {cohorts.map((cohort, index) => (
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
                                            <span className="font-medium text-muted-foreground">Activities Completion</span>
                                            <span className="font-bold">{Math.min(cohort.percentCompleted ?? 0, 100)}%</span>
                                        </div>
                                        <EnrollmentProgress progress={Math.min(cohort.percentCompleted ?? 0, 100)} /> 
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            className="w-full group"
                                            onClick={() => navigate({ to: `/student/hp-system/${cohort.courseVersionId}/${cohort.cohortName}/activities` })}
                                        >
                                            View activities
                                            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View all HP activities and submit your work for this cohort</TooltipContent>
                                </Tooltip>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
        </TooltipProvider>
    );
}
