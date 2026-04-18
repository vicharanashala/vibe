// Component to display quiz submission details
"use client"
import { CheckCircle, FileText, Loader2, Clock, Award, Target } from 'lucide-react'

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card } from "@/components/ui/card"

// Import hooks - including the new quiz hooks
import {
  useUserQuizMetrics,
  useQuizSubmission,
} from "@/hooks/hooks"
import { useState } from "react"

// Types for quiz functionality
interface IAttemptDetails {
  attemptId: string;
  submissionResultId?: string;
}

interface UserQuizMetricsResponse {
  _id?: string;
  quizId: string;
  userId: string;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';
  latestAttemptId?: string;
  latestSubmissionResultId?: string;
  remainingAttempts: number;
  attempts: IAttemptDetails[];
}

interface IQuestionAnswerFeedback {
  questionId: string;
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
  score: number;
  answerFeedback?: string;
}

interface IGradingResult {
  totalScore?: number;
  totalMaxScore?: number;
  overallFeedback?: IQuestionAnswerFeedback[];
  gradingStatus: 'PENDING' | 'PASSED' | 'FAILED' | any;
  gradedAt?: string;
  gradedBy?: string;
}

interface QuizSubmissionResponse {
  _id?: string;
  quizId: string;
  userId: string;
  attemptId: string;
  submittedAt: string;
  gradingResult?: IGradingResult;
}

interface QuizSubmissionDisplayProps {
  userId: string;
  quizId: string;
  itemName?: string;
}

export function QuizSubmissionDisplay({ userId, quizId, itemName }: QuizSubmissionDisplayProps) {
  // State to track selected submission result id
  const [selectedSubmissionResultId, setSelectedSubmissionResultId] = useState<string | undefined>(undefined)

  // First, get quiz metrics to find the latest submission result ID
  const { data: quizMetrics, isLoading: metricsLoading, error: metricsError } = useUserQuizMetrics(quizId, userId)
  // Set default selected submission result id to latest on load
  const latestSubmissionResultId = quizMetrics?.latestSubmissionResultId

  // If user hasn't selected, show latest by default
  const activeSubmissionResultId = selectedSubmissionResultId || latestSubmissionResultId || ""

  // Then get submission details using the selected submission result ID
  const {
    data: submissionData,
    isLoading: submissionLoading,
    error: submissionError
  } = useQuizSubmission(
    quizId,
    activeSubmissionResultId
  )

  if (metricsLoading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading quiz metrics...</span>
      </div>
    )
  }

  if (metricsError) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">Error loading quiz metrics: {metricsError}</p>
      </div>
    )
  }

  if (!quizMetrics) {
    return (
      <div className="p-4 bg-muted/20 rounded-lg">
        <p className="text-sm text-muted-foreground">No quiz attempt data available.</p>
      </div>
    )
  }

  const displayName = itemName && itemName.trim() !== "" ? itemName : "Quiz 1"

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Submitted</Badge>
      case 'ATTEMPTED':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">In Progress</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getGradingStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Passed</Badge>
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Award className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-foreground">Quiz Submission Details</h4>
      </div>

      {/* Quiz Info Header */}
      <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">❓</span>
          <div className="flex-1">
            <h5 className="font-semibold text-foreground">{displayName}</h5>
            <p className="text-sm text-muted-foreground">
              {quizMetrics.attempts.length} {quizMetrics.attempts.length === 1 ? "attempt" : "attempts"} • {quizMetrics.remainingAttempts} remaining
            </p>
          </div>
          {getStatusBadge(quizMetrics.latestAttemptStatus)}
        </div>
      </div>

      {/* Quiz Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Total Attempts</span>
          </div>
          <p className="text-2xl font-bold mt-1">{quizMetrics.attempts.length}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Remaining</span>
          </div>
          <p className="text-2xl font-bold mt-1">{quizMetrics.remainingAttempts}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium">Status</span>
          </div>
          <div className="mt-1">
            {getStatusBadge(quizMetrics.latestAttemptStatus)}
          </div>
        </Card>
      </div>

      {/* Submission Details for selected attempt */}
      {activeSubmissionResultId && (
        <div className="space-y-4">
          <Separator />
          <h6 className="font-medium text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Submission Details
            {quizMetrics?.attempts && quizMetrics.attempts.length > 1 && (
              <span className="ml-2 text-xs text-muted-foreground">(Click an attempt below to view its stats)</span>
            )}
          </h6>

          {submissionLoading ? (
            <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading submission details...</span>
            </div>
          ) : submissionError ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">Error loading submission: {submissionError}</p>
            </div>
          ) : submissionData ? (
            <div className="space-y-4">
              {/* Submission Info */}
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Submitted At</p>
                    <p className="font-semibold">
                      {(() => {
                        const { date, time } = formatDateTime(submissionData.submittedAt)
                        return `${date} at ${time}`
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Attempt ID</p>
                    <p className="font-mono text-sm">{submissionData.attemptId}</p>
                  </div>
                </div>
              </div>

              {/* Grading Results */}
              {submissionData.gradingResult && (
                <div className="p-4 bg-card border border-border rounded-lg">
                  <h6 className="font-semibold mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Grading Results
                  </h6>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Score</p>
                      <p className="text-xl font-bold">
                        {submissionData.gradingResult.totalScore || 0} / {submissionData.gradingResult.totalMaxScore || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Percentage</p>
                      <p className="text-xl font-bold">
                        {submissionData.gradingResult.totalMaxScore
                          ? Math.round(((submissionData.gradingResult.totalScore || 0) / submissionData.gradingResult.totalMaxScore) * 100)
                          : 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <div className="mt-1">
                        {getGradingStatusBadge(submissionData.gradingResult.gradingStatus)}
                      </div>
                    </div>
                    {submissionData.gradingResult.gradedAt && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Graded At</p>
                        <p className="text-sm">
                          {(() => {
                            const { date, time } = formatDateTime(submissionData.gradingResult.gradedAt!)
                            return `${date} ${time}`
                          })()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Question Feedback */}
                  {submissionData.gradingResult.overallFeedback && submissionData.gradingResult.overallFeedback.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="font-medium text-sm">Question Feedback</h6>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {submissionData.gradingResult.overallFeedback.map((feedback, index) => (
                          <div key={feedback.questionId} className="p-3 bg-muted/20 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">Question {index + 1}</span>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={feedback.status === 'CORRECT' ? 'default' : feedback.status === 'PARTIAL' ? 'secondary' : 'destructive'}
                                  className="text-xs"
                                >
                                  {feedback.status}
                                </Badge>
                                <span className="text-sm font-bold">{feedback.score} pts</span>
                              </div>
                            </div>
                            {feedback.answerFeedback && (
                              <p className="text-xs text-muted-foreground">{feedback.answerFeedback}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-muted/20 rounded-lg">
              <p className="text-sm text-muted-foreground">No submission details available.</p>
            </div>
          )}
        </div>
      )}

      {/* All Attempts History - Clickable for submitted attempts */}
      {quizMetrics.attempts.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <h6 className="font-medium text-foreground">All Attempts</h6>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {quizMetrics.attempts.map((attempt, index) => {
              const isSelected = submissionData && submissionData.attemptId === attempt.attemptId
              const isSubmitted = Boolean(attempt.submissionResultId)
              return (
                <div
                  key={attempt.attemptId}
                  className={`p-3 bg-card border border-border rounded-lg transition cursor-pointer relative ${
                    isSubmitted ? 'hover:bg-primary/10' : 'opacity-60 cursor-not-allowed'
                  } ${isSelected ? 'bg-primary/10 border-primary shadow-md' : ''}`}
                  onClick={() => {
                    if (isSubmitted && attempt.submissionResultId) {
                      setSelectedSubmissionResultId(attempt.submissionResultId.toString())
                    }
                  }}
                  tabIndex={isSubmitted ? 0 : -1}
                  aria-disabled={!isSubmitted}
                  style={{ pointerEvents: isSubmitted ? 'auto' : 'none' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Attempt {index + 1}</p>
                        <p className="text-sm text-muted-foreground">ID: {attempt.attemptId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isSubmitted ? (
                        <Badge variant="outline" className="text-xs">
                          Submitted
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not Submitted</Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}