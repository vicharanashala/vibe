import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Award, BookOpen, Star, AlertTriangle } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

// Mock Data
const cohortPerformance = [
    { name: 'Euclideans', value: 850 },
    { name: 'Dijkstrians', value: 920 },
    { name: 'Kruskalians', value: 780 },
    { name: 'A', value: 820 },
    { name: 'AKSians', value: 880 },
    { name: 'RSAians', value: 950 },
    { name: 'B', value: 890 },
];

const coursePerformance = [
    { name: 'React Masterclass', hp: 12500 },
    { name: 'Node.js Backend', hp: 9800 },
    { name: 'UI/UX Fundamentals', hp: 11200 },
    { name: 'Database Design', hp: 8500 },
];

const hpDistribution = [
    { name: 'Euclideans', value: 4500 },
    { name: 'Dijkstrians', value: 5200 },
    { name: 'Kruskalians', value: 3800 },
    { name: 'RSAians', value: 6100 },
    { name: 'A', value: 4200 },
];

const courseVersions = [
    { name: 'v1.0 (Legacy)', count: 12 },
    { name: 'v1.1 (Stable)', count: 24 },
    { name: 'v2.0 (Beta)', count: 8 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function OverviewTab() {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 rounded-md border px-4 py-2 text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <p>The dashboard is currently under development. Displayed data may not be fully accurate.</p>
            </div>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card/95 backdrop-blur-sm border border-border/50 hover:bg-accent/5 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cohorts</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground mr-2" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground">+2 from last month</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/95 backdrop-blur-sm border border-border/50 hover:bg-accent/5 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total HP Distributed</CardTitle>
                        <Star className="h-4 w-4 text-primary mr-2" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">45.2K</div>
                        <p className="text-xs text-muted-foreground">+12.5% from last month</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/95 backdrop-blur-sm border border-border/50 hover:bg-accent/5 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Best Performing Cohort</CardTitle>
                        <Award className="h-4 w-4 text-yellow-500 mr-2" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">RSAians</div>
                        <p className="text-xs text-muted-foreground">950 HP avg. per student</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/95 backdrop-blur-sm border border-border/50 hover:bg-accent/5 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Top Course</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground mr-2" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">React Masterclass</div>
                        <p className="text-xs text-muted-foreground">12.5K HP generated</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                {/* Cohort Performance Chart */}
                <Card className="col-span-1 bg-card/95 backdrop-blur-sm border border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Cohort Performance</CardTitle>
                        <CardDescription>Average HP per student across recent cohorts</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cohortPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                                />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Course Performance Area Chart */}
                <Card className="col-span-1 bg-card/95 backdrop-blur-sm border border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Course HP Generation</CardTitle>
                        <CardDescription>Total HP distributed by course</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={coursePerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorHp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                                />
                                <Area type="monotone" dataKey="hp" stroke="#10b981" fillOpacity={1} fill="url(#colorHp)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* HP Distribution Pie Chart */}
                <Card className="col-span-1 bg-card/95 backdrop-blur-sm border border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Highest HP Distributed Cohorts</CardTitle>
                        <CardDescription>Breakdown of total HP among top cohorts</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={hpDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {hpDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                                />
                                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Course Versions Chart */}
                <Card className="col-span-1 bg-card/95 backdrop-blur-sm border border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Course Versions</CardTitle>
                        <CardDescription>Distribution of active course versions</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={courseVersions} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={80} />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                                    {courseVersions.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}