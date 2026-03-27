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
  const [eventType, setEventType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const localStartDate = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : undefined;
  const localEndDate = endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : undefined;

  const { data, isLoading, isError, error: fetchError } = useEjectionHistory(courseId, versionId, {
    page,
    limit: 10,
    search,
    eventType: eventType === 'ALL' ? undefined : eventType,
    cohortId,
    startDate: localStartDate,
    endDate: localEndDate,
  });

  const exportMutation = useExportEjectionHistory();

  const handleExport = () => {
    exportMutation.mutate({
      courseId,
      courseVersionId: versionId,
      search,
      eventType: eventType === 'ALL' ? undefined : eventType,
      cohortId,
      startDate: localStartDate,
      endDate: localEndDate,
    });
  };

  const handleResetFilters = () => {
    setSearch('');
    setEventType('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
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
          
          <Select value={eventType} onValueChange={(val) => { setEventType(val); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Events</SelectItem>
              <SelectItem value="EJECTED">Ejection</SelectItem>
              <SelectItem value="REINSTATED">Reinstatement</SelectItem>
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
              <TableHead>Cohort</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Stored By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading history...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-destructive">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Failed to load history</span>
                    <span className="text-xs">{(fetchError as any)?.message || 'Check your connection or console for details'}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : data?.history?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No history events found.
                </TableCell>
              </TableRow>
            ) : (
              data?.history?.map((entry: any, idx: number) => (
                <TableRow key={`${entry.enrollmentId}-${entry.type}-${idx}`}>
                  <TableCell>
                    <div className="font-medium">{entry.firstName} {entry.lastName}</div>
                    <div className="text-xs text-muted-foreground">{entry.email}</div>
                  </TableCell>
                  <TableCell>{entry.cohortName || 'N/A'}</TableCell>
                  <TableCell>
                    {entry.date ? new Date(entry.date).toLocaleString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {entry.type === 'EJECTED' && <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Ejected</Badge>}
                    {entry.type === 'REINSTATED' && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Reinstated</Badge>}
                    {entry.type === 'APPEAL_SUBMITTED' && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Appeal Subm.</Badge>}
                    {entry.type === 'APPEAL_APPROVED' && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Appeal Appr.</Badge>}
                    {entry.type === 'APPEAL_REJECTED' && <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Appeal Rej.</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.triggerType === 'POLICY' ? 'default' : entry.triggerType === 'APPEAL' ? 'outline' : 'secondary'}>
                      {entry.triggerType}
                    </Badge>
                    {entry.policyName && (
                      <div className="text-[10px] mt-1 text-muted-foreground truncate max-w-[120px]" title={entry.policyName}>
                        {entry.policyName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="text-sm truncate" title={entry.ejectionReason}>
                      {entry.ejectionReason}
                    </div>
                  </TableCell>
                  <TableCell>{entry.adminName || 'System'}</TableCell>
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
