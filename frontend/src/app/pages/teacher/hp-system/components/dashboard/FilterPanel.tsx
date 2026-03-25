import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, X } from "lucide-react";

interface FilterPanelProps {
    onFiltersChange: (filters: FilterState) => void;
    className?: string;
}

export interface FilterState {
    dateRange: string;
    activityType: string;
    status: string;
    studentProgress: string;
}

const FILTER_OPTIONS = {
    dateRange: [
        { value: '7days', label: 'Last 7 days' },
        { value: '30days', label: 'Last 30 days' },
        { value: '90days', label: 'Last 90 days' },
        { value: 'all', label: 'All time' },
    ],
    activityType: [
        { value: 'all', label: 'All Activities' },
        { value: 'assignment', label: 'Assignments' },
        { value: 'milestone', label: 'Milestones' },
        { value: 'quiz', label: 'Quizzes' },
        { value: 'project', label: 'Projects' },
    ],
    status: [
        { value: 'all', label: 'All Status' },
        { value: 'published', label: 'Published' },
        { value: 'draft', label: 'Draft' },
        { value: 'archived', label: 'Archived' },
    ],
    studentProgress: [
        { value: 'all', label: 'All Students' },
        { value: 'completed', label: 'Completed' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'not-started', label: 'Not Started' },
    ],
};

export function FilterPanel({ onFiltersChange, className }: FilterPanelProps) {
    const [filters, setFilters] = useState<FilterState>({
        dateRange: '30days',
        activityType: 'all',
        status: 'all',
        studentProgress: 'all',
    });

    const updateFilter = (key: keyof FilterState, value: string) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFiltersChange(newFilters);
    };

    const resetFilters = () => {
        const defaultFilters = {
            dateRange: '30days',
            activityType: 'all',
            status: 'all',
            studentProgress: 'all',
        };
        setFilters(defaultFilters);
        onFiltersChange(defaultFilters);
    };

    const activeFiltersCount = Object.values(filters).filter(value => value !== '30days' && value !== 'all').length;

    const getFilterLabel = (key: keyof FilterState, value: string) => {
        const options = FILTER_OPTIONS[key];
        return options.find(option => option.value === value)?.label || value;
    };

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                        {activeFiltersCount > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {activeFiltersCount} active
                            </Badge>
                        )}
                    </CardTitle>
                    {activeFiltersCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                            <X className="h-4 w-4 mr-1" />
                            Clear all
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date Range Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            Date Range
                        </label>
                        <Select
                            value={filters.dateRange}
                            onValueChange={(value) => updateFilter('dateRange', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select date range" />
                            </SelectTrigger>
                            <SelectContent>
                                {FILTER_OPTIONS.dateRange.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Activity Type Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Activity Type</label>
                        <Select
                            value={filters.activityType}
                            onValueChange={(value) => updateFilter('activityType', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select activity type" />
                            </SelectTrigger>
                            <SelectContent>
                                {FILTER_OPTIONS.activityType.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Status</label>
                        <Select
                            value={filters.status}
                            onValueChange={(value) => updateFilter('status', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                {FILTER_OPTIONS.status.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Student Progress Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Student Progress</label>
                        <Select
                            value={filters.studentProgress}
                            onValueChange={(value) => updateFilter('studentProgress', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select progress" />
                            </SelectTrigger>
                            <SelectContent>
                                {FILTER_OPTIONS.studentProgress.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Active Filters Summary */}
                {activeFiltersCount > 0 && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(filters).map(([key, value]) => {
                                if (value === '30days' || value === 'all') return null;
                                return (
                                    <Badge key={key} variant="outline" className="gap-1">
                                        <span>{getFilterLabel(key as keyof FilterState, value)}</span>
                                        <X 
                                            className="h-3 w-3 cursor-pointer" 
                                            onClick={() => updateFilter(key as keyof FilterState, key === 'dateRange' ? '30days' : 'all')}
                                        />
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
