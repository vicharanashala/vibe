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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Save,
  X
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
  useUpdateItem,
  useUpdateQuestion,
  useCreateQuestion
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

  const handleCreateQuestion = async () => {
    if (!selectedQuestionBank || !questionForm.question.type) return;

    try {
      // For now, we'll create a placeholder question
      // This would need to be implemented based on your question creation endpoint
      console.log('Creating question:', questionForm);

      // You would need to add a useCreateQuestion hook that calls POST /questions endpoint
      // await createQuestion.mutateAsync({ body: questionForm });

      setQuestionForm({ question: {
        text: '',
        type: 'SELECT_ONE_IN_LOT',
        isParameterized: false,
        timeLimitSeconds: 60,
        points: 1
      }, solution: {} });

      const createQuestion = useCreateQuestion();
      await createQuestion.mutateAsync({
        body: questionForm
      });
      setShowCreateQuestionDialog(false);
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
    if (questionBanks && questionBanks.length > 0 && !selectedQuestionBank) {
      setSelectedQuestionBank(questionBanks[0].bankId);
    }
  }, [questionBanks]);

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
                    <div>
                      <h3 className="font-semibold">Question Banks</h3>
                    </div>
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
                            <Label htmlFor="bankName">Title</Label>
                            <Input
                              id="bankName"
                              value={bankForm.title}
                              onChange={(e) => setBankForm({ ...bankForm, title: e.target.value })}
                              placeholder="Enter bank title"
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
                    {questionBanks?.map((bank: any) => (
                      <Card
                        key={bank.bankId}
                        className={`cursor-pointer transition-colors hover:bg-accent ${selectedQuestionBank === bank.bankId ? 'border-primary bg-accent' : ''
                          }`}
                        onClick={() => setSelectedQuestionBank(bank.bankId)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">Bank {bank.bankId.slice(-8)}</span>
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

                    {(!questionBanks || questionBanks.length === 0) && (
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
                          <ExpandableQuestionCard
                            key={questionId}
                            questionId={questionId}
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

// Expandable Question Card Component
interface ExpandableQuestionCardProps {
  questionId: string;
  onDelete: () => void;
  onDuplicate: () => void;
}

const ExpandableQuestionCard: React.FC<ExpandableQuestionCardProps> = ({
  questionId,
  onDelete,
  onDuplicate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<QuestionFormData>({
    question: {
      text: '',
      type: 'SELECT_ONE_IN_LOT',
      isParameterized: false,
      timeLimitSeconds: 60,
      points: 1
    },
    solution: {}
  });

  const { data: question, refetch: refetchQuestion } = useQuestionById(questionId);
  const updateQuestion = useUpdateQuestion();
  console.log('Question data:', question);

  // Initialize edit form when question data is loaded
  useEffect(() => {
    if (question && !isEditing) {
      setEditForm({
        question: {
          text: question.text || '',
          type: question.type || 'SELECT_ONE_IN_LOT',
          isParameterized: question.isParameterized || false,
          parameters: question.parameters || [],
          hint: question.hint || '',
          timeLimitSeconds: question.timeLimitSeconds || 60,
          points: question.points || 1
        },
        solution: {
          // Map backend solution fields to frontend format
          correctLotItem: question.correctLotItem,
          incorrectLotItems: question.incorrectLotItems,
          correctLotItems: question.correctLotItems,
          ordering: question.ordering,
          solutionText: question.solutionText,
          decimalPrecision: question.decimalPrecision,
          upperLimit: question.upperLimit,
          lowerLimit: question.lowerLimit,
          value: question.value,
          expression: question.expression
        }
      });
    }
  }, [question, isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
    if (question) {
      setEditForm({
        question: {
          text: question.text || '',
          type: question.type || 'SELECT_ONE_IN_LOT',
          isParameterized: question.isParameterized || false,
          parameters: question.parameters || [],
          hint: question.hint || '',
          timeLimitSeconds: question.timeLimitSeconds || 60,
          points: question.points || 1
        },
        solution: {
          // Map backend solution fields to frontend format
          correctLotItem: question.correctLotItem,
          incorrectLotItems: question.incorrectLotItems,
          correctLotItems: question.correctLotItems,
          ordering: question.ordering,
          solutionText: question.solutionText,
          decimalPrecision: question.decimalPrecision,
          upperLimit: question.upperLimit,
          lowerLimit: question.lowerLimit,
          value: question.value,
          expression: question.expression
        }
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (question) {
      // Reset form to original question data from details
      const details = question as any || {};
      setEditForm({
        question: {
          text: details.text || '',
          type: details.type || 'SELECT_ONE_IN_LOT',
          isParameterized: details.isParameterized || false,
          parameters: details.parameters || [],
          hint: details.hint || '',
          timeLimitSeconds: details.timeLimitSeconds || 60,
          points: details.points || 1
        },
        solution: {
          // Map backend solution fields to frontend format
          correctLotItem: details.correctLotItem,
          incorrectLotItems: details.incorrectLotItems,
          correctLotItems: details.correctLotItems,
          ordering: details.ordering,
          solutionText: details.solutionText,
          decimalPrecision: details.decimalPrecision,
          upperLimit: details.upperLimit,
          lowerLimit: details.lowerLimit,
          value: details.value,
          expression: details.expression
        }
      });
    }
  };

  const handleSaveEdit = async () => {
    try {
      const cleanLotItem = (item: any) => {
        if (!item) return item;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...rest } = item;
        return rest;
      };

      const solutionForBackend = {
        correctLotItem: editForm.solution.correctLotItem ? cleanLotItem(editForm.solution.correctLotItem) : undefined,
        incorrectLotItems: editForm.solution.incorrectLotItems?.map(cleanLotItem),
        correctLotItems: editForm.solution.correctLotItems?.map(cleanLotItem),
        ordering: editForm.solution.ordering,
        solutionText: editForm.solution.solutionText,
        decimalPrecision: editForm.solution.decimalPrecision,
        upperLimit: editForm.solution.upperLimit,
        lowerLimit: editForm.solution.lowerLimit,
        value: editForm.solution.value,
        expression: editForm.solution.expression
      };

      await updateQuestion.mutateAsync({
        params: { path: { questionId } },
        body: {
          question: {
            text: editForm.question.text,
            type: editForm.question.type,
            isParameterized: editForm.question.isParameterized,
            parameters: editForm.question.parameters,
            hint: editForm.question.hint,
            timeLimitSeconds: editForm.question.timeLimitSeconds,
            points: editForm.question.points
          },
          solution: solutionForBackend
        }
      });

      console.log('Successfully updated question:', questionId);
      setIsEditing(false);

      // Refetch the question data to get the latest updates
      await refetchQuestion();

    } catch (error) {
      console.error('Failed to update question:', error);
      // TODO: Add proper error notification/toast here
    }
  };

  // Helper functions for managing options
  const updateOption = (optionId: string, updates: { text?: string; explaination?: string }) => {
    const newSolution = { ...editForm.solution };

    // Find and update the option in the appropriate array
    if (editForm.question.type === 'SELECT_ONE_IN_LOT') {
      if (newSolution.correctLotItem && (newSolution.correctLotItem._id === optionId || newSolution.correctLotItem._id === undefined)) {
        newSolution.correctLotItem = {
          ...newSolution.correctLotItem,
          ...updates,
          _id: optionId
        };
      } else if (newSolution.incorrectLotItems) {
        newSolution.incorrectLotItems = newSolution.incorrectLotItems.map((item: any) =>
          item._id === optionId || (!item._id && optionId.startsWith('incorrect'))
            ? { ...item, ...updates, _id: optionId }
            : item
        );
      }
    } else if (editForm.question.type === 'SELECT_MANY_IN_LOT') {
      if (newSolution.correctLotItems) {
        newSolution.correctLotItems = newSolution.correctLotItems.map((item: any) =>
          item._id === optionId || (!item._id && optionId.startsWith('correct'))
            ? { ...item, ...updates, _id: optionId }
            : item
        );
      }
      if (newSolution.incorrectLotItems) {
        newSolution.incorrectLotItems = newSolution.incorrectLotItems.map((item: any) =>
          item._id === optionId || (!item._id && optionId.startsWith('incorrect'))
            ? { ...item, ...updates, _id: optionId }
            : item
        );
      }
    }

    setEditForm({ ...editForm, solution: newSolution });
  };

  const setSingleCorrectOption = (selectedOptionId: string) => {
    const newSolution = { ...editForm.solution };

    // Get all options
    const allOptions: Array<{
      id: string;
      text: string;
      isCorrect: boolean;
      explaination?: string;
    }> = [];

    // Add correct option
    if (newSolution.correctLotItem) {
      allOptions.push({
        id: newSolution.correctLotItem._id || `correct-${Date.now()}`,
        text: newSolution.correctLotItem.text || '',
        isCorrect: true,
        explaination: newSolution.correctLotItem.explaination || ''
      });
    }

    // Add incorrect options
    if (newSolution.incorrectLotItems) {
      newSolution.incorrectLotItems.forEach((item: any, index: number) => {
        allOptions.push({
          id: item._id || `incorrect-${index}-${Date.now()}`,
          text: item.text || '',
          isCorrect: false,
          explaination: item.explaination || ''
        });
      });
    }

    // Find the selected option
    const selectedOption = allOptions.find(opt => opt.id === selectedOptionId);
    if (!selectedOption) return;

    // Reset the solution
    newSolution.correctLotItem = null;
    newSolution.incorrectLotItems = [];

    // Set the selected option as correct and all others as incorrect
    allOptions.forEach(option => {
      const optionData = {
        _id: option.id,
        text: option.text,
        explaination: option.explaination
      };

      if (option.id === selectedOptionId) {
        newSolution.correctLotItem = optionData;
      } else {
        newSolution.incorrectLotItems.push(optionData);
      }
    });

    setEditForm({ ...editForm, solution: newSolution });
  };

  const toggleCorrectOption = (optionId: string, isCorrect: boolean) => {
    const newSolution = { ...editForm.solution };

    if (editForm.question.type === 'SELECT_ONE_IN_LOT') {
      // For single choice questions, use the dedicated function instead
      if (isCorrect) {
        setSingleCorrectOption(optionId);
        return;
      }

      // For unsetting (making incorrect), just use the regular logic
      let targetOption: any = null;

      // Find the option to move
      if (newSolution.correctLotItem && newSolution.correctLotItem._id === optionId) {
        targetOption = newSolution.correctLotItem;
        newSolution.correctLotItem = null;
      }

      if (targetOption) {
        newSolution.incorrectLotItems = newSolution.incorrectLotItems || [];
        newSolution.incorrectLotItems.push(targetOption);
      }
    } else if (editForm.question.type === 'SELECT_MANY_IN_LOT') {
      // For multiple choice, move between correct and incorrect arrays
      let targetOption: any = null;

      // Find and remove from current array
      if (newSolution.correctLotItems) {
        const index = newSolution.correctLotItems.findIndex((item: any) => item._id === optionId);
        if (index !== -1) {
          targetOption = newSolution.correctLotItems[index];
          newSolution.correctLotItems.splice(index, 1);
        }
      }

      if (!targetOption && newSolution.incorrectLotItems) {
        const index = newSolution.incorrectLotItems.findIndex((item: any) => item._id === optionId);
        if (index !== -1) {
          targetOption = newSolution.incorrectLotItems[index];
          newSolution.incorrectLotItems.splice(index, 1);
        }
      }

      // Add to target array
      if (targetOption) {
        if (isCorrect) {
          newSolution.correctLotItems = newSolution.correctLotItems || [];
          newSolution.correctLotItems.push(targetOption);
        } else {
          newSolution.incorrectLotItems = newSolution.incorrectLotItems || [];
          newSolution.incorrectLotItems.push(targetOption);
        }
      }
    }

    setEditForm({ ...editForm, solution: newSolution });
  };

  const removeOption = (optionId: string) => {
    const newSolution = { ...editForm.solution };

    if (editForm.question.type === 'SELECT_ONE_IN_LOT') {
      if (newSolution.correctLotItem && newSolution.correctLotItem._id === optionId) {
        newSolution.correctLotItem = null;
      } else if (newSolution.incorrectLotItems) {
        newSolution.incorrectLotItems = newSolution.incorrectLotItems.filter((item: any) => item._id !== optionId);
      }
    } else if (editForm.question.type === 'SELECT_MANY_IN_LOT') {
      if (newSolution.correctLotItems) {
        newSolution.correctLotItems = newSolution.correctLotItems.filter((item: any) => item._id !== optionId);
      }
      if (newSolution.incorrectLotItems) {
        newSolution.incorrectLotItems = newSolution.incorrectLotItems.filter((item: any) => item._id !== optionId);
      }
    }

    setEditForm({ ...editForm, solution: newSolution });
  };

  const addNewOption = () => {
    const newOption = {
      _id: `option-${Date.now()}`,
      text: '',
      explaination: ''
    };

    const newSolution = { ...editForm.solution };

    // Add as incorrect option by default
    newSolution.incorrectLotItems = newSolution.incorrectLotItems || [];
    newSolution.incorrectLotItems.push(newOption);

    setEditForm({ ...editForm, solution: newSolution });
  };

  const renderEditForm = () => (
    <div className="space-y-6 mt-6 p-6 border rounded-lg bg-muted/30">
      <div className="grid grid-cols-1 gap-6">
        {/* Question Type */}
        <div>
          <Label htmlFor="questionType" className="text-sm font-medium">Question Type</Label>
          <Select
            value={editForm.question.type}
            onValueChange={(value: QuestionFormData['question']['type']) => {
              const newForm = { ...editForm, question: { ...editForm.question, type: value } };
              if (editForm.question.type === 'SELECT_ONE_IN_LOT' && value === 'SELECT_MANY_IN_LOT') {
                if (newForm.solution.correctLotItem) {
                  newForm.solution.correctLotItems = [
                    ...(newForm.solution.correctLotItems || []),
                    newForm.solution.correctLotItem
                  ];
                  newForm.solution.correctLotItem = null;
                }
              } else if (editForm.question.type === 'SELECT_MANY_IN_LOT' && value === 'SELECT_ONE_IN_LOT') {
                if (newForm.solution.correctLotItems && newForm.solution.correctLotItems.length > 0) {
                  const [firstCorrect, ...restCorrect] = newForm.solution.correctLotItems;
                  newForm.solution.correctLotItem = firstCorrect;
                  newForm.solution.incorrectLotItems = [
                    ...(newForm.solution.incorrectLotItems || []),
                    ...restCorrect
                  ];
                  newForm.solution.correctLotItems = [];
                }
              }
              setEditForm(newForm);
            }}
          >
            <SelectTrigger className="mt-1">
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

        {/* Question Text */}
        <div>
          <Label htmlFor="questionText" className="text-sm font-medium">Question Text</Label>
          <Textarea
            id="questionText"
            placeholder="Enter your question here..."
            value={editForm.question.text || ''}
            onChange={(e) => setEditForm({
              ...editForm,
              question: { ...editForm.question, text: e.target.value }
            })}
            className="mt-1 min-h-[100px]"
            rows={4}
          />
        </div>

        {/* Hint field */}
        <div>
          <Label htmlFor="hint" className="text-sm font-medium">Hint (Optional)</Label>
          <Textarea
            id="hint"
            placeholder="Enter a hint for this question..."
            value={editForm.question.hint || ''}
            onChange={(e) => setEditForm({
              ...editForm,
              question: { ...editForm.question, hint: e.target.value }
            })}
            className="mt-1"
            rows={2}
          />
        </div>

        {/* Answer Options for Multiple Choice */}
        {(editForm.question.type === 'SELECT_ONE_IN_LOT' || editForm.question.type === 'SELECT_MANY_IN_LOT') && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Answer Options</Label>
            <div className="space-y-3">
              {/* Render all options with correct/incorrect toggle */}
              {(() => {
                // Combine all options into a single array with metadata
                const allOptions: Array<{
                  id: string;
                  text: string;
                  isCorrect: boolean;
                  explaination?: string;
                }> = [];

                // Add correct options
                if (editForm.question.type === 'SELECT_ONE_IN_LOT' && editForm.solution?.correctLotItem) {
                  allOptions.push({
                    id: editForm.solution.correctLotItem._id || `correct-${Date.now()}`,
                    text: editForm.solution.correctLotItem.text || '',
                    isCorrect: true,
                    explaination: editForm.solution.correctLotItem.explaination || ''
                  });
                }

                if (editForm.question.type === 'SELECT_MANY_IN_LOT' && editForm.solution?.correctLotItems) {
                  editForm.solution.correctLotItems.forEach((item: any, index: number) => {
                    allOptions.push({
                      id: item._id || `correct-${index}-${Date.now()}`,
                      text: item.text || '',
                      isCorrect: true,
                      explaination: item.explaination || ''
                    });
                  });
                }

                // Add incorrect options
                if (editForm.solution?.incorrectLotItems) {
                  editForm.solution.incorrectLotItems.forEach((item: any, index: number) => {
                    allOptions.push({
                      id: item._id || `incorrect-${index}-${Date.now()}`,
                      text: item.text || '',
                      isCorrect: false,
                      explaination: item.explaination || ''
                    });
                  });
                }

                // If no options exist, create a default correct option
                if (allOptions.length === 0) {
                  allOptions.push({
                    id: `option-${Date.now()}`,
                    text: '',
                    isCorrect: true,
                    explaination: ''
                  });
                }

                return (
                  <div className="space-y-3">
                    {editForm.question.type === 'SELECT_ONE_IN_LOT' ? (
                      <RadioGroup
                        value={allOptions.find(opt => opt.isCorrect)?.id || ''}
                        onValueChange={(value) => {
                          // Use the dedicated function for single choice selection
                          setSingleCorrectOption(value);
                        }}
                        className="space-y-3"
                      >
                        {allOptions.map((option, index) => (
                          <div key={option.id} className="space-y-2 p-4 border rounded-lg bg-background">
                            <div className="flex gap-3 items-start">
                              <span className="text-sm text-muted-foreground font-medium min-w-[20px] mt-2">
                                {index + 1}.
                              </span>
                              <div className="flex-1 space-y-2">
                                <Input
                                  placeholder={`Option ${index + 1}`}
                                  value={option.text}
                                  onChange={(e) => updateOption(option.id, { text: e.target.value })}
                                  className="flex-1"
                                />
                                <Input
                                  placeholder="explaination (optional)"
                                  value={option.explaination}
                                  onChange={(e) => updateOption(option.id, { explaination: e.target.value })}
                                  className="flex-1 text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value={option.id}
                                    id={`correct-${option.id}`}
                                  />
                                  <Label htmlFor={`correct-${option.id}`} className="text-sm text-green-700 dark:text-green-400">
                                    Correct
                                  </Label>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeOption(option.id)}
                                  className="text-destructive hover:text-destructive"
                                  disabled={allOptions.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <div className="space-y-3">
                        {allOptions.map((option, index) => (
                          <div key={option.id} className="space-y-2 p-4 border rounded-lg bg-background">
                            <div className="flex gap-3 items-start">
                              <span className="text-sm text-muted-foreground font-medium min-w-[20px] mt-2">
                                {index + 1}.
                              </span>
                              <div className="flex-1 space-y-2">
                                <Input
                                  placeholder={`Option ${index + 1}`}
                                  value={option.text}
                                  onChange={(e) => updateOption(option.id, { text: e.target.value })}
                                  className="flex-1"
                                />
                                <Input
                                  placeholder="explaination (optional)"
                                  value={option.explaination}
                                  onChange={(e) => updateOption(option.id, { explaination: e.target.value })}
                                  className="flex-1 text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`correct-${option.id}`}
                                    checked={option.isCorrect}
                                    onCheckedChange={(checked) => toggleCorrectOption(option.id, checked as boolean)}
                                  />
                                  <Label htmlFor={`correct-${option.id}`} className="text-sm text-green-700 dark:text-green-400">
                                    Correct
                                  </Label>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeOption(option.id)}
                                  className="text-destructive hover:text-destructive"
                                  disabled={allOptions.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <Button
                type="button"
                variant="outline"
                onClick={addNewOption}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>
          </div>
        )}

        {/* Numeric Answer Type Fields */}
        {editForm.question.type === 'NUMERIC_ANSWER_TYPE' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lowerLimit" className="text-sm font-medium">Lower Limit</Label>
                <Input
                  id="lowerLimit"
                  type="number"
                  value={editForm?.solution?.lowerLimit || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    solution: { ...editForm.solution, lowerLimit: parseFloat(e.target.value) }
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="upperLimit" className="text-sm font-medium">Upper Limit</Label>
                <Input
                  id="upperLimit"
                  type="number"
                  value={editForm?.solution?.upperLimit || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    solution: { ...editForm.solution, upperLimit: parseFloat(e.target.value) }
                  })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="decimalPrecision" className="text-sm font-medium">Decimal Precision</Label>
              <Input
                id="decimalPrecision"
                type="number"
                min="0"
                value={editForm?.solution?.decimalPrecision || ''}
                onChange={(e) => setEditForm({
                  ...editForm,
                  solution: { ...editForm.solution, decimalPrecision: parseInt(e.target.value) }
                })}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Descriptive Answer Fields */}
        {editForm.question.type === 'DESCRIPTIVE' && (
          <div>
            <Label htmlFor="solutionText" className="text-sm font-medium">Expected Answer/Solution</Label>
            <Textarea
              id="solutionText"
              placeholder="Enter the expected answer or solution..."
              value={editForm?.solution?.solutionText || ''}
              onChange={(e) => setEditForm({
                ...editForm,
                solution: { ...editForm.solution, solutionText: e.target.value }
              })}
              className="mt-1"
              rows={3}
            />
          </div>
        )}

        {/* Points and Time Limit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="points" className="text-sm font-medium">Points</Label>
            <Input
              id="points"
              type="number"
              min="1"
              value={editForm.question.points || ''}
              onChange={(e) => setEditForm({
                ...editForm,
                question: { ...editForm.question, points: parseInt(e.target.value) }
              })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="timeLimit" className="text-sm font-medium">Time Limit (seconds)</Label>
            <Input
              id="timeLimit"
              type="number"
              min="1"
              value={editForm.question.timeLimitSeconds || ''}
              onChange={(e) => setEditForm({
                ...editForm,
                question: { ...editForm.question, timeLimitSeconds: parseInt(e.target.value) }
              })}
              className="mt-1"
            />
          </div>
        </div>

        {/* Parameterized Question */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="isParameterized"
            checked={editForm.question.isParameterized || false}
            onChange={(e) => setEditForm({
              ...editForm,
              question: { ...editForm.question, isParameterized: e.target.checked }
            })}
            className="rounded"
          />
          <Label htmlFor="isParameterized" className="text-sm cursor-pointer">
            Is Parameterized Question
          </Label>
        </div>
      </div>
    </div>
  );

  const renderQuestionContent = () => {
    if (!question) return <div className="text-sm text-muted-foreground">Loading question...</div>;

    return (
      <div className="space-y-4 p-4">
        <div>
          <h4 className="font-medium text-sm mb-2">Question:</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{question.text || 'No question text'}</p>
        </div>

        {question.hint && (
          <div>
            <h4 className="font-medium text-sm mb-2">Hint:</h4>
            <p className="text-sm text-muted-foreground italic">{question.hint}</p>
          </div>
        )}

        {(question.type === 'SELECT_ONE_IN_LOT' || question.type === 'SELECT_MANY_IN_LOT') && (
          <div>
            <h4 className="font-medium text-sm mb-3">Options:</h4>
            <div className="space-y-2">
              {/* Combine and display all options with their status */}
              {(() => {
                const allOptions: Array<{
                  text: string;
                  isCorrect: boolean;
                  explaination?: string;
                }> = [];

                // Add correct options
                if (question.type === 'SELECT_ONE_IN_LOT' && question.correctLotItem) {
                  allOptions.push({
                    text: question.correctLotItem.text,
                    isCorrect: true,
                    explaination: question.correctLotItem.explaination
                  });
                }

                if (question.type === 'SELECT_MANY_IN_LOT' && question.correctLotItems) {
                  question.correctLotItems.forEach((item: any) => {
                    allOptions.push({
                      text: item.text,
                      isCorrect: true,
                      explaination: item.explaination
                    });
                  });
                }

                // Add incorrect options
                if (question.incorrectLotItems) {
                  question.incorrectLotItems.forEach((item: any) => {
                    allOptions.push({
                      text: item.text,
                      isCorrect: false,
                      explaination: item.explaination
                    });
                  });
                }

                return allOptions.map((option, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${option.isCorrect ? 'bg-green-500/10 border-green-500/20' : 'bg-muted/50 border-border'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-sm text-muted-foreground font-medium min-w-[20px]">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <span className={`text-sm font-medium ${option.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                            {option.text}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${option.isCorrect ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}
                          >
                            {option.isCorrect ? 'Correct' : 'Incorrect'}
                          </Badge>
                        </div>
                        {option.explaination && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {option.explaination}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {question.type === 'NUMERIC_ANSWER_TYPE' && (
          <div>
            <h4 className="font-medium text-sm mb-2">Answer Range:</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              {question.value && <p>Expected Value: {question.value}</p>}
              {question.expression && <p>Expression: {question.expression}</p>}
              {question.lowerLimit !== undefined && question.upperLimit !== undefined && (
                <p>Range: {question.lowerLimit} - {question.upperLimit}</p>
              )}
              {question.decimalPrecision !== undefined && (
                <p>Decimal Precision: {question.decimalPrecision}</p>
              )}
            </div>
          </div>
        )}

        {question.type === 'DESCRIPTIVE' && question.solutionText && (
          <div>
            <h4 className="font-medium text-sm mb-2">Expected Answer:</h4>
            <p className="text-sm text-muted-foreground">{question.solutionText}</p>
          </div>
        )}

        {question.type === 'ORDER_THE_LOTS' && question.ordering && (
          <div>
            <h4 className="font-medium text-sm mb-3">Correct Order:</h4>
            <div className="space-y-2">
              {question.ordering.map((order: any, index: number) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded border">
                  <span className="text-sm text-muted-foreground font-medium min-w-[20px]">{order.order}.</span>
                  <span className="text-sm flex-1 text-muted-foreground">
                    {order.lotItem.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6 text-xs text-muted-foreground pt-3 border-t">
          {question.points && (
            <span className="font-medium">Points: {question.points}</span>
          )}
          {question.timeLimitSeconds && (
            <span className="font-medium">Time Limit: {question.timeLimitSeconds}s</span>
          )}
          {question.isParameterized && (
            <span className="font-medium text-blue-600">Parameterized</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-l-4 border-l-transparent hover:border-l-primary">
      <CardContent className="p-0">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <div className="p-6 cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge variant="outline" className="font-medium">
                        {question?.type?.replace(/_/g, ' ') || 'Unknown'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      ID: {questionId.slice(-8)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {(question as any)?.text || 'Question text not available'}
                  </p>
                  
                  {/* Quick info */}
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    {(question as any)?.points && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {(question as any).points} pts
                      </span>
                    )}
                    {(question as any)?.timeLimitSeconds && (
                      <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded">
                        {(question as any).timeLimitSeconds}s
                      </span>
                    )}
                    {(question as any)?.lotItems && (
                      <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                        {(question as any).lotItems.length} options
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 ml-6" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={onDuplicate} title="Duplicate" className="h-8 w-8 p-0">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onDelete} 
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="border-t bg-muted/20">
              {isEditing ? renderEditForm() : renderQuestionContent()}
              
              <div className="flex justify-end gap-3 p-6 bg-background border-t">
                {isEditing ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancelEdit}
                      disabled={updateQuestion.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSaveEdit}
                      disabled={updateQuestion.isPending}
                    >
                      {updateQuestion.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Question
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default EnhancedQuizEditor;
