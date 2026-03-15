import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid,Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { useHpCohortOverviewStats } from "@/hooks/hooks";
import { AlertCircle, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CohortOverviewTabProps {
    courseVersionId: string;
    cohortName: string;
}

export function CohortOverviewTab({ courseVersionId, cohortName }: CohortOverviewTabProps) {
    const { data: stats, isLoading, error } = useHpCohortOverviewStats(courseVersionId, cohortName);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalStudents}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue Submissions</CardTitle>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertCircle className="h-4 w-4 text-destructive cursor-default" />
                            </TooltipTrigger>
                            <TooltipContent>Number of students who missed the deadline across all activities in this cohort</TooltipContent>
                        </Tooltip>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{stats.totalOverdue}</div>
                        <p className="text-xs text-muted-foreground">Across all activities</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Activity Completion Rates</CardTitle>
                    <CardDescription>Status breakdown per activity for {decodeURIComponent(cohortName)}</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <div className="h-[400px] w-full">
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
        </div>
        </TooltipProvider>
    );
}
