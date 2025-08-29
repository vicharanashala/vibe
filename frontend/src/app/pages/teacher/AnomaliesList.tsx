"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowUp, ArrowDown, Loader2, AlertCircle } from "lucide-react"
import { useAnomaliesByCourseItem, type Anomaly } from "@/hooks/hooks"
import { useAnomalyStore } from "@/store/anomaly-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Pagination } from "@/components/ui/Pagination"

export default function AnomaliesList() {
 
  const courseId = useAnomalyStore.getState().courseId
  const versionId = useAnomalyStore.getState().versionId

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<'createdAt' | 'type' | 'studentName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const {
    data: anomalies = [],
    isLoading,
    error,
    refetch,
    total,
    totalPages
  } = useAnomaliesByCourseItem(
    courseId as string,
    versionId as string,
    page,
    limit,
    sortBy,
    sortOrder
  );

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'MULTIPLE_FACES':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Multiple Faces Detected</Badge>
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">{type}</Badge>
    }
  }

  const handleSort = (column: 'createdAt' | 'type' | 'studentName') => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setPage(1); 
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Course Anomalies
              </h1>
            </div>
          </div>
        </div>

        {/* Anomalies Table */}
        <Card className="border-0 shadow-lg overflow-hidden px-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Card className="w-full">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold">Anomalies</h2>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">Show</span>
                        <select
                          value={limit}
                          onChange={handleLimitChange}
                          className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <span className="text-sm text-muted-foreground">per page</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => handleSort('createdAt')}
                          >
                            <div className="flex items-center">
                              Detected At
                              {sortBy === 'createdAt' && (
                                sortOrder === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
                              )}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {error ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-12">
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <AlertCircle className="h-8 w-8 text-destructive" />
                                <p className="text-destructive text-sm">{error}</p>
                                <button
                                  onClick={() => refetch()}
                                  className="text-sm text-primary hover:underline mt-2 flex items-center space-x-1"
                                  disabled={isLoading}
                                >
                                  <span>Try again</span>
                                  {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : anomalies.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                              No anomalies found
                            </TableCell>
                          </TableRow>
                        ) : (
                          anomalies.map((anomaly) => (
                            <TableRow key={anomaly.id || anomaly._id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${anomaly.studentName}`} />
                                    <AvatarFallback>{anomaly.studentName?.charAt(0) || 'U'}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">{anomaly.studentName || 'Unknown User'}</div>
                                    <div className="text-xs text-muted-foreground">{anomaly.studentEmail}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{getTypeBadge(anomaly.type)}</TableCell>
                              <TableCell>
                                {new Date(anomaly.createdAt).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalDocuments={total}
                    onPageChange={handlePageChange}
                  />
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
