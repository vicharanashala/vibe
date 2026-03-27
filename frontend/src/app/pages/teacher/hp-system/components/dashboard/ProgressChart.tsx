import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    Legend, 
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell
} from "recharts";
import { AlertCircle } from "lucide-react";

interface ProgressChartProps {
    title: string;
    description?: string;
    type: 'bar' | 'line' | 'pie';
    data: any[];
    height?: number;
    className?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function ProgressChart({ 
    title, 
    description, 
    type, 
    data, 
    height = 400, 
    className = "" 
}: ProgressChartProps) {
    const renderChart = () => {
        switch (type) {
            case 'bar':
                // Handle empty data for bar charts
                if (!data || data.length === 0) {
                    return (
                        <div className="h-[400px] w-full flex flex-col items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mb-4 text-muted-foreground/50" />
                            <p className="text-center text-sm">
                                No activity data available
                            </p>
                            <p className="text-center text-xs text-muted-foreground/70 mt-2">
                                There are no activities to display for the selected filters
                            </p>
                        </div>
                    );
                }
                
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
                            <Bar dataKey="submitted" name="Submitted" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="approved" name="Approved" stackId="a" fill="#3b82f6" />
                            <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'line':
                // Handle empty data for line charts
                if (!data || data.length === 0) {
                    return (
                        <div className="h-[400px] w-full flex flex-col items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mb-4 text-muted-foreground/50" />
                            <p className="text-center text-sm">
                                No submission data available
                            </p>
                            <p className="text-center text-xs text-muted-foreground/70 mt-2">
                                There are no submissions to display for the selected period
                            </p>
                        </div>
                    );
                }
                
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
                            <Line type="monotone" dataKey="submitted" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                            <Line type="monotone" dataKey="approved" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                            <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'pie':
                // Handle empty data for pie charts
                if (!data || data.length === 0 || data.every(item => item.count === 0)) {
                    return (
                        <div className="h-[400px] w-full flex flex-col items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mb-4 text-muted-foreground/50" />
                            <p className="text-center text-sm">
                                No HP data available yet
                            </p>
                            <p className="text-center text-xs text-muted-foreground/70 mt-2">
                                Students haven't earned any House Points in this cohort
                            </p>
                        </div>
                    );
                }
                
                return (
                    <ResponsiveContainer width="100%" height={height}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percentage }) => `${name}: ${percentage}%`}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="count"
                            >
                                {data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </PieChart>
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
