import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  BookOpen,
  HelpCircle,
  Settings,
  BarChart3,
  Users,
  Copy,
  RefreshCw
} from "lucide-react";
import {
  useGetAllQuestionBanksForQuiz,
  useQuestionBankById,
  useQuestionById,
  useCreateQuestionBank,
  useAddQuestionBankToQuiz,
  useRemoveQuestionBankFromQuiz,
  useRemoveQuestionFromBank,
  useReplaceQuestionWithDuplicate,
  useDeleteQuestion,
  useUpdateItem
} from '@/hooks/hooks';

interface EnhancedQuizEditorProps {
  quizId: string | null;
  courseId: string;
  courseVersionId: string;
  moduleId: string;
  sectionId: string;
  itemId: string;
  details: any;
  analytics: any;
  submissions: any;
  performance: any;
  results: any;
}

interface QuestionFormData {
  type: string;
  details: any;
}

const QUESTION_TYPES = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'TRUE_FALSE', label: 'True/False' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'FILL_IN_BLANK', label: 'Fill in the Blank' }
];

const EnhancedQuizEditor: React.FC<EnhancedQuizEditorProps> = ({
  quizId,
  courseId,
  courseVersionId,
  moduleId,
  sectionId,
  itemId,
  details,
  analytics,
  submissions,
  performance,
  results
}) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedQuestionBank, setSelectedQuestionBank] = useState<string | null>(null);

  // Dialog states
  const [showCreateBankDialog, setShowCreateBankDialog] = useState(false);
  const [showCreateQuestionDialog, setShowCreateQuestionDialog] = useState(false);
  const [showEditQuestionDialog, setShowEditQuestionDialog] = useState(false);
  const [editQuizSettings, setEditQuizSettings] = useState(false);

  // Form states
  const [bankForm, setBankForm] = useState({ name: '', description: '' });
  const [questionForm, setQuestionForm] = useState<QuestionFormData>({
    type: 'MULTIPLE_CHOICE',
    details: {}
  });
  const [quizSettingsForm, setQuizSettingsForm] = useState({
    name: '',
    description: '',
    passThreshold: 0.7,
    maxAttempts: 3,
    quizType: 'NO_DEADLINE' as 'DEADLINE' | 'NO_DEADLINE',
    approximateTimeToComplete: '00:05:00',
    allowPartialGrading: true,
    allowHint: true,
    showCorrectAnswersAfterSubmission: true,
    showExplanationAfterSubmission: true,
    showScoreAfterSubmission: true,
    questionVisibility: 4,
    releaseTime: '',
    deadline: ''
  });

  // Fetch data
  const { data: questionBanks, refetch: refetchQuestionBanks } = useGetAllQuestionBanksForQuiz(quizId || '');
  const { data: selectedBankData } = useQuestionBankById(selectedQuestionBank || '');

  // Mutations
  const createQuestionBank = useCreateQuestionBank();
  const addQuestionBankToQuiz = useAddQuestionBankToQuiz();
  const removeQuestionBankFromQuiz = useRemoveQuestionBankFromQuiz();
  const removeQuestionFromBank = useRemoveQuestionFromBank();
  const replaceQuestionWithDuplicate = useReplaceQuestionWithDuplicate();
  const deleteQuestion = useDeleteQuestion();
  const updateItem = useUpdateItem();

  // Initialize quiz settings form with existing details
  useEffect(() => {
    if (details) {
      setQuizSettingsForm({
        name: details.name || '',
        description: details.description || '',
        passThreshold: details.details?.passThreshold || 0.7,
        maxAttempts: details.details?.maxAttempts || 3,
        quizType: details.details?.quizType || 'NO_DEADLINE',
        approximateTimeToComplete: details.details?.approximateTimeToComplete || '00:05:00',
        allowPartialGrading: details.details?.allowPartialGrading ?? true,
        allowHint: details.details?.allowHint ?? true,
        showCorrectAnswersAfterSubmission: details.details?.showCorrectAnswersAfterSubmission ?? true,
        showExplanationAfterSubmission: details.details?.showExplanationAfterSubmission ?? true,
        showScoreAfterSubmission: details.details?.showScoreAfterSubmission ?? true,
        questionVisibility: details.details?.questionVisibility || 4,
        releaseTime: details.details?.releaseTime ? new Date(details.details.releaseTime).toISOString().slice(0, 16) : '',
        deadline: details.details?.deadline ? new Date(details.details.deadline).toISOString().slice(0, 16) : ''
      });
    }
  }, [details]);

  const handleSaveQuizSettings = async () => {
    try {
      const quizDetails: any = {
        passThreshold: quizSettingsForm.passThreshold,
        maxAttempts: quizSettingsForm.maxAttempts,
        quizType: quizSettingsForm.quizType,
        approximateTimeToComplete: quizSettingsForm.approximateTimeToComplete,
        allowPartialGrading: quizSettingsForm.allowPartialGrading,
        allowHint: quizSettingsForm.allowHint,
        showCorrectAnswersAfterSubmission: quizSettingsForm.showCorrectAnswersAfterSubmission,
        showExplanationAfterSubmission: quizSettingsForm.showExplanationAfterSubmission,
        showScoreAfterSubmission: quizSettingsForm.showScoreAfterSubmission,
        questionVisibility: quizSettingsForm.questionVisibility,
        releaseTime: quizSettingsForm.releaseTime ? new Date(quizSettingsForm.releaseTime).toISOString() : new Date().toISOString()
      };

      if (quizSettingsForm.deadline) {
        quizDetails.deadline = new Date(quizSettingsForm.deadline).toISOString();
      }

      const requestBody = {
        name: quizSettingsForm.name,
        description: quizSettingsForm.description,
        type: 'QUIZ' as const,
        quizDetails
      };

      await updateItem.mutateAsync({
        params: {
          path: {
            versionId: courseVersionId,
            moduleId,
            sectionId,
            itemId
          }
        },
        body: requestBody
      });

      setEditQuizSettings(false);
      // You might want to add a success notification here
    } catch (error) {
      console.error('Failed to update quiz settings:', error);
      // You might want to add an error notification here
    }
  };

  if (!quizId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No Quiz Selected</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Select a quiz from the sidebar to start editing
          </p>
        </div>
      </div>
    );
  }

  const handleCreateQuestionBank = async () => {
    if (!bankForm.name.trim()) return;

    try {
      const result = await createQuestionBank.mutateAsync({
        body: {
          name: bankForm.name,
          description: bankForm.description,
          courseId,
          courseVersionId,
          questions: []
        }
      });

      // Add the question bank to the quiz
      await addQuestionBankToQuiz.mutateAsync({
        params: { path: { quizId } },
        body: { questionBankId: result.questionBankId }
      });

      setBankForm({ name: '', description: '' });
      setShowCreateBankDialog(false);
      refetchQuestionBanks();
    } catch (error) {
      console.error('Failed to create question bank:', error);
    }
  };

  const handleRemoveQuestionBank = async (questionBankId: string) => {
    try {
      await removeQuestionBankFromQuiz.mutateAsync({
        params: { path: { quizId, questionBankId } }
      });
      refetchQuestionBanks();
      if (selectedQuestionBank === questionBankId) {
        setSelectedQuestionBank(null);
      }
    } catch (error) {
      console.error('Failed to remove question bank:', error);
    }
  };

  const handleCreateQuestion = async () => {
    if (!selectedQuestionBank || !questionForm.type) return;

    try {
      // For now, we'll create a placeholder question
      // This would need to be implemented based on your question creation endpoint
      console.log('Creating question:', questionForm);

      // You would need to add a useCreateQuestion hook that calls POST /questions endpoint
      // await createQuestion.mutateAsync({ body: questionForm });

      setQuestionForm({ type: 'MULTIPLE_CHOICE', details: {} });
      setShowCreateQuestionDialog(false);

      // Show success message
      alert('Question creation would happen here - implement the POST /questions endpoint');
    } catch (error) {
      console.error('Failed to create question:', error);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedQuestionBank) return;

    try {
      await removeQuestionFromBank.mutateAsync({
        params: { path: { questionBankId: selectedQuestionBank, questionId } }
      });
      await deleteQuestion.mutateAsync({
        params: { path: { questionId } }
      });
      // Refetch bank data to update questions list
    } catch (error) {
      console.error('Failed to delete question:', error);
    }
  };

  const renderQuestionForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="questionType">Question Type</Label>
        <Select
          value={questionForm.type}
          onValueChange={(value) => setQuestionForm({ ...questionForm, type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="questionText">Question Text</Label>
        <Textarea
          id="questionText"
          placeholder="Enter your question here..."
          value={questionForm.details.questionText || ''}
          onChange={(e) => setQuestionForm({
            ...questionForm,
            details: { ...questionForm.details, questionText: e.target.value }
          })}
        />
      </div>

      {questionForm.type === 'MULTIPLE_CHOICE' && (
        <div>
          <Label>Answer Options</Label>
          <div className="space-y-2">
            {[0, 1, 2, 3].map(index => (
              <Input
                key={index}
                placeholder={`Option ${index + 1}`}
                value={questionForm.details.options?.[index] || ''}
                onChange={(e) => {
                  const options = [...(questionForm.details.options || ['', '', '', ''])];
                  options[index] = e.target.value;
                  setQuestionForm({
                    ...questionForm,
                    details: { ...questionForm.details, options }
                  });
                }}
              />
            ))}
          </div>
          <div className="mt-2">
            <Label htmlFor="correctAnswer">Correct Answer Index (0-3)</Label>
            <Input
              id="correctAnswer"
              type="number"
              min="0"
              max="3"
              value={questionForm.details.correctAnswer || ''}
              onChange={(e) => setQuestionForm({
                ...questionForm,
                details: { ...questionForm.details, correctAnswer: parseInt(e.target.value) }
              })}
            />
          </div>
        </div>
      )}

      {questionForm.type === 'TRUE_FALSE' && (
        <div>
          <Label htmlFor="trueFalseAnswer">Correct Answer</Label>
          <Select
            value={questionForm.details.correctAnswer?.toString() || ''}
            onValueChange={(value) => setQuestionForm({
              ...questionForm,
              details: { ...questionForm.details, correctAnswer: value === 'true' }
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select correct answer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="points">Points</Label>
        <Input
          id="points"
          type="number"
          min="1"
          value={questionForm.details.points || ''}
          onChange={(e) => setQuestionForm({
            ...questionForm,
            details: { ...questionForm.details, points: parseInt(e.target.value) }
          })}
        />
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="border-b">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{details?.name || 'Quiz Editor'}</h1>
              <p className="text-muted-foreground">{details?.description || 'Manage your quiz content and analytics'}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditQuizSettings(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Edit Quiz Settings Dialog */}
        <Dialog open={editQuizSettings} onOpenChange={setEditQuizSettings}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quiz Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="quizName">Quiz Name</Label>
                    <Input
                      id="quizName"
                      value={quizSettingsForm.name}
                      onChange={(e) => setQuizSettingsForm({ ...quizSettingsForm, name: e.target.value })}
                      placeholder="Enter quiz name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quizDescription">Description</Label>
                    <Textarea
                      id="quizDescription"
                      value={quizSettingsForm.description}
                      onChange={(e) => setQuizSettingsForm({ ...quizSettingsForm, description: e.target.value })}
                      placeholder="Enter quiz description"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Quiz Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Quiz Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="passThreshold">Pass Threshold (%)</Label>
                    <Input
                      id="passThreshold"
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round(quizSettingsForm.passThreshold * 100)}
                      onChange={(e) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        passThreshold: parseInt(e.target.value) / 100
                      })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum percentage required to pass (0-100%)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="maxAttempts">Max Attempts</Label>
                    <Input
                      id="maxAttempts"
                      type="number"
                      min="-1"
                      value={quizSettingsForm.maxAttempts}
                      onChange={(e) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        maxAttempts: parseInt(e.target.value)
                      })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum attempts allowed (-1 for unlimited)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="quizType">Quiz Type</Label>
                    <Select
                      value={quizSettingsForm.quizType}
                      onValueChange={(value: 'DEADLINE' | 'NO_DEADLINE') =>
                        setQuizSettingsForm({ ...quizSettingsForm, quizType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NO_DEADLINE">No Deadline</SelectItem>
                        <SelectItem value="DEADLINE">With Deadline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="approximateTime">Approximate Time (HH:MM:SS)</Label>
                    <Input
                      id="approximateTime"
                      value={quizSettingsForm.approximateTimeToComplete}
                      onChange={(e) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        approximateTimeToComplete: e.target.value
                      })}
                      placeholder="00:30:00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="questionVisibility">Questions Visible to Students</Label>
                    <Input
                      id="questionVisibility"
                      type="number"
                      min="1"
                      value={quizSettingsForm.questionVisibility}
                      onChange={(e) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        questionVisibility: parseInt(e.target.value)
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Time Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Time Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="releaseTime">Release Time</Label>
                    <Input
                      id="releaseTime"
                      type="datetime-local"
                      value={quizSettingsForm.releaseTime}
                      onChange={(e) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        releaseTime: e.target.value
                      })}
                    />
                  </div>
                  {quizSettingsForm.quizType === 'DEADLINE' && (
                    <div>
                      <Label htmlFor="deadline">Deadline</Label>
                      <Input
                        id="deadline"
                        type="datetime-local"
                        value={quizSettingsForm.deadline}
                        onChange={(e) => setQuizSettingsForm({
                          ...quizSettingsForm,
                          deadline: e.target.value
                        })}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Student Experience */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Student Experience</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allowPartialGrading">Allow Partial Grading</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable partial credit for multi-select questions
                      </p>
                    </div>
                    <Switch
                      id="allowPartialGrading"
                      checked={quizSettingsForm.allowPartialGrading}
                      onCheckedChange={(checked) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        allowPartialGrading: checked
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allowHint">Allow Hints</Label>
                      <p className="text-xs text-muted-foreground">
                        Let students see hints for questions
                      </p>
                    </div>
                    <Switch
                      id="allowHint"
                      checked={quizSettingsForm.allowHint}
                      onCheckedChange={(checked) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        allowHint: checked
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="showCorrectAnswers">Show Correct Answers</Label>
                      <p className="text-xs text-muted-foreground">
                        Display correct answers after submission
                      </p>
                    </div>
                    <Switch
                      id="showCorrectAnswers"
                      checked={quizSettingsForm.showCorrectAnswersAfterSubmission}
                      onCheckedChange={(checked) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        showCorrectAnswersAfterSubmission: checked
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="showExplanations">Show Explanations</Label>
                      <p className="text-xs text-muted-foreground">
                        Display explanations after submission
                      </p>
                    </div>
                    <Switch
                      id="showExplanations"
                      checked={quizSettingsForm.showExplanationAfterSubmission}
                      onCheckedChange={(checked) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        showExplanationAfterSubmission: checked
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="showScore">Show Score</Label>
                      <p className="text-xs text-muted-foreground">
                        Display score immediately after submission
                      </p>
                    </div>
                    <Switch
                      id="showScore"
                      checked={quizSettingsForm.showScoreAfterSubmission}
                      onCheckedChange={(checked) => setQuizSettingsForm({
                        ...quizSettingsForm,
                        showScoreAfterSubmission: checked
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditQuizSettings(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveQuizSettings}
                disabled={updateItem.isPending}
              >
                {updateItem.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="px-6">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="submissions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Submissions
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsContent value="overview" className="h-full m-0">
            <div className="p-6 space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Submissions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.submissions ?? 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {results && results.length > 0 ? `${((results.filter((r: any) => r.status === 'PASSED').length / results.length) * 100).toFixed(1)}%` : '0%'}
                    <Progress value={results && results.length > 0 ? ((results.filter((r: any) => r.status === 'PASSED').length / results.length) * 100) : 0} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.averageScore?.toFixed(1) ?? 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
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
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions?.submissions?.slice(0, 5).map((sub: any) => (
                        <TableRow key={sub._id}>
                          <TableCell className="font-medium">{sub.userId}</TableCell>
                          <TableCell>{sub.gradingResult?.totalScore ?? 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={sub.gradingResult?.totalScore >= 70 ? 'default' : 'destructive'}>
                              {sub.gradingResult?.totalScore >= 70 ? 'Pass' : 'Fail'}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(sub.submittedAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      )) || (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              No submissions yet
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="questions" className="h-full m-0">
            <div className="h-full flex">
              {/* Question Banks Sidebar */}
              <div className="w-80 border-r bg-muted/50">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Question Banks</h3>
                    <Dialog open={showCreateBankDialog} onOpenChange={setShowCreateBankDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Question Bank</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="bankName">Name</Label>
                            <Input
                              id="bankName"
                              value={bankForm.name}
                              onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                              placeholder="Enter bank name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="bankDescription">Description</Label>
                            <Textarea
                              id="bankDescription"
                              value={bankForm.description}
                              onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })}
                              placeholder="Enter bank description"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                          <Button variant="outline" onClick={() => setShowCreateBankDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreateQuestionBank} disabled={createQuestionBank.isPending}>
                            {createQuestionBank.isPending ? 'Creating...' : 'Create'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="p-4 space-y-2">
                    {questionBanks?.questionBanks?.map((bank: any) => (
                      <Card
                        key={bank.questionBankId}
                        className={`cursor-pointer transition-colors hover:bg-accent ${selectedQuestionBank === bank.questionBankId ? 'border-primary bg-accent' : ''
                          }`}
                        onClick={() => setSelectedQuestionBank(bank.questionBankId)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">Bank {bank.questionBankId.slice(-8)}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveQuestionBank(bank.questionBankId);
                              }}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {bank.questionsCount || 0} questions
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {(!questionBanks?.questionBanks || questionBanks.questionBanks.length === 0) && (
                      <div className="text-center text-muted-foreground py-8">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No question banks</p>
                        <p className="text-xs">Create one to get started</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Questions Content */}
              <div className="flex-1">
                {selectedQuestionBank ? (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">Questions</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedBankData?.questions?.length || 0} questions in this bank
                          </p>
                        </div>
                        <Dialog open={showCreateQuestionDialog} onOpenChange={setShowCreateQuestionDialog}>
                          <DialogTrigger asChild>
                            <Button>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Question
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Create Question</DialogTitle>
                            </DialogHeader>
                            {renderQuestionForm()}
                            <div className="flex justify-end gap-2 mt-6">
                              <Button variant="outline" onClick={() => setShowCreateQuestionDialog(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleCreateQuestion}>
                                Create Question
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-4">
                        {selectedBankData?.questions?.map((questionId: string) => (
                          <QuestionCard
                            key={questionId}
                            questionId={questionId}
                            onEdit={() => {
                              // You can implement edit functionality here  
                              setShowEditQuestionDialog(true);
                            }}
                            onDelete={() => handleDeleteQuestion(questionId)}
                            onDuplicate={() => replaceQuestionWithDuplicate.mutateAsync({
                              params: { path: { questionBankId: selectedQuestionBank, questionId } }
                            })}
                          />
                        ))}

                        {(!selectedBankData?.questions || selectedBankData.questions.length === 0) && (
                          <div className="text-center text-muted-foreground py-12">
                            <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <h3 className="font-medium mb-2">No questions yet</h3>
                            <p className="text-sm mb-4">Add your first question to get started</p>
                            <Button onClick={() => setShowCreateQuestionDialog(true)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Create Question
                            </Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-muted-foreground">Select a Question Bank</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        Choose a question bank to view and edit questions
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Question Dialog */}
            <Dialog open={showEditQuestionDialog} onOpenChange={setShowEditQuestionDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Question</DialogTitle>
                </DialogHeader>
                {renderQuestionForm()}
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setShowEditQuestionDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    // Handle update logic
                    setShowEditQuestionDialog(false);
                  }}>
                    Update Question
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="analytics" className="h-full m-0">
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          performance.map((p: any) => (
                            <TableRow key={p.questionId}>
                              <TableCell>{p.questionId.slice(-8)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{(p.correctRate * 100).toFixed(1)}%</span>
                                  <Progress value={p.correctRate * 100} className="w-20" />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center">No performance data available</TableCell>
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
                          results.map((r: any) => (
                            <TableRow key={r.attemptId}>
                              <TableCell>{r.studentId}</TableCell>
                              <TableCell>{r.score}</TableCell>
                              <TableCell>
                                <Badge variant={r.status === 'PASSED' ? 'default' : 'destructive'}>
                                  {r.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center">No results available</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="h-full m-0">
            <div className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Submissions</CardTitle>
                  <CardDescription>
                    Detailed view of all quiz submissions with grading information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Total Questions</TableHead>
                        <TableHead>Correct Answers</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions?.submissions?.map((sub: any) => (
                        <TableRow key={sub._id}>
                          <TableCell className="font-medium">{sub.userId}</TableCell>
                          <TableCell>
                            <Badge variant={sub.gradingResult?.totalScore >= 70 ? 'default' : 'destructive'}>
                              {sub.gradingResult?.totalScore ?? 'N/A'}%
                            </Badge>
                          </TableCell>
                          <TableCell>{sub.gradingResult?.totalQuestions ?? 'N/A'}</TableCell>
                          <TableCell>{sub.gradingResult?.correctAnswers ?? 'N/A'}</TableCell>
                          <TableCell>{new Date(sub.submittedAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )) || (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No submissions yet
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Question Card Component
interface QuestionCardProps {
  questionId: string;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ questionId, onEdit, onDelete, onDuplicate }) => {
  const { data: question } = useQuestionById(questionId);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{question?.type || 'Unknown'}</Badge>
              <span className="text-xs text-muted-foreground">ID: {questionId.slice(-8)}</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {question?.details?.questionText || 'Question text not available'}
            </p>
          </div>
          <div className="flex gap-1 ml-4">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedQuizEditor;
