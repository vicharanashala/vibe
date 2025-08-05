import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Search,
  RefreshCw,
  FlagTriangleRight,
  Edit,
  X
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
  useEditQuestionBankInQuiz,
  useQuestionById,
  useQuizSubmissions,
  useUpdateCourseItem,
} from '@/hooks/hooks';

import ExpandableQuestionCard from './expandable-question-card';
import SubmissionDetailsDialog from './submission-details-dialog';
import CreateQuestionDialog from './CreateQuestion';
import CreateQuestionBankDialog from './CreateQuestionBank';
import QuizSettingsDialog, { QuizSettingsForm } from './quiz-settings-dialog';
import ConfirmationModal from './confirmation-modal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { GradingSystemStatus } from '@/types/quiz.types';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from 'sonner';

interface EnhancedQuizEditorProps {
  quizId: string | null;
  courseId: string;
  courseVersionId: string;
  moduleId: string;
  sectionId: string;
  details: any;
  analytics: any;
  // submissions: any;
  performance: any;
  onDelete: () => void;
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

interface QuestionBankEditFormData {
  questionBankId: string;
  title: string;
  description: string;
  tags: string[];
  difficultyLevel: string;
  questionsToSelect: number;
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
  onCacheUpdate?: () => void;
}

var questionTextCache: Record<string, { text: string, points: number }> = {};

const QuestionPerformanceRow: React.FC<QuestionPerformanceRowProps> = ({ performance, onCacheUpdate }) => {
  const { data: questionData } = useQuestionById(performance.questionId);
  useEffect(() => {
    if (questionData && questionData.text) {
      questionTextCache[performance.questionId] = { text: questionData.text, points: questionData.points || 1 };
      console.log(`Cached question text for ${performance.questionId}: ${questionData.text}`);
      // Trigger parent component to update
      if (onCacheUpdate) {
        onCacheUpdate();
      }
    }
  }, [questionData, performance.questionId, onCacheUpdate]);

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
  // submissions,
  performance,
  onDelete,
}) => {
  const [selectedTab, setSelectedTab] = useState('analytics');
  const [selectedQuestionBank, setSelectedQuestionBank] = useState<string | null>(null);
  const [questionCacheUpdateTrigger, setQuestionCacheUpdateTrigger] = useState(0);

  // Dialog states
  const [showCreateBankDialog, setShowCreateBankDialog] = useState(false);
  const [showCreateQuestionDialog, setShowCreateQuestionDialog] = useState(false);
  const [showEditQuestionDialog, setShowEditQuestionDialog] = useState(false);
  const [editQuizSettings, setEditQuizSettings] = useState(false);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  
  // Confirmation modal states
  const [showDeleteQuizModal, setShowDeleteQuizModal] = useState(false);
  const [showDeleteQuestionBankModal, setShowDeleteQuestionBankModal] = useState(false);
  const [showDeleteQuestionModal, setShowDeleteQuestionModal] = useState(false);
  const [questionBankToDelete, setQuestionBankToDelete] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  // Quiz submission payloads
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  const [selectedGradeStatus, setSelectedGradeStatus] = useState<GradingSystemStatus>("All");
  const [sort, setSort] = useState("All");
  const [searchQuery,setSearchQuery] = useState("");

  const gradeStatusOptions = ["All", 'PENDING' , 'PASSED' , 'FAILED'];

  const sortOptions = [
  { label: "All", value: "All" },
  { label: "Newest First", value: "date_desc" },
  { label: "Oldest First", value: "date_asc" },
  { label: "Highest Score First", value: "score_desc" },
  { label: "Lowest Score First", value: "score_asc" },
  ];

  
  if(!quizId){
    console.error("Failed to fetch submission because quizId is ", quizId)
  }
  const { data: submissionsData } = useQuizSubmissions(quizId!, selectedGradeStatus, searchQuery, sort, currentPage, limit);
  
  const submissions = submissionsData?.data;

  const handlePageChange = (newPage: number) => {
    if (submissionsData && newPage >= 1 && newPage <= submissionsData.totalPages) {
      setCurrentPage(newPage)
    }
  }

  // Form states
  const [bankForm, setBankForm] = useState({ title: '', description: '' });

  // Question bank edit form
  const [showEditQuestionBankDialog, setShowEditQuestionBankDialog] = useState(false);
  const [questionBankToEdit, setQuestionBankToEdit] = useState<any>(null);
  const [questionBankEditForm, setQuestionBankEditForm] = useState<QuestionBankEditFormData>({
    questionBankId: '',
    title: '',
    description: '',
    tags: [],
    difficultyLevel: '',
    questionsToSelect: 3
  });
  const [currentTag, setCurrentTag] = useState('');


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
  const [quizSettingsForm, setQuizSettingsForm] = useState<QuizSettingsForm>({
    name: '',
    description: '',
    passThreshold: 0.7,
    maxAttempts: 3,
    quizType: 'NO_DEADLINE',
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
  const updateItem = useUpdateCourseItem();
  // const updateItem = useUpdateItem();
  const editQuestionBankInQuiz = useEditQuestionBankInQuiz();

  // Initialize quiz settings form with existing details
  useEffect(() => {
    if (details) {
      setQuizSettingsForm({
        name: details.name || '',
        description: details.description || '',
        passThreshold: details.details.passThreshold || 0.7,
        maxAttempts: details.details.maxAttempts || 3,
        quizType: details.details.quizType || 'NO_DEADLINE',
        approximateTimeToComplete: details.details.approximateTimeToComplete || '00:05:00',
        allowPartialGrading: details.details.allowPartialGrading ?? true,
        allowHint: details.details.allowHint ?? true,
        showCorrectAnswersAfterSubmission: details.details.showCorrectAnswersAfterSubmission ?? true,
        showExplanationAfterSubmission: details.details.showExplanationAfterSubmission ?? true,
        showScoreAfterSubmission: details.details.showScoreAfterSubmission ?? true,
        questionVisibility: details.details.questionVisibility || 4,
        releaseTime: details.details.releaseTime ? new Date(details.details.releaseTime).toISOString().slice(0, 16) : '',
        deadline: details.details.deadline ? new Date(details.details.deadline).toISOString().slice(0, 16) : ''
      });
    }
  }, [details]);

  // Memoized chart data that updates when questionTextCache changes
  const chartData = React.useMemo(() => {
    const performanceData = performance && performance.length > 0
      ? performance
      : calculatePerformanceFromSubmissions(submissions || []);

    return performanceData.map((p: any) => ({
      questionId: p.questionId.slice(-8),
      questionText: questionTextCache[p.questionId]?.text,
      correctRate: (p.correctRate * 100).toFixed(1),
      averageScore: p.averageScore ? (p.averageScore / (questionTextCache[p.questionId]?.points || 1) * 100).toFixed(1) : '0'
    }));
  }, [performance, submissions, questionCacheUpdateTrigger]);

  // Function to trigger chart data update when cache changes
  const handleCacheUpdate = React.useCallback(() => {
    setQuestionCacheUpdateTrigger(prev => prev + 1);
  }, []);

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
        details:quizDetails
      };

      await updateItem.mutateAsync({
        params: {
          path: {
            versionId: courseVersionId,
            // moduleId,
            // sectionId,
            itemId: quizId || ''
          }
        },
        body: requestBody
      });
      toast.success("Settings updated!")
      setEditQuizSettings(false);
      // You might want to add a success notification here
    } catch (error) {
      console.error('Failed to update quiz settings:', error);
      toast.error("Failed to update settings, Try again!")
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
    setQuestionBankToDelete(bankId);
    setShowDeleteQuestionBankModal(true);
  };

  const handleEditQuestionBank = (questionBank: any) => {
    // console.log('Edit button clicked for bank:', questionBank);
    setQuestionBankToEdit(questionBank);
    setQuestionBankEditForm({
      questionBankId: questionBank.bankId,
      title: questionBank.title || '',
      description: questionBank.description || '',
      tags: questionBank.tags || [],
      difficultyLevel: (questionBank.difficulty && questionBank.difficulty.length > 0) ? questionBank.difficulty[0] : '',
      questionsToSelect: questionBank.count || 3
    });
    setShowEditQuestionBankDialog(true);
  };

  // Tag management functions
  const handleAddTag = () => {
    if (currentTag.trim() && !questionBankEditForm.tags.includes(currentTag.trim())) {
      setQuestionBankEditForm({ ...questionBankEditForm, tags: [...questionBankEditForm.tags, currentTag.trim()] });
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setQuestionBankEditForm({
      ...questionBankEditForm,
      tags: questionBankEditForm.tags.filter((tag: string) => tag !== tagToRemove)
    });
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };



  const handleSaveEditQuestionBank = async () => {
    if (!quizId || questionBankEditForm.questionsToSelect < 1) return;

    // console.log('Saving question bank edit:', {
    //   quizId,
    //   questionBankId: questionBankEditForm.questionBankId,
    //   questionsToSelect: questionBankEditForm.questionsToSelect,
    //   tags: questionBankEditForm.tags,
    //   difficultyLevel: questionBankEditForm.difficultyLevel
    // });

    try {
      await editQuestionBankInQuiz.mutateAsync({
        params: { path: { quizId } },
        body: {
          bankId: questionBankEditForm.questionBankId,
          questionBankId: questionBankEditForm.questionBankId,
          count: questionBankEditForm.questionsToSelect,
          tags: questionBankEditForm.tags,
          difficulty: questionBankEditForm.difficultyLevel ? [questionBankEditForm.difficultyLevel] : []
        }
      });
      
      // Close dialog and reset state
      setShowEditQuestionBankDialog(false);
      setQuestionBankToEdit(null);
      
      // Refresh the question banks data
      refetchQuestionBanks();
      
      // console.log('Question banks refetched successfully');
    } catch (error) {
      console.error('Failed to edit question bank:', error);
    }
  };

  const handleCancelEditQuestionBank = () => {
    // If we have the original bank data, reset form to original values
    if (questionBankToEdit) {
      setQuestionBankEditForm({
        questionBankId: questionBankToEdit.bankId,
        title: questionBankToEdit.title || '',
        description: questionBankToEdit.description || '',
        tags: questionBankToEdit.tags || [],
        difficultyLevel: (questionBankToEdit.difficulty && questionBankToEdit.difficulty.length > 0) ? questionBankToEdit.difficulty[0] : '',
        questionsToSelect: questionBankToEdit.count || 3
      });
    }
    setShowEditQuestionBankDialog(false);
    setQuestionBankToEdit(null);
  };

  const confirmDeleteQuestionBank = async () => {
    if (!questionBankToDelete) return;

    try {
      await removeQuestionBankFromQuiz.mutateAsync({
        params: { path: { quizId, questionBankId: questionBankToDelete } }
      });
      refetchQuestionBanks();
      if (selectedQuestionBank === questionBankToDelete) {
        setSelectedQuestionBank(null);
      }
      setShowDeleteQuestionBankModal(false);
      setQuestionBankToDelete(null);
    } catch (error) {
      console.error('Failed to remove question bank:', error);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setQuestionToDelete(questionId);
    setShowDeleteQuestionModal(true);
  };

  const confirmDeleteQuestion = async () => {
    if (!selectedQuestionBank || !questionToDelete) return;

    try {
      await removeQuestionFromBank.mutateAsync({
        params: { path: { questionBankId: selectedQuestionBank, questionId: questionToDelete } }
      });
      await deleteQuestion.mutateAsync({
        params: { path: { questionId: questionToDelete } }
      });
      refetchSelectedBank();
      setShowDeleteQuestionModal(false);
      setQuestionToDelete(null);
    } catch (error) {
      console.error('Failed to delete question:', error);
    }
  };

  const handleDeleteQuiz = () => {
    setShowDeleteQuizModal(true);
  };

  const confirmDeleteQuiz = async () => {
    try {
      await onDelete();
      setShowDeleteQuizModal(false);
    } catch (error) {
      console.error('Failed to delete quiz:', error);
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
    setSelectedQuestionBank('');
  }, [quizId]);

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
              {/* <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button> */}
              <Button variant="outline" size="sm" onClick={() => setEditQuizSettings(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              {/* <Button variant="outline" size="sm">
                <FlagTriangleRight className="h-4 w-4 mr-2" />
                View Flags
              </Button> */}
              <Button variant="destructive" size="sm" onClick={handleDeleteQuiz}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Quiz
              </Button>
            </div>
          </div>
        </div>

        {/* Edit Quiz Settings Dialog */}
        <QuizSettingsDialog
          open={editQuizSettings}
          onOpenChange={setEditQuizSettings}
          quizSettingsForm={quizSettingsForm}
          setQuizSettingsForm={setQuizSettingsForm}
          onSave={handleSaveQuizSettings}
          isSaving={updateItem.isPending}
        />

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="px-6 mb-4">
          <TabsList>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="submissions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Submissions
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden ">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsContent value="questions" className="h-full m-0 ms-7 mt-2">
            <div className="h-full flex">
              {/* Question Banks Sidebar */}
              <div className="w-80 border-r rounded  bg-muted/50 mt-1">
                <CreateQuestionBankDialog
                  showCreateBankDialog={showCreateBankDialog}
                  setShowCreateBankDialog={setShowCreateBankDialog}
                  quizId={quizId}
                />
                {/* List of question banks */}
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
                              <span className=" text-md font-semibold ">Bank {bank.bankId.slice(-8)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditQuestionBank(bank);
                                }}
                                className="h-6 w-6 p-0 text-white hover:text-background"
                              >
                               <Edit className="h-3 w-3 " />
                              </Button>
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

              {/* Questions Content in a question bank */}
              <div className="flex-1">
                {selectedQuestionBank ? (
                  <div className="h-full flex flex-col">
                    {/* Add Question trigger for questions */}
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
              <div className="grid grid-cols-1 md:grid-rows-3 md:grid-cols-5 gap-6">
                <Card className="col-span-3 row-span-2">
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
                              <QuestionPerformanceRow key={p.questionId} performance={p} onCacheUpdate={handleCacheUpdate} />
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
                <Card className="col-span-2 row-span-2 bg-muted/50 text-muted-foreground">
                  <CardHeader>
                    <CardTitle className="text-muted-foreground">Question Performance Chart</CardTitle>
                  </CardHeader>
                  <CardContent className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis dataKey="questionId" stroke="rgba(255, 255, 255, 0.7)" />
                        <YAxis stroke="rgba(255, 255, 255, 0.7)" />
                        <Tooltip
                          content={({ payload }) => {
                            if (payload && payload.length) {
                              const { questionText, correctRate } = payload[0].payload;
                              return (
                                <div style={{ backgroundColor: "#1e1e2f", padding: "10px", borderRadius: "5px", color: "#ffffff" }}>
                                  <p><strong>Question:</strong> {questionText || "Loading..."}</p>
                                  <p><strong>Correct Rate:</strong> {correctRate}%</p>
                                  <p><strong>Average Score:</strong> {payload[0].payload.averageScore}%</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                          cursor={{ fill: "rgba(255, 255, 255, 0.1)" }}
                        />
                        <Legend verticalAlign="top" height={36} iconSize={10} iconType="circle" />

                        <Legend />
                        <Bar dataKey="correctRate" fill="#4caf50" name="Correct Rate (%)" />
                        <Bar dataKey="averageScore" fill="#2196f3" name="Average Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-4 gap-4 col-span-5 row-span-1">
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
            </div>

          </TabsContent>

          <TabsContent value="submissions" className="h-full m-0 flex flex-col justify-center items-center">
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 mt-5 px-10">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg blur-sm"></div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name, email ... "
                  value={searchQuery}
                  onChange={(e) =>{ setSearchQuery(e.target.value)}}
                  className="pl-10 bg-background border-border focus:border-primary focus:ring-primary/20 transition-all duration-300"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="statusFilter" className="text-sm font-medium text-muted-foreground">
                  Filter by Status:
                </label>
                <Select
                  value={selectedGradeStatus}
                  onValueChange={(value) => {
                    setSelectedGradeStatus(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeStatusOptions.map((status: GradingSystemStatus) => (
                      <SelectItem key={status} value={status}>
                        {status === "All" ? "Select an option" : status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="sortFilter" className="text-sm font-medium text-muted-foreground">
                  Sort by:
                </label>
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label === "All" ? "Select an option" : option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
            <div className="p-6 w-full">
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
                        <TableHead>Student</TableHead>
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
                          <TableCell className="font-medium max-w-[180px] overflow-hidden        text-ellipsis whitespace-nowrap" 
                            title={`${sub.userId?.firstName ?? ''} ${sub.userId?.lastName ?? ''}`}>
                            {(sub.userId?.firstName ?? '') + ' ' + (sub.userId?.lastName ?? '')}
                          </TableCell>
                          <TableCell>{sub.gradingResult?.totalScore.toFixed(2) ?? 'N/A'}</TableCell>
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
                              {/* <Button variant="ghost" size="sm">
                                <RefreshCw className="h-4 w-4" />
                              </Button> */}
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
                    {submissionsData && submissionsData?.totalPages > 1 && (
                      <Pagination
                          currentPage={currentPage}
                          totalPages={submissionsData.totalPages}
                          totalDocuments={submissionsData.totalCount}
                          onPageChange={handlePageChange}
                        />
                     )}
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

      {/* Edit Question Bank Dialog */}
      <Dialog open={showEditQuestionBankDialog} onOpenChange={setShowEditQuestionBankDialog}>
        <DialogContent className="w-100">
          <DialogHeader>
            <DialogTitle>Edit Question Bank Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Bank Info Display */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                Editing configuration for: <strong>{questionBankEditForm.title}</strong>
              </p>
              <div className="text-sm text-muted-foreground">
                <strong>Bank ID:</strong> {questionBankEditForm.questionBankId.slice(-8)}
              </div>
              {questionBankToEdit?.title && (
                <div className="text-sm text-muted-foreground">
                  <strong>Title:</strong> {questionBankToEdit.title}
                </div>
              )}
              {questionBankToEdit?.description && (
                <div className="text-sm text-muted-foreground">
                  <strong>Description:</strong> {questionBankToEdit.description}
                </div>
              )}
            </div>

            {/* Tags Field */}
            <div className="space-y-2">
              <Label htmlFor="editTags">Tags</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="editTags"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    placeholder="Add a tag"
                    className="w-80"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTag}
                    disabled={!currentTag.trim() || questionBankEditForm.tags.includes(currentTag.trim())}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Display Tags */}
                {questionBankEditForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {questionBankEditForm.tags.map((tag: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          className="ml-1 text-muted-foreground hover:text-background"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Difficulty Level Field */}
            <div className="space-y-2">
              <Label htmlFor="editDifficulty">Difficulty Level</Label>
              <Select
                value={questionBankEditForm.difficultyLevel}
                onValueChange={(value) => setQuestionBankEditForm({ ...questionBankEditForm, difficultyLevel: value })}
              >
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Select difficulty level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Count Field */}
            <div className="space-y-2">
              <Label htmlFor="editQuestionCount">Number of Questions to Select</Label>
              <Input
                id="editQuestionCount"
                type="number"
                value={questionBankEditForm.questionsToSelect}
                onChange={(e) => setQuestionBankEditForm({ ...questionBankEditForm, questionsToSelect: Number(e.target.value) })}
                min={1}
                className="w-80"
                placeholder="Enter number of questions to select"
              />
            </div>

            {/* Error Display */}
            {editQuestionBankInQuiz.error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {editQuestionBankInQuiz.error}
              </div>
            )}
          </div>

          {/* Dialog Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleCancelEditQuestionBank}
              disabled={editQuestionBankInQuiz.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditQuestionBank}
              disabled={editQuestionBankInQuiz.isPending || questionBankEditForm.questionsToSelect < 1}
            >
              {editQuestionBankInQuiz.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={showDeleteQuizModal}
        onClose={() => setShowDeleteQuizModal(false)}
        onConfirm={confirmDeleteQuiz}
        title="Delete Quiz"
        description="Are you sure you want to delete this quiz? This action cannot be undone and will permanently remove all questions and submissions associated with this quiz."
        confirmText="Delete Quiz"
        isDestructive={true}
        isLoading={false}
      />

      <ConfirmationModal
        isOpen={showDeleteQuestionBankModal}
        onClose={() => {
          setShowDeleteQuestionBankModal(false);
          setQuestionBankToDelete(null);
        }}
        onConfirm={confirmDeleteQuestionBank}
        title="Remove Question Bank"
        description="Are you sure you want to remove this question bank from the quiz? This will remove all questions in this bank from the quiz."
        confirmText="Remove Bank"
        isDestructive={true}
        isLoading={removeQuestionBankFromQuiz.isPending}
      />

      <ConfirmationModal
        isOpen={showDeleteQuestionModal}
        onClose={() => {
          setShowDeleteQuestionModal(false);
          setQuestionToDelete(null);
        }}
        onConfirm={confirmDeleteQuestion}
        title="Delete Question"
        description="Are you sure you want to delete this question? This action cannot be undone and will permanently remove the question from all question banks."
        confirmText="Delete Question"
        isDestructive={true}
        isLoading={deleteQuestion.isPending || removeQuestionFromBank.isPending}
      />
    </div>
  );
};

export default EnhancedQuizEditor;
