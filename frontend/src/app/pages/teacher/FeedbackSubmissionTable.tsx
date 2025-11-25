import React, { useState } from 'react';
import { Eye, Loader2, Search, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFeedbackSubmissions } from '@/hooks/useFeedbackSubmissions';
import { SubmissionDetailsDialog } from './SubmissionDetailsDialog';
import { Pagination } from '@/components/ui/Pagination';

interface FeedbackSubmissionsTableProps {
  feedbackId: string;
  courseId: string;
  courseVersionId: string; // If needed for actions
}


const mockSubmissionsData = {
  data: [
    {
      _id: '1',
      userInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 1 Course Feedbackkkkkkk wwdwqdw',
      feedback: "helllo",
      formFields: {
        rating: 4.5,
        overall_satisfaction: 'Very Satisfied',
        comments: 'Great content! The examples were very helpful, but I\'d love more practice exercises.',
        suggestions: 'Add quizzes at the end of each module.',
        would_recommend: true,
        additional_topics: ['Advanced JS', 'React Hooks'],
        file_upload: 'resume.pdf',
        date_preference: '2025-12-01',
        multiple_choice: 'Option B',
        slider_value: 85,
      },
      submittedAt: '2025-11-20T10:30:00Z',
      status: 'Submitted',
      instructorFeedback: {
        text: 'Thanks for the feedback, John! We\'ll consider adding more quizzes in the next update.',
        updatedAt: '2025-11-21T14:00:00Z',
        updatedBy: 'Instructor Alice',
      },
    },
    {
      _id: '2',
      userInfo: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 1 Course Feedback',
      feedback: 'The pacing was perfect, and I appreciated the real-world applications.',
      formFields: {
        comments: 'The pacing was perfect, and I appreciated the real-world applications.',
        rating: 5.0,
      },
      submittedAt: '2025-11-21T15:45:00Z',
      status: 'Submitted',
      instructorFeedback: null, // No feedback yet
    },
    {
      _id: '3',
      userInfo: {
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike.johnson@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 2 Course Feedback',
      feedback: {
        rating: 3.0,
        comments: 'Some sections felt rushed. More explanations on advanced topics would help.',
      },
      formFields: {
        rating: 3.0,
        comments: 'Some sections felt rushed. More explanations on advanced topics would help.',
        difficulty_level: 'Medium',
        helpful_resources: ['Docs', 'Videos'],
        improvement_areas: ['Pacing', 'Examples'],
      },
      submittedAt: '2025-11-22T09:15:00Z',
      status: 'Submitted',
      instructorFeedback: {
        text: 'Noted, Mike. We\'ll slow down the advanced sections in future iterations.',
        updatedAt: '2025-11-23T11:30:00Z',
        updatedBy: 'Instructor Alice',
      },
    },
    {
      _id: '4',
      userInfo: {
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'emily.davis@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 1 Course Feedback',
      feedback: 'Excellent course! Highly recommend to colleagues.',
      formFields: {
        comments: 'Excellent course! Highly recommend to colleagues.',
        // Empty additional fields
      },
      submittedAt: '2025-11-23T16:20:00Z',
      status: 'Submitted',
      instructorFeedback: null,
    },
    {
      _id: '5',
      userInfo: {
        firstName: 'Chris',
        lastName: 'Wilson',
        email: 'chris.wilson@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 2 Course Feedback',
      feedback: {
        rating: 5.0,
        comments: 'Loved the interactive elements!',
      },
      formFields: {
        rating: 5.0,
        comments: 'Loved the interactive elements!',
        favorite_feature: 'Interactive Quizzes',
        suggestions: '',
        email_updates: true,
        custom_field1: 'Value 1',
        custom_field2: 'Value 2',
        custom_field3: 'Value 3',
        custom_field4: 'Value 4',
        custom_field5: 'Value 5',
      },
      submittedAt: '2025-11-24T12:00:00Z',
      status: 'Submitted',
      instructorFeedback: {
        text: 'Glad you enjoyed it, Chris! More interactions coming soon.',
        updatedAt: '2025-11-24T13:45:00Z',
        updatedBy: 'Instructor Alice',
      },
    },
    // Add more for pagination testing (e.g., total 25 items)
    {
      _id: '6',
      userInfo: {
        firstName: 'Sarah',
        lastName: 'Brown',
        email: 'sarah.brown@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 1 Course Feedback',
      feedback: 'Good overview, but examples could be more diverse.',
      formFields: {
        comments: 'Good overview, but examples could be more diverse.',
        rating: 4.0,
        diversity_score: 3.5,
      },
      submittedAt: '2025-11-19T08:00:00Z',
      status: 'Submitted',
      instructorFeedback: null,
    },
    {
      _id: '7',
      userInfo: {
        firstName: 'David',
        lastName: 'Taylor',
        email: 'david.taylor@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 2 Course Feedback',
      feedback: 'Very informative. Thanks!',
      formFields: {
        comments: 'Very informative. Thanks!',
        // Only 1 field (comments as string)
      },
      submittedAt: '2025-11-20T17:30:00Z',
      status: 'Submitted',
      instructorFeedback: null,
    },
    {
      _id: '8',
      userInfo: {
        firstName: 'Lisa',
        lastName: 'Martinez',
        email: 'lisa.martinez@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 1 Course Feedback',
      feedback: {
        rating: 4.0,
        comments: 'Clear and concise. Minor typos in slides.',
      },
      formFields: {
        rating: 4.0,
        comments: 'Clear and concise. Minor typos in slides.',
        typos_reported: ['Slide 5', 'Slide 12'],
        clarity_score: 4.5,
        length_satisfaction: 'Just Right',
      },
      submittedAt: '2025-11-21T11:10:00Z',
      status: 'Submitted',
      instructorFeedback: {
        text: 'Appreciate the catch on typos, Lisa. Fixed for next version.',
        updatedAt: '2025-11-22T09:00:00Z',
        updatedBy: 'Instructor Alice',
      },
    },
    {
      _id: '9',
      userInfo: {
        firstName: 'Robert',
        lastName: 'Garcia',
        email: 'robert.garcia@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 2 Course Feedback',
      feedback: 'Engaging material, kept me interested throughout.',
      formFields: {
        comments: 'Engaging material, kept me interested throughout.',
        engagement_level: 'High',
        recommendation: true,
      },
      submittedAt: '2025-11-22T14:50:00Z',
      status: 'Submitted',
    },
    {
      _id: '10',
      userInfo: {
        firstName: 'Anna',
        lastName: 'Lee',
        email: 'anna.lee@example.com',
      },
      itemType: 'FEEDBACK',
      itemName: 'Week 1 Course Feedback',
      feedback: 'Fantastic! 10/10.',
      formFields: {
        comments: 'Fantastic! 10/10.',
        // Empty
      },
      submittedAt: '2025-11-23T20:00:00Z',
      status: 'Submitted',
      instructorFeedback: null,
    },
  ],
  totalPages: 3, // Assuming 25 total items, 10 per page
  totalCount: 25,
};
export const FeedbackSubmissionsTable: React.FC<FeedbackSubmissionsTableProps> = ({ feedbackId, courseId, courseVersionId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);

//   const { data: submissionsData, isLoading: submissionsLoading } = useFeedbackSubmissions({
//     feedbackId,
//     courseId,
//     searchQuery,
//     page: currentPage,
//   });
const { data: submissionsData, isLoading: submissionsLoading } = {
  data: mockSubmissionsData,
  isLoading: false,
};
  const submissions = submissionsData?.data || [];
  const limit = 10; // Assuming fixed limit from hook

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handleViewDetails = (submission: any) => {
    setSelectedSubmission(submission);
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
              setCurrentPage(1); // Reset page on search
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
                  const username = `${sub.userInfo?.firstName || ''} ${sub.userInfo?.lastName || ''}`.trim() || 'Anonymous';
                  const email = sub.userInfo?.email || 'N/A';
                  const itemType = sub.itemType || 'FEEDBACK';
                  const itemName = sub.itemName || 'N/A';
                  const feedbackSummary = sub.feedback 
                    ? (typeof sub.feedback === 'string' 
                        ? sub.feedback.length > 50 
                          ? `${sub.feedback.substring(0, 50)}...` 
                          : sub.feedback 
                        : JSON.stringify(sub.feedback).length > 50 
                          ? `${JSON.stringify(sub.feedback).substring(0, 50)}...` 
                          : JSON.stringify(sub.feedback)
                      )
                    : 'N/A';

                  return (
                    <TableRow key={sub._id}>
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
                      <TableCell className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={sub.feedback || 'N/A'}>
                        {feedbackSummary}
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
                totalDocuments={submissionsData.totalCount}
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