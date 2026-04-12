import { useState, useEffect } from "react";
import { AlertCircle, TrendingUp, FileText, Clock, CheckCircle, Calendar, TrendingDown, Minus } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis,
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    Legend, 
    ResponsiveContainer,
    BarChart,
    Bar
} from "recharts";
import { hpApi } from "@/lib/api/hp-system";

interface OverviewTabProps {
    courseVersionId: string;
    cohortName: string;
}

// StudentMetricCard Component
interface StudentMetricCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    icon?: any;
    iconColor?: string;
    tooltip?: string;
    trend?: {
        value: number;
        direction: 'up' | 'down' | 'neutral';
    };
    loading?: boolean;
}

function StudentMetricCard({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    iconColor = "text-muted-foreground",
    tooltip,
    trend,
    loading = false
}: StudentMetricCardProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    </CardTitle>
                    {Icon && <Icon className={`h-4 w-4 ${iconColor}`} />}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                    </div>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground mt-1">
                            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                        </p>
                    )}
                </CardContent>
            </Card>
        );
    }

    const card = (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {Icon && <Icon className={`h-4 w-4 ${iconColor}`} />}
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold">{value}</div>
                    {trend && (
                        <div className={`text-xs font-medium ${
                            trend.direction === 'up' ? 'text-green-600' :
                            trend.direction === 'down' ? 'text-red-600' :
                            'text-muted-foreground'
                        }`}>
                            {trend.direction === 'up' ? '↑' : 
                             trend.direction === 'down' ? '↓' : '→'}
                            {Math.abs(trend.value)}%
                        </div>
                    )}
                </div>
                {subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                )}
            </CardContent>
        </Card>
    );

    if (tooltip) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="cursor-help">{card}</div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-sm">{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return card;
}

// StudentProgressChart Component
interface StudentProgressChartProps {
    title: string;
    description?: string;
    type: 'line' | 'bar';
    data: any[];
    height?: number;
    className?: string;
}

function StudentProgressChart({ 
    title, 
    description, 
    type, 
    data, 
    height = 300, 
    className = "" 
}: StudentProgressChartProps) {
    const renderChart = () => {
        switch (type) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={height}>
                        <LineChart
                            data={data}
                            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="date"
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                interval={0}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                            <Legend />
                            <Line 
                                type="monotone" 
                                dataKey="hpChange" 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                dot={{ fill: '#3b82f6' }}
                                name="HP Change"
                            />
                            <Line 
                                type="monotone" 
                                dataKey="activitiesCompleted" 
                                stroke="#10b981" 
                                strokeWidth={2} 
                                dot={{ fill: '#10b981' }}
                                name="Activities Completed"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={height}>
                        <BarChart
                            data={data}
                            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="date"
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
                            <Bar 
                                dataKey="hpChange" 
                                name="HP Change" 
                                fill="#3b82f6" 
                                radius={[4, 4, 0, 0]} 
                            />
                            <Bar 
                                dataKey="activitiesCompleted" 
                                name="Activities Completed" 
                                fill="#10b981" 
                                radius={[4, 4, 0, 0]} 
                            />
                        </BarChart>
                    </ResponsiveContainer>
                );

            default:
                return null;
        }
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="pl-2">
                {renderChart()}
            </CardContent>
        </Card>
    );
}

// ActivityBreakdown Component
const ACTIVITY_TYPES = [
    { value: 'all', label: 'All Activities' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'milestone', label: 'Milestones' },
    { value: 'quiz', label: 'Quizzes' },
    { value: 'project', label: 'Projects' },
];

function ActivityBreakdown({ data, className }: { data: any; className?: string }) {
    const [selectedType, setSelectedType] = useState('all');

    const totalActivities = data.notStarted + data.inProgress + data.submitted + data.approved;

    const breakdownItems = [
        {
            status: 'Not Started',
            count: data.notStarted,
            color: 'bg-gray-500',
            textColor: 'text-gray-600',
            percentage: totalActivities > 0 ? (data.notStarted / totalActivities) * 100 : 0
        },
        {
            status: 'In Progress',
            count: data.inProgress,
            color: 'bg-blue-500',
            textColor: 'text-blue-600',
            percentage: totalActivities > 0 ? (data.inProgress / totalActivities) * 100 : 0
        },
        {
            status: 'Submitted',
            count: data.submitted,
            color: 'bg-yellow-500',
            textColor: 'text-yellow-600',
            percentage: totalActivities > 0 ? (data.submitted / totalActivities) * 100 : 0
        },
        {
            status: 'Approved',
            count: data.approved,
            color: 'bg-green-500',
            textColor: 'text-green-600',
            percentage: totalActivities > 0 ? (data.approved / totalActivities) * 100 : 0
        }
    ];

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Activity Breakdown</CardTitle>
                        <CardDescription>
                            Status of all your assigned activities
                        </CardDescription>
                    </div>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                            {ACTIVITY_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {breakdownItems.map((item) => (
                        <div key={item.status} className="space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                                    <span className="text-sm font-medium">{item.status}</span>
                                    <Badge variant="secondary" className={item.textColor}>
                                        {item.count}
                                    </Badge>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {item.percentage.toFixed(1)}%
                                </span>
                            </div>
                            <Progress 
                                value={item.percentage} 
                                className="h-2"
                            />
                        </div>
                    ))}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Activities</span>
                        <span className="text-lg font-bold">{totalActivities}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// RecentActivity Component
function RecentActivity({ recentSubmissions, upcomingDeadlines, className }: { 
    recentSubmissions: any[]; 
    upcomingDeadlines: any[]; 
    className?: string 
}) {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getDeadlineIcon = (daysLeft: number) => {
        if (daysLeft <= 3) {
            return <Clock className="h-4 w-4 text-red-600" />;
        } else if (daysLeft <= 7) {
            return <Clock className="h-4 w-4 text-yellow-600" />;
        } else {
            return <Calendar className="h-4 w-4 text-blue-600" />;
        }
    };

    const getDeadlineBadge = (daysLeft: number) => {
        if (daysLeft <= 3) {
            return <Badge className="bg-red-100 text-red-800">{daysLeft} days left</Badge>;
        } else if (daysLeft <= 7) {
            return <Badge className="bg-yellow-100 text-yellow-800">{daysLeft} days left</Badge>;
        } else {
            return <Badge className="bg-blue-100 text-blue-800">{daysLeft} days left</Badge>;
        }
    };

    const getHpIcon = (hpEarned?: number) => {
        if (!hpEarned) return null;
        if (hpEarned > 0) {
            return <TrendingUp className="h-4 w-4 text-green-600" />;
        } else if (hpEarned < 0) {
            return <TrendingDown className="h-4 w-4 text-red-600" />;
        } else {
            return <Minus className="h-4 w-4 text-gray-600" />;
        }
    };

    const getHpText = (hpEarned?: number) => {
        if (!hpEarned) return null;
        const sign = hpEarned > 0 ? '+' : '';
        return <span className={`font-medium ${hpEarned > 0 ? 'text-green-600' : hpEarned < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {sign}{hpEarned} HP
        </span>;
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className={`grid gap-6 lg:grid-cols-2 ${className}`}>
            {/* Recent Submissions */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Submissions</CardTitle>
                    <CardDescription>
                        Your latest activity submissions and their status
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentSubmissions.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No recent submissions
                            </p>
                        ) : (
                            recentSubmissions.map((submission, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{submission.activityTitle}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Submitted {formatDate(submission.submittedAt)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        {getHpIcon(submission.hpEarned)}
                                        {getHpText(submission.hpEarned)}
                                        {getStatusBadge(submission.status)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Upcoming Deadlines */}
            <Card>
                <CardHeader>
                    <CardTitle>Upcoming Deadlines</CardTitle>
                    <CardDescription>
                        Activities with approaching deadlines
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {upcomingDeadlines.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No upcoming deadlines
                            </p>
                        ) : (
                            upcomingDeadlines.map((deadline, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        {getDeadlineIcon(deadline.daysLeft)}
                                        <div>
                                            <p className="font-medium">{deadline.activityTitle}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Due {formatDate(deadline.deadlineDate)}
                                            </p>
                                        </div>
                                    </div>
                                    {getDeadlineBadge(deadline.daysLeft)}
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Main OverviewTab Component
export function OverviewTab({ courseVersionId, cohortName }: OverviewTabProps) {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setIsLoading(true);
                const response = await hpApi.getStudentDashboardStats(courseVersionId, cohortName);
                if (response.success) {
                    setStats(response.data);
                } else {
                    setError('Failed to load dashboard data');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [courseVersionId, cohortName]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <StudentMetricCard key={i} title="" value="" loading />
                    ))}
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
                    <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>{error || "Failed to load dashboard data"}</span>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6">
                {/* Personal Metrics Overview */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StudentMetricCard
                        title="My Total HP"
                        value={stats.myStats.totalHp}
                        icon={TrendingUp}
                        tooltip="Your current House Points balance"
                        trend={{ value: 8, direction: 'up' }}
                    />
                    <StudentMetricCard
                        title="Activities Completed"
                        value={stats.myStats.completedActivities}
                        icon={CheckCircle}
                        tooltip="Number of activities you have successfully completed"
                        iconColor="text-green-600"
                    />
                    <StudentMetricCard
                        title="Pending Submissions"
                        value={stats.myStats.pendingSubmissions}
                        icon={Clock}
                        tooltip="Activities waiting for instructor review"
                        iconColor="text-yellow-600"
                    />
                    <StudentMetricCard
                        title="Completion Percentage"
                        value={`${stats.myStats.completionPercentage}%`}
                        icon={FileText}
                        tooltip="Your overall completion rate for this cohort"
                        iconColor="text-blue-600"
                    />
                </div>

                {/* Charts Row */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Progress Timeline */}
                    <StudentProgressChart
                        title="Your Progress Timeline"
                        description="Track your activity completion and HP changes over time"
                        type="line"
                        data={stats.progressTimeline}
                        height={300}
                    />

                    {/* Activity Breakdown */}
                    <ActivityBreakdown
                        data={stats.activityBreakdown}
                    />
                </div>

                {/* Recent Activity */}
                <RecentActivity
                    recentSubmissions={stats.recentSubmissions}
                    upcomingDeadlines={stats.upcomingDeadlines}
                />
            </div>
        </TooltipProvider>
    );
}
