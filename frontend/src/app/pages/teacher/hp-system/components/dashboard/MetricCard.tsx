import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    icon?: LucideIcon;
    iconColor?: string;
    tooltip?: string;
    trend?: {
        value: number;
        direction: 'up' | 'down' | 'neutral';
    };
    loading?: boolean;
}

export function MetricCard({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    iconColor = "text-muted-foreground",
    tooltip,
    trend,
    loading = false
}: MetricCardProps) {
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
