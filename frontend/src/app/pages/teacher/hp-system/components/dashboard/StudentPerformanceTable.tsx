import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { 
    Search,
    ArrowUpDown,
    Download,
    AlertCircle,
    CheckCircle,
    Clock
} from "lucide-react";

interface StudentPerformanceTableProps {
    data: {
        studentId: string;
        name: string;
        email: string;
        completedActivities: number;
        hpBalance: number;
        completionPercentage: number;
        lastActivityDate: string;
        status: 'on-track' | 'at-risk' | 'inactive';
    }[];
    className?: string;
}

type SortField = 'name' | 'email' | 'completedActivities' | 'hpBalance' | 'completionPercentage' | 'lastActivityDate';
type SortDirection = 'asc' | 'desc';

export function StudentPerformanceTable({ data, className }: StudentPerformanceTableProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const filteredAndSortedData = useMemo(() => {
        let filtered = data.filter(student =>
            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.email.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filtered.sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = (bValue as string).toLowerCase();
            }

            if (sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        return filtered;
    }, [data, searchTerm, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'on-track':
                return <Badge variant="default" className="bg-green-100 text-green-800">On Track</Badge>;
            case 'at-risk':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">At Risk</Badge>;
            case 'inactive':
                return <Badge variant="destructive">Inactive</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'on-track':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'at-risk':
                return <AlertCircle className="h-4 w-4 text-yellow-600" />;
            case 'inactive':
                return <Clock className="h-4 w-4 text-red-600" />;
            default:
                return null;
        }
    };

    const exportData = () => {
        const csvContent = [
            ['Name', 'Email', 'Completed Activities', 'HP Balance', 'Completion %', 'Last Activity', 'Status'],
            ...filteredAndSortedData.map(student => [
                student.name,
                student.email,
                student.completedActivities,
                student.hpBalance,
                `${student.completionPercentage}%`,
                student.lastActivityDate,
                student.status
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student-performance.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Student Performance</CardTitle>
                        <CardDescription>
                            Track individual student progress and identify those who may need additional support
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportData}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search students..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold"
                                        onClick={() => handleSort('name')}
                                    >
                                        Name
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold"
                                        onClick={() => handleSort('email')}
                                    >
                                        Email
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold"
                                        onClick={() => handleSort('completedActivities')}
                                    >
                                        Completed
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold"
                                        onClick={() => handleSort('hpBalance')}
                                    >
                                        HP Balance
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold"
                                        onClick={() => handleSort('completionPercentage')}
                                    >
                                        Completion
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold"
                                        onClick={() => handleSort('lastActivityDate')}
                                    >
                                        Last Activity
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedData.map((student) => (
                                <TableRow key={student.studentId}>
                                    <TableCell className="font-medium">{student.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{student.email}</TableCell>
                                    <TableCell>{student.completedActivities}</TableCell>
                                    <TableCell className="font-semibold">{student.hpBalance}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-16 bg-muted rounded-full h-2">
                                                <div 
                                                    className="bg-blue-600 h-2 rounded-full" 
                                                    style={{ width: `${student.completionPercentage}%` }}
                                                />
                                            </div>
                                            <span className="text-sm">{student.completionPercentage}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{student.lastActivityDate}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            {getStatusIcon(student.status)}
                                            {getStatusBadge(student.status)}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
