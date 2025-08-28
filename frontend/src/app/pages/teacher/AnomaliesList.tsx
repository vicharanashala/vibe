"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowUp, ArrowDown, Loader2, AlertCircle } from "lucide-react"
import { useAnomaliesByCourseItem, type Anomaly } from "@/hooks/hooks"
import { useAnomalyStore } from "@/store/anomaly-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function AnomaliesList() {
 
  const courseId = useAnomalyStore.getState().courseId
  const versionId = useAnomalyStore.getState().versionId
  const itemId = useAnomalyStore.getState().itemId

  const { data: anomalies = [], isLoading, error, refetch } = useAnomaliesByCourseItem(
    courseId as string, 
    versionId as string,
    itemId as string
  );
  
  const [sortBy, setSortBy] = useState<'createdAt' | 'type' | 'studentName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'MULTIPLE_FACES':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Multiple Faces Detected</Badge>
      // Add more cases as needed
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">{type}</Badge>
    }
  }

  const handleSort = (column: 'createdAt' | 'type' | 'studentName') => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const sortedAnomalies = [...anomalies].sort((a, b) => {
    let comparison = 0
    
    if (sortBy === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    } else if (sortBy === 'type') {
      comparison = a.type.localeCompare(b.type)
    } else if (sortBy === 'studentName') {
      const nameA = a.studentName || ''
      const nameB = b.studentName || ''
      comparison = nameA.localeCompare(nameB)
    }
    
    return sortOrder === 'asc' ? comparison : -comparison
  })
  
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
            {courseId && versionId && itemId && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>Course: {courseId}</span>
                <span>•</span>
                <span>Version: {versionId}</span>
                <span>•</span>
                <span>Item: {itemId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Anomalies Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/30 transition-colors pl-6"
                      onClick={() => handleSort('studentName')}
                    >
                      <div className="flex items-center">
                        Student
                        {sortBy === 'studentName' && (
                          sortOrder === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        Anomaly Type
                        {sortBy === 'type' && (
                          sortOrder === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
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
                      <TableCell colSpan={2} className="text-center py-12">
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
                  ) : isLoading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-6">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="text-muted-foreground">Loading anomalies...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : !isLoading && sortedAnomalies.length > 0 ? (
                    sortedAnomalies.map((anomaly) => (
                      <TableRow key={anomaly._id} className="hover:bg-muted/30">
                        <TableCell className="pl-6 py-6">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md group-hover:border-primary/40 transition-colors duration-200">
                              <AvatarImage src="/placeholder.svg" alt={anomaly.studentEmail} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
                                {(() => {
                                  if (!anomaly?.studentName) return "?";
                                  const nameParts = anomaly.studentName.trim().split(" ");
                                  const initials = nameParts
                                    .slice(0, 2)
                                    .map((part) => part[0]?.toUpperCase())
                                    .join("");
                                  return initials || "?";
                                })()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground truncate text-base md:text-lg">
                                  {anomaly?.studentName && anomaly?.studentName
                                    ? `${anomaly?.studentName}`
                                    : "Unknown User"}
                                </p>
                              </div>
                              <p className="text-xs md:text-sm text-muted-foreground truncate">{anomaly?.studentEmail || ""}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          {getTypeBadge(anomaly.type)}
                        </TableCell>
                        <TableCell className="py-6">
                          <div className="text-sm text-muted-foreground">
                            {new Date(anomaly.createdAt).toLocaleString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-6 text-muted-foreground">
                        No anomalies found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
