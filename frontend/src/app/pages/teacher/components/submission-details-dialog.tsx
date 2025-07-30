import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useQuestionById } from '@/hooks/hooks';

interface SubmissionDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  submission: any;
}

interface QuestionFeedbackCardProps {
  feedback: {
    questionId: string;
    status: string;
    score: number;
    answerFeedback: string;
  };
  maxScore?: number;
}

const QuestionFeedbackCard: React.FC<QuestionFeedbackCardProps> = ({ feedback, maxScore = 5 }) => {
  const { data: questionData } = useQuestionById(feedback.questionId);

  console.log("Question data: ", questionData);
  console.log("Feedback: ",feedback);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CORRECT':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'INCORRECT':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'PARTIAL':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CORRECT':
        return 'default';
      case 'INCORRECT':
        return 'destructive';
      case 'PARTIAL':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(feedback.status)}
            <div>
              <p className="font-medium text-sm text-muted-foreground">
                Question ID: {feedback.questionId.slice(-8)}
              </p>
              {questionData?.text && (
                <p className="font-semibold text-foreground mt-1">
                  {questionData.text.length > 100 
                    ? `${questionData.text.substring(0, 100)}...`
                    : questionData.text
                  }
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <Badge variant={getStatusColor(feedback.status)} className="mb-1">
              {feedback.status}
            </Badge>
            <p className="text-sm font-medium">
              {feedback.score}/{maxScore} points
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-sm font-medium text-muted-foreground mb-1">Feedback:</p>
          <p className="text-sm text-foreground">{feedback.answerFeedback}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const SubmissionDetailsDialog: React.FC<SubmissionDetailsDialogProps> = ({
  isOpen,
  onClose,
  submission
}) => {
  if (!isOpen || !submission) return null;

  const { gradingResult } = submission;
  const percentage = gradingResult?.totalScore && gradingResult?.totalMaxScore 
    ? ((gradingResult.totalScore / gradingResult.totalMaxScore) * 100).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Enhanced Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />
      
      {/* Enhanced Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-card-foreground">Submission Details</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Student Info */}
        <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border">
          <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md">
            <AvatarImage src={"/placeholder.svg"} alt={submission.userId?.firstName} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
              {(submission.userId.firstName?.[0] ?? '').toUpperCase() +(submission.userId.lastName ? submission.userId.lastName[0].toUpperCase() : '')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-card-foreground truncate text-lg">Student : {(submission.userId?.firstName ?? '') + ' ' + (submission.userId?.lastName ?? '')}</p>
            <p className="text-muted-foreground truncate">Attempt ID: {submission.attemptId}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Overall Score</p>
            <div className="flex items-center gap-2">
              <Badge variant={gradingResult?.gradingStatus === 'PASSED' ? 'default' : 'destructive'}>
                {percentage}%
              </Badge>
              <span className="text-sm text-muted-foreground">
                ({gradingResult?.totalScore}/{gradingResult?.totalMaxScore})
              </span>
            </div>
          </div>
        </div>

        {/* Submission Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="font-medium">{new Date(submission.submittedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {gradingResult?.gradingStatus === 'PASSED' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{gradingResult?.gradingStatus}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Graded By</p>
                  <p className="font-medium">{gradingResult?.gradedBy || 'System'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Question-wise Feedback */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Question-wise Feedback</h3>
          <ScrollArea className="max-h-96 pr-4">
            {gradingResult?.overallFeedback?.map((feedback: any, index: number) => (
              <QuestionFeedbackCard 
                key={feedback.questionId || index}
                feedback={feedback}
                maxScore={gradingResult.totalMaxScore / gradingResult.overallFeedback.length} // Approximate max score per question
              />
            )) || (
              <p className="text-center text-muted-foreground py-8">No feedback available</p>
            )}
            {/* Additional Details */}
            {gradingResult?.gradedAt && (
              <div className="p-4 bg-muted/20 rounded-lg mb-5">
                <p className="text-sm text-muted-foreground">
                  Graded on: {new Date(gradingResult.gradedAt).toLocaleString()}
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default SubmissionDetailsDialog;
