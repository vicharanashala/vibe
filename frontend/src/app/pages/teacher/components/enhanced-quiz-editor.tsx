import React, { useState, useEffect, use } from 'react';
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
  Trash2,
  Eye,
  BookOpen,
  HelpCircle,
  Settings,
  BarChart3,
  Users,
  RefreshCw,
} from "lucide-react";
import {
  useGetAllQuestionBanksForQuiz,
  useQuestionBankById,
  useCreateQuestionBank,
  useAddQuestionBankToQuiz,
  useRemoveQuestionBankFromQuiz,
  useRemoveQuestionFromBank,
  useReplaceQuestionWithDuplicate,
  useDeleteQuestion,
  useUpdateItem,
  useQuestionById
} from '@/hooks/hooks';

import ExpandableQuestionCard from './expandable-question-card';
import SubmissionDetailsDialog from './submission-details-dialog';
import CreateQuestionDialog from './CreateQuestion';
import CreateQuestionBankDialog from './CreateQuestionBank';

interface EnhancedQuizEditorProps {
  quizId: string | null;
  courseId: string;
  courseVersionId: string;
  moduleId: string;
  sectionId: string;
  details: any;
  analytics: any;
  submissions: any;
  performance: any;
}

interface QuestionFormData {
  question: {
    text: string;
    type: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'ORDER_THE_LOTS' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE';
    isParameterized: boolean;
    parameters?: Array<{
      name: string;
      possibleValues: string[];
      type: 'number' | 'string';
    }>;
    hint?: string;
    timeLimitSeconds: number;
    points: number;
  };
  solution: any; // This would be the appropriate solution type based on question type
}

const QUESTION_TYPES = [
  { value: 'SELECT_ONE_IN_LOT', label: 'Single Choice' },
  { value: 'SELECT_MANY_IN_LOT', label: 'Multiple Choice' },
  { value: 'ORDER_THE_LOTS', label: 'Order The Items' },
  { value: 'NUMERIC_ANSWER_TYPE', label: 'Numeric Answer' },
  { value: 'DESCRIPTIVE', label: 'Descriptive Answer' }
];

// Question Performance Row Component
interface QuestionPerformanceRowProps {
  performance: {
    questionId: string;
    correctRate: number;
  };
}

const QuestionPerformanceRow: React.FC<QuestionPerformanceRowProps> = ({ performance }) => {
  const { data: questionData } = useQuestionById(performance.questionId);

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <p className="font-medium text-sm text-muted-foreground">
            ID: {performance.questionId.slice(-8)}
          </p>
          {questionData?.text ? (
            <p className="text-sm">
              {questionData.text.length > 100 
                ? `${questionData.text.substring(0, 100)}...`
                : questionData.text
              }
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Loading question...</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{(performance.correctRate * 100).toFixed(1)}%</span>
          <Progress value={performance.correctRate * 100} className="w-20" />
        </div>
      </TableCell>
    </TableRow>
  );
};

// Utility function to calculate performance from submissions
const calculatePerformanceFromSubmissions = (submissions: any[]): { questionId: string; correctRate: number }[] => {
  if (!submissions || submissions.length === 0) return [];

  const questionStats: Record<string, { correct: number; total: number }> = {};

  submissions.forEach(submission => {
    submission.gradingResult?.overallFeedback?.forEach((feedback: any) => {
      const questionId = feedback.questionId;
      if (!questionStats[questionId]) {
        questionStats[questionId] = { correct: 0, total: 0 };
      }
      questionStats[questionId].total++;
      if (feedback.status === 'CORRECT') {
        questionStats[questionId].correct++;
      }
    });
  });

  return Object.entries(questionStats).map(([questionId, stats]) => ({
    questionId,
    correctRate: stats.total > 0 ? stats.correct / stats.total : 0
  }));
};

const EnhancedQuizEditor: React.FC<EnhancedQuizEditorProps> = ({
  quizId,
  courseId,
  courseVersionId,
  moduleId,
  sectionId,
  details,
  analytics,
  submissions,
  performance
}) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedQuestionBank, setSelectedQuestionBank] = useState<string | null>(null);

  // Dialog states
  const [showCreateBankDialog, setShowCreateBankDialog] = useState(false);
  const [showCreateQuestionDialog, setShowCreateQuestionDialog] = useState(false);
  const [showEditQuestionDialog, setShowEditQuestionDialog] = useState(false);
  const [editQuizSettings, setEditQuizSettings] = useState(false);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  // Form states
  const [bankForm, setBankForm] = useState({ title: '', description: '' });
  const [questionForm, setQuestionForm] = useState<QuestionFormData>({
    question: {
      text: '',
      type: 'SELECT_ONE_IN_LOT',
      isParameterized: false,
      timeLimitSeconds: 60,
      points: 1
    },
    solution: {}
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
  const { data: selectedBankData, refetch: refetchSelectedBank } = useQuestionBankById(selectedQuestionBank || '');

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
            itemId: quizId || ''
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
    if (!bankForm.title.trim()) return;

    try {
      const result = await createQuestionBank.mutateAsync({
        body: {
          title: bankForm.title,
          description: bankForm.description,
          courseId,
          courseVersionId,
          questions: []
        }
      });

      // Add the question bank to the quiz
      await addQuestionBankToQuiz.mutateAsync({
        params: { path: { quizId } },
        body: { 
          bankId: result.questionBankId,
          questionBankId: result.questionBankId,
          count: 10 // Default count
        }
      });

      setBankForm({ title: '', description: '' });
      setShowCreateBankDialog(false);
      refetchQuestionBanks();
    } catch (error) {
      console.error('Failed to create question bank:', error);
    }
  };

  const handleRemoveQuestionBank = async (bankId: string) => {
    try {
      await removeQuestionBankFromQuiz.mutateAsync({
        params: { path: { quizId, questionBankId: bankId } }
      });
      refetchQuestionBanks();
      if (selectedQuestionBank === bankId) {
        setSelectedQuestionBank(null);
      }
    } catch (error) {
      console.error('Failed to remove question bank:', error);
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
      refetchSelectedBank();
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
          value={questionForm.question.type}
          onValueChange={(value: QuestionFormData['question']['type']) => 
            setQuestionForm({ 
              ...questionForm, 
              question: { ...questionForm.question, type: value }
            })
          }
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
          value={questionForm.question.text || ''}
          onChange={(e) => setQuestionForm({
            ...questionForm,
            question: { ...questionForm.question, text: e.target.value }
          })}
        />
      </div>

      {/* Hint field for all question types */}
      <div>
        <Label htmlFor="hint">Hint (Optional)</Label>
        <Textarea
          id="hint"
          placeholder="Enter a hint for this question..."
          value={questionForm.question.hint || ''}
          onChange={(e) => setQuestionForm({
            ...questionForm,
            question: { ...questionForm.question, hint: e.target.value }
          })}
        />
      </div>

      {(questionForm.question.type === 'SELECT_ONE_IN_LOT' || questionForm.question.type === 'SELECT_MANY_IN_LOT') && (
        <div>
          <Label>Answer Options</Label>
          <div className="space-y-2">
            {(questionForm.solution?.incorrectLotItems || []).concat(questionForm.solution?.correctLotItems || [questionForm.solution?.correctLotItem].filter(Boolean) || []).map((item: any, index: number) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Option ${index + 1}`}
                  value={item.text || ''}
                  onChange={(e) => {
                    // Handle lot item updates based on question type
                    const newValue = { ...item, text: e.target.value };
                    if (questionForm.question.type === 'SELECT_ONE_IN_LOT') {
                      if (index === 0) {
                        setQuestionForm({
                          ...questionForm,
                          solution: { ...questionForm.solution, correctLotItem: newValue }
                        });
                      } else {
                        const incorrectItems = [...(questionForm.solution?.incorrectLotItems || [])];
                        incorrectItems[index - 1] = newValue;
                        setQuestionForm({
                          ...questionForm,
                          solution: { ...questionForm.solution, incorrectLotItems: incorrectItems }
                        });
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Handle removing lot items
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Handle adding new lot items
                const newItem = { text: '', explaination: '' };
                if (questionForm.question.type === 'SELECT_ONE_IN_LOT') {
                  const incorrectItems = [...(questionForm.solution?.incorrectLotItems || []), newItem];
                  setQuestionForm({
                    ...questionForm,
                    solution: { ...questionForm.solution, incorrectLotItems: incorrectItems }
                  });
                }
              }}
            >
              Add Option
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="points">Points</Label>
          <Input
            id="points"
            type="number"
            min="1"
            value={questionForm.question.points || ''}
            onChange={(e) => setQuestionForm({
              ...questionForm,
              question: { ...questionForm.question, points: parseInt(e.target.value) }
            })}
          />
        </div>
        <div>
          <Label htmlFor="timeLimit">Time Limit (seconds)</Label>
          <Input
            id="timeLimit"
            type="number"
            min="1"
            value={questionForm.question.timeLimitSeconds || ''}
            onChange={(e) => setQuestionForm({
              ...questionForm,
              question: { ...questionForm.question, timeLimitSeconds: parseInt(e.target.value) }
            })}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isParameterized"
          checked={questionForm.question.isParameterized || false}
          onChange={(e) => setQuestionForm({
            ...questionForm,
            question: { ...questionForm.question, isParameterized: e.target.checked }
          })}
        />
        <Label htmlFor="isParameterized">Is Parameterized</Label>
      </div>
    </div>
  );

  // Initialize question bank selection
  useEffect(() => {
    if (questionBanks && questionBanks?.length > 0 && !selectedQuestionBank) {
      setSelectedQuestionBank(questionBanks[0].bankId);
    }
  }, [questionBanks]);

  useEffect(() => {
    if (!showCreateQuestionDialog) {
      refetchSelectedBank(); // Refetch selected bank data when dialog is closed
    }
  }, [showCreateQuestionDialog]);
  useEffect(() => {
    if (!showCreateBankDialog) {
      refetchQuestionBanks();
    }
  }, [showCreateBankDialog]);

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <div className="text-2xl font-bold">
                      {submissions && submissions?.length > 0 ? `${((submissions.filter((r: any) => r.gradingResult?.gradingStatus === 'PASSED')?.length / submissions?.length) * 100).toFixed(1)}%` : '0%'}
                    </div>
                    <Progress value={submissions && submissions?.length > 0 ? ((submissions.filter((r: any) => r.gradingResult?.gradingStatus === 'PASSED')?.length / submissions?.length) * 100) : 0} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Average Score %</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {submissions && submissions.length > 0 
                        ? `${(submissions.reduce((acc: number, sub: any) => {
                            if (sub.gradingResult?.totalScore && sub.gradingResult?.totalMaxScore) {
                              return acc + (sub.gradingResult.totalScore / sub.gradingResult.totalMaxScore * 100);
                            }
                            return acc;
                          }, 0) / submissions.length).toFixed(1)}%`
                        : '0%'}
                    </div>
                    <Progress value={submissions && submissions.length > 0 
                      ? parseFloat((submissions.reduce((acc: number, sub: any) => {
                          if (sub.gradingResult?.totalScore && sub.gradingResult?.totalMaxScore) {
                            return acc + (sub.gradingResult.totalScore / sub.gradingResult.totalMaxScore * 100);
                          }
                          return acc;
                        }, 0) / submissions.length).toFixed(1))
                      : 0} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {submissions && submissions.length > 0 
                        ? `${(submissions.reduce((acc: number, sub: any) => {
                            if (sub.gradingResult?.totalScore && sub.gradingResult?.totalMaxScore) {
                              return acc + sub.gradingResult.totalScore;
                            }
                            return acc;
                          }, 0) / submissions.length).toFixed(1)} `
                        : 'Loading...'}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="questions" className="h-full m-0">
            <div className="h-full flex">
              {/* Question Banks Sidebar */}
              <div className="w-80 border-r bg-muted/50">
                <CreateQuestionBankDialog
                  showCreateBankDialog={showCreateBankDialog}
                  setShowCreateBankDialog={setShowCreateBankDialog}
                  quizId={quizId}
                />
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="p-4 space-y-2">
                    {questionBanks?.map((bank: any) => (
                      <Card
                        key={bank.bankId}
                        className={`cursor-pointer transition-colors hover:bg-accent ${selectedQuestionBank === bank.bankId ? 'border-primary bg-accent/40' : ''
                          }`}
                        onClick={() => setSelectedQuestionBank(bank.bankId)}
                      >
                        <CardContent className="px-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium text-md font-semibold ">Bank {bank.bankId.slice(-8)}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveQuestionBank(bank.bankId);
                              }}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {bank.count || 0} questions selected
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {(!questionBanks || questionBanks?.length === 0) && (
                      <div className="text-center text-muted-foreground py-8">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-md">No question banks</p>
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
                    <CreateQuestionDialog
                      showCreateQuestionDialog={showCreateQuestionDialog}
                      setShowCreateQuestionDialog={setShowCreateQuestionDialog}
                      selectedBankId={selectedQuestionBank}
                    />
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-4">
                        {selectedBankData?.questions?.map((questionId: string) => (
                          <ExpandableQuestionCard
                            key={questionId}
                            questionId={questionId}
                            onDelete={() => handleDeleteQuestion(questionId)}
                            onDuplicate={() => replaceQuestionWithDuplicate.mutateAsync({
                              params: { path: { questionBankId: selectedQuestionBank, questionId } }
                            })}
                          />
                        ))}

                        {(!selectedBankData?.questions || selectedBankData.questions?.length === 0) && (
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
                          <TableHead>Question</TableHead>
                          <TableHead>Correct Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const performanceData = performance && performance.length > 0 
                            ? performance 
                            : calculatePerformanceFromSubmissions(submissions || []);
                          
                          return performanceData?.length > 0 ? (
                            performanceData.map((p: any) => (
                              <QuestionPerformanceRow key={p.questionId} performance={p} />
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center">No performance data available</TableCell>
                            </TableRow>
                          );
                        })()}
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
                        {submissions && submissions?.length > 0 ? (
                          submissions.map((r: any) => (
                            <TableRow key={r._id}>
                              <TableCell>{r.userId}</TableCell>
                              <TableCell>{r.gradingResult?.totalScore?.toFixed(2) ?? 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant={r.gradingResult?.gradingStatus === 'PASSED' ? 'default' : 'destructive'}>
                                  {r.gradingResult?.gradingStatus ?? 'N/A'}
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
                        <TableHead>Max Score</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions?.map((sub: any) => (
                        <TableRow key={sub._id}>
                          <TableCell className="font-medium">{sub.userId}</TableCell>
                          <TableCell>{sub.gradingResult?.totalScore ?? 'N/A'}</TableCell>
                          <TableCell>{sub.gradingResult?.totalMaxScore ?? 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={
                              sub.gradingResult?.gradingStatus === 'PASSED' 
                              ? 'default' 
                              : 'destructive'
                            }>
                              {sub.gradingResult?.totalScore && sub.gradingResult?.totalMaxScore
                                ? `${((sub.gradingResult.totalScore / sub.gradingResult.totalMaxScore) * 100).toFixed(1)}%`
                                : '0%'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={sub.gradingResult?.gradingStatus === 'PASSED' ? 'default' : 'destructive'}>
                              {sub.gradingResult?.gradingStatus ?? 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(sub.submittedAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedSubmission(sub);
                                  setShowSubmissionDialog(true);
                                }}
                              >
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
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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

export default EnhancedQuizEditor;
