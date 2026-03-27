import React, { useState } from 'react';
import { useEjectionHistory, useExportEjectionHistory } from '@/hooks/ejection-policy-hooks';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Search, FilterX, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';

interface EjectionHistoryTabProps {
  courseId: string;
  versionId: string;
  cohortId: string;
  onBack?: () => void;
}

const EjectionHistoryTab: React.FC<EjectionHistoryTabProps> = ({ courseId, versionId, cohortId, onBack }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [triggerType, setTriggerType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading, isError, error: fetchError } = useEjectionHistory(courseId, versionId, {
    page,
    limit: 10,
    search,
    triggerType: triggerType === 'ALL' ? undefined : triggerType,
    cohortId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const exportMutation = useExportEjectionHistory();

  const handleExport = () => {
    exportMutation.mutate({
      courseId,
      courseVersionId: versionId,
      search,
      triggerType: triggerType === 'ALL' ? undefined : triggerType,
      cohortId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  const handleResetFilters = () => {
    setSearch('');
    setTriggerType('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'EJECTED':
        return <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Ejected</Badge>;
      case 'REINSTATED':
        return <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Reinstated</Badge>;
      case 'APPEAL_SUBMITTED':
        return <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">Appeal Submitted</Badge>;
      case 'APPEAL_APPROVED':
        return <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">Appeal Approved</Badge>;
      case 'APPEAL_REJECTED':
        return <Badge variant="outline" className="text-orange-700 border-orange-200 bg-orange-50">Appeal Rejected</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student or email..."
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          
          <Select value={triggerType} onValueChange={(val) => { setTriggerType(val); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Trigger Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sources</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="POLICY">Policy</SelectItem>
              <SelectItem value="APPEAL">Appeal</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              className="w-40"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>

          <Button variant="ghost" size="icon" onClick={handleResetFilters} title="Reset Filters">
            <FilterX className="h-4 w-4" />
          </Button>
        </div>

        <Button 
          variant="outline" 
          onClick={handleExport}
          disabled={exportMutation.isPending}
        >
          <Download className="mr-2 h-4 w-4" />
          {exportMutation.isPending ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Reason/Note</TableHead>
              <TableHead>Performed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading history...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-destructive">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Failed to load history</span>
                    <span className="text-xs">{(fetchError as any)?.message || 'Check your connection or console for details'}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : data?.history?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No ejection events found.
                </TableCell>
              </TableRow>
            ) : (
              data?.history?.map((entry: any, idx: number) => (
                <TableRow key={`${entry.enrollmentId}-${entry.type}-${idx}`}>
                  <TableCell>
                    <div className="font-medium">{entry.firstName} {entry.lastName}</div>
                    <div className="text-xs text-muted-foreground">{entry.email}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{entry.cohortName}</div>
                  </TableCell>
                  <TableCell>{getEventBadge(entry.type)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.ejectedAt ? new Date(entry.ejectedAt).toLocaleString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={entry.triggerType === 'POLICY' ? 'bg-primary/5 text-primary border-primary/20' : ''}>
                      {entry.triggerType}
                    </Badge>
                    {entry.policyName && (
                      <div className="text-[10px] mt-1 text-muted-foreground truncate max-w-[120px]" title={entry.policyName}>
                        {entry.policyName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="text-xs line-clamp-2" title={entry.ejectionReason}>
                      {entry.ejectionReason || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {entry.ejectedByName || 'System'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center py-4">
          <Pagination
            currentPage={page}
            totalPages={data.totalPages}
            totalDocuments={data.totalDocuments}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};

export default EjectionHistoryTab;
