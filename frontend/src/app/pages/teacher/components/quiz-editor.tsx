import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { components } from '@/types/schema';

interface QuizEditorProps {
  quizId: string | null;
  details: import('@/hooks/hooks').QuizDetailsResponse | undefined;
  analytics: import('@/hooks/hooks').QuizAnalyticsResponse | undefined;
  submissions: import('@/hooks/hooks').GetAllSubmissionsResponse | undefined;
  performance: import('@/hooks/hooks').QuizPerformanceResponse[] | undefined;
  results: import('@/hooks/hooks').QuizResultsResponse[] | undefined;
}

const QuizEditor: React.FC<QuizEditorProps> = ({ quizId, details, analytics, submissions, performance, results }) => {
  if (!quizId) {
    return <div className="text-center text-muted-foreground">Select a quiz to see its details and analytics.</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{details?.name || 'Quiz Details'}</CardTitle>
          <CardDescription>{details?.description || 'No description available.'}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.totalAttempts ?? 'N/A'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.submissions ?? 'N/A'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.passRate?.toFixed(2) ?? 'N/A'}%</p>
            <Progress value={analytics?.passRate} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.averageScore?.toFixed(2) ?? 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Submitted At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions?.submissions && submissions.submissions.length > 0 ? (
                submissions.submissions.map((sub) => (
                  <TableRow key={sub._id}>
                    <TableCell>{sub.userId}</TableCell>
                    <TableCell>{sub.gradingResult?.totalScore ?? 'N/A'}</TableCell>
                    <TableCell>{new Date(sub.submittedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">No submissions yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Question Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question ID</TableHead>
                  <TableHead>Correct Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performance && performance.length > 0 ? (
                  performance.map((p) => (
                    <TableRow key={p.questionId}>
                      <TableCell>{p.questionId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{(p.correctRate * 100).toFixed(2)}%</span>
                          <Progress value={p.correctRate * 100} className="w-24" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center">No performance data available.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results && results.length > 0 ? (
                  results.map((r) => (
                    <TableRow key={r.attemptId}>
                      <TableCell>{r.studentId}</TableCell>
                      <TableCell>{r.score}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'PASS' ? 'default' : 'destructive'}>{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">No results available.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuizEditor;