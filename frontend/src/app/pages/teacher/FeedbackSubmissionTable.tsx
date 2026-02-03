import React, { useState } from 'react';
import { Eye, Loader2, Search, X, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFeedbackSubmissions,useExportFeedbackSubmissions } from '@/hooks/hooks';
import { SubmissionDetailsDialog } from './SubmissionDetailsDialog';
import { Pagination } from '@/components/ui/Pagination';

interface FeedbackSubmissionsTableProps {
  feedbackId: string;
  courseId: string;
}

export const FeedbackSubmissionsTable: React.FC<FeedbackSubmissionsTableProps> = ({ feedbackId, courseId}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);

  const { data: submissionsData, isLoading: submissionsLoading } = useFeedbackSubmissions({
    feedbackId,
    courseId,
    searchQuery,
    page: currentPage,
  });

  const { exportCSV: handleDownloadCSV, isExporting } = useExportFeedbackSubmissions({
    courseId,
    feedbackId
  });

  // const { data: submissionsData, isLoading: submissionsLoading } = {
  //   data: mockSubmissionsData,
  //   isLoading: false,
  // };
  const submissions = submissionsData?.submissions || [];
  const limit = 10;

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handleViewDetails = (submission: any) => {
    const details = submission.details || {};

    const ignoredKeys = ['Name', 'Email', 'Feedback'];
    const filteredFormFields = Object.entries(details).reduce((acc, [key, value]) => {
      if (!ignoredKeys.includes(key)) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    const hasExtraFields = Object.keys(filteredFormFields).length > 0;
    const normalizedSubmission = {
      userInfo: {
        firstName: submission.user?.firstName || '',
        lastName: submission.user?.lastName || '',
        email: submission.user?.email || 'N/A',
      },
      submittedAt: submission.createdAt || submission.submittedAt || new Date().toISOString(),
      itemType: submission.previousItemType || 'FEEDBACK',
      itemName: submission.previousItem?.name || 'N/A',
      feedback: submission.details?.Feedback || submission.details || 'No feedback provided',
      // formFields: submission.details || {}, 
      formFields:hasExtraFields ? filteredFormFields : {}
    };
    // setSelectedSubmission(submission);
    setSelectedSubmission(normalizedSubmission)
    setShowSubmissionDialog(true);
  };

  if (submissionsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mr-2" />
        <span>Loading submissions...</span>
      </div>
    );
  }

  return (
    <div className="p-6 w-full">
      {/* Search Only */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student name, email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // setCurrentPage(1); // Reset page on search 
            }}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <X
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
            />
          )}
        </div>
        <Button
          onClick={handleDownloadCSV}
          disabled={isExporting || submissions.length === 0}
          className="w-full lg:w-auto"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Submissions</CardTitle>
          <p className="text-sm text-muted-foreground">Detailed view of all feedback submissions</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SL No</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Item Type</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No submissions yet
                  </TableCell>
                </TableRow>
              ) : (
                submissions.map((sub: any, index: number) => {
                  const slNo = (currentPage - 1) * limit + index + 1;
                  const username = `${sub.user?.firstName || ''} ${sub.user?.lastName || ''}`.trim() || 'Anonymous';
                  const email = sub.user?.email || 'N/A';
                  const itemType = sub.previousItemType || 'FEEDBACK';
                  const itemName = sub.previousItem?.name || 'N/A';
                  const FeedbackOnly = sub.details.Feedback || "N/A";

                  return (
                    <TableRow key={`submission-${index}`}>
                      <TableCell>{slNo}</TableCell>
                      <TableCell className="font-medium max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap" title={username}>
                        {username}
                      </TableCell>
                      <TableCell className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={email}>
                        {email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{itemType}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap" title={itemName}>
                        {itemName}
                      </TableCell>
                      <TableCell className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={JSON.stringify(FeedbackOnly) || 'N/A'}>
                        {FeedbackOnly}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(sub)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {/* Pagination */}
          {submissionsData?.totalPages && submissionsData.totalPages > 0 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={submissionsData.totalPages}
                totalDocuments={submissionsData.total}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Details Dialog */}
      <SubmissionDetailsDialog
        isOpen={showSubmissionDialog}
        onClose={() => {
          setShowSubmissionDialog(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
      />
    </div>
  );
};