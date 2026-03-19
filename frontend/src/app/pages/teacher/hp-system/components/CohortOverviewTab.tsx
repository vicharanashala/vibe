import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid,Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { useHpCohortOverviewStats } from "@/hooks/hooks";
import { AlertCircle, Loader2, Users, FileText, CheckCircle, TrendingUp, Clock } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MetricCard } from "./dashboard/MetricCard";
import { ProgressChart } from "./dashboard/ProgressChart";
import { StudentPerformanceTable } from "./dashboard/StudentPerformanceTable";
import { FilterPanel, FilterState } from "./dashboard/FilterPanel";

interface CohortOverviewTabProps {
    courseVersionId: string;
    cohortName: string;
}

export function CohortOverviewTab({ courseVersionId, cohortName }: CohortOverviewTabProps) {
    const { data: stats, isLoading, error } = useHpCohortOverviewStats(courseVersionId, cohortName);
    const [, setFilters] = useState<FilterState>({
        dateRange: '30days',
        activityType: 'all',
        status: 'all',
        studentProgress: 'all',
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <MetricCard key={i} title="" value="" loading />
                    ))}
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Loading dashboard...</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[400px] flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>{error || "Failed to load overview data"}</span>
            </div>
        );
    }

    return (
        <TooltipProvider>
        <div className="space-y-6">
            {/* Filter Panel */}
            <FilterPanel 
                onFiltersChange={setFilters}
                className="mb-6"
            />

            {/* Metrics Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total Students"
                    value={stats.totalStudents}
                    icon={Users}
                    tooltip="Total number of students enrolled in this cohort"
                />
                <MetricCard
                    title="Active Activities"
                    value={stats.activeActivities}
                    icon={FileText}
                    subtitle="Published activities"
                    tooltip="Number of published activities in this cohort"
                />
                <MetricCard
                    title="Pending Reviews"
                    value={stats.pendingReviews}
                    icon={Clock}
                    subtitle="Awaiting approval"
                    tooltip="Number of submissions waiting for teacher review"
                    trend={{ value: 12, direction: 'down' }}
                />
                <MetricCard
                    title="Overdue Submissions"
                    value={stats.totalOverdue}
                    icon={AlertCircle}
                    subtitle="Across all activities"
                    tooltip="Number of students who missed the deadline across all activities in this cohort"
                    iconColor="text-destructive"
                />
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Activity Completion Rates */}
                <Card>
                    <CardHeader>
                        <CardTitle>Activity Completion Rates</CardTitle>
                        <CardDescription>Status breakdown per activity for {decodeURIComponent(cohortName)}</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={stats.completionRates}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="activityTitle"
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                        interval={0}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <YAxis />
                                    <RechartsTooltip
                                        cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                                    />
                                    <Legend verticalAlign="top" height={36} />
                                    <Bar dataKey="submittedCount" name="Submitted" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="pendingCount" name="Pending" stackId="a" fill="#f59e0b" />
                                    <Bar dataKey="revertedCount" name="Reverted" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* HP Distribution */}
                <ProgressChart
                    title="HP Distribution"
                    description="Distribution of House Points among students"
                    type="pie"
                    data={stats.hpDistribution}
                    height={300}
                />
            </div>

            {/* Submission Timeline */}
            <ProgressChart
                title="Submission Timeline"
                description="Daily submission trends over the selected period"
                type="line"
                data={stats.submissionTimeline}
                height={350}
            />

            {/* Student Performance Table */}
            <StudentPerformanceTable 
                data={stats.studentPerformance}
                className="mt-6"
            />

            {/* Student Progress Overview */}
            <div className="grid gap-6 lg:grid-cols-3">
                <MetricCard
                    title="Completed Activities"
                    value={stats.studentProgress[0]?.completed || 0}
                    icon={CheckCircle}
                    subtitle="Students finished"
                    iconColor="text-green-600"
                />
                <MetricCard
                    title="In Progress"
                    value={stats.studentProgress[0]?.inProgress || 0}
                    icon={TrendingUp}
                    subtitle="Currently working"
                    iconColor="text-blue-600"
                />
                <MetricCard
                    title="Not Started"
                    value={stats.studentProgress[0]?.notStarted || 0}
                    icon={AlertCircle}
                    subtitle="Yet to begin"
                    iconColor="text-orange-600"
                />
            </div>
        </div>
        </TooltipProvider>
    );
}
