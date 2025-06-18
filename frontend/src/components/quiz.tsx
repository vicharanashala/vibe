import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Clock, Trophy, ChevronLeft, ChevronRight, RotateCcw, GripVertical, PlayCircle, BookOpen, Target, Timer, Users, AlertCircle, Eye } from "lucide-react";
import { useAttemptQuiz, type QuestionRenderView, useSubmitQuiz, type SubmitQuizResponse, useSaveQuiz, useStartItem, useStopItem } from '@/hooks/hooks';
import { useAuthStore } from "@/store/auth-store";
import { useCourseStore } from "@/store/course-store";
import MathRenderer from "./math-renderer";

// Utility function to convert buffer to hex string
const bufferToHex = (buffer: number[]) => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Utility function to preprocess content for math rendering
const preprocessMathContent = (content: string): string => {
  if (!content) return content;
  
  let processedContent = content;
  
  // Ensure math expressions are properly formatted
  // Convert \( \) to $ $ for inline math
  processedContent = processedContent.replace(/\\\((.*?)\\\)/gs, '$$$1$$');
  // Convert \[ \] to $$ $$ for display math
  processedContent = processedContent.replace(/\\\[(.*?)\\\]/gs, '$$$$1$$$$');
  
  // Fix common LaTeX formatting issues
  // Ensure proper escaping for backslashes in math contexts
  processedContent = processedContent.replace(/\$\$(.*?)\$\$/gs, (_, mathContent) => {
    // Clean up the math content - remove extra escaping that might interfere
    const cleanMath = mathContent.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    return `$$${cleanMath}$$`;
  });
  
  return processedContent;
};

// Enhanced question types based on backend QuestionRenderView
interface QuizQuestion {
  id: string;
  type: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE' | 'ORDER_THE_LOTS';
  question: string;
  options?: string[]; // For lot items
  points: number;
  timeLimit?: number; // in seconds (timeLimitSeconds from backend)
  hint?: string;
  // Additional properties for different question types
  decimalPrecision?: number;
  expression?: string;
  lotItems?: Array<{ text: string; explaination: string; _id: { buffer: { type: string; data: number[] } } | string }>;
}

interface BufferLike {
  buffer: {
    type: string;
    data: number[];
  };
}

export interface questionBankRef {
  bankId: string; // ObjectId as string
  count: number; // How many questions to pick
  difficulty?: string[]; // Optional filter
  tags?: string[]; // Optional filter
  type?: string; // Optional question type filter
}

interface QuizProps {
  questionBankRefs: questionBankRef[];
  passThreshold: number;
  maxAttempts: number;
  quizType: 'DEADLINE' | 'NO_DEADLINE' | '';
  releaseTime: Date | undefined;
  questionVisibility: number;
  deadline?: Date;
  approximateTimeToComplete: string;
  allowPartialGrading: boolean;
  allowHint: boolean;
  showCorrectAnswersAfterSubmission: boolean;
  showExplanationAfterSubmission: boolean;
  showScoreAfterSubmission: boolean;
  quizId: string | BufferLike;
  doGesture?: boolean;
  onNext?: () => void;
  isProgressUpdating?: boolean;
  attemptId?: string;
  setAttemptId?: (attemptId: string) => void;
}

export interface QuizRef {
  stopItem: () => void;
}

const Quiz = forwardRef<QuizRef, QuizProps>(({
  questionBankRefs,
  passThreshold,
  maxAttempts,
  quizType,
  releaseTime,
  deadline,
  approximateTimeToComplete,
  allowHint,
  showCorrectAnswersAfterSubmission,
  showExplanationAfterSubmission,
  showScoreAfterSubmission,
  quizId,
  doGesture = false,
  onNext,
  isProgressUpdating,
  attemptId,
  setAttemptId,
}, ref) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number | number[] | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [, setCurrentConnecting] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [showHint, setShowHint] = useState(false);
  const processedQuizId = bufferToHex(quizId.buffer.data);
  console.log('Quiz ID:', quizId);
  // Use the quiz attempt hook
  const { mutateAsync: attemptQuiz, isPending, error } = useAttemptQuiz();

  // Use the quiz submit hook
  const { mutateAsync: submitQuiz, isPending: isSubmitting, error: submitError } = useSubmitQuiz();

  // Use the save quiz hook for progress saving
  const { mutateAsync: saveQuiz, isPending: isSaving, error: saveError } = useSaveQuiz();

  // Add submission results state
  const [submissionResults, setSubmissionResults] = useState<SubmitQuizResponse | null>(null);

  // Convert backend QuestionRenderView to frontend QuizQuestion format
  const convertBackendQuestions = (questionRenderViews: QuestionRenderView[]): QuizQuestion[] => {
    return questionRenderViews.map((question) => {
      // Convert BufferId to string using the bufferToHex utility
      let questionId: string;
      if (question._id && typeof question._id === 'object' && 'buffer' in question._id) {
        // Handle BufferId type - convert buffer data to hex string
        questionId = bufferToHex((question._id.buffer.data));
      } else {
        // Handle direct string/ObjectId
        questionId = String(question._id);
      }

      const baseQuestion: QuizQuestion = {
        id: questionId,
        type: question.type as QuizQuestion['type'],
        question: question.text,
        points: question.points,
        timeLimit: question.timeLimitSeconds,
        hint: question.hint
      };

      // Add type-specific properties
      switch (question.type) {
        case 'SELECT_ONE_IN_LOT':
        case 'SELECT_MANY_IN_LOT':
        case 'ORDER_THE_LOTS':
          if ('lotItems' in question) {
            // Map the backend lotItems to frontend format
            baseQuestion.lotItems = question.lotItems.map(item => ({
              text: item.text,
              explaination: '', // This field doesn't exist in LotItem from API
              _id: typeof item._id === 'string' ? item._id : item._id
            }));
            baseQuestion.options = question.lotItems.map(item => item.text);
          }
          break;
        case 'NUMERIC_ANSWER_TYPE':
          if ('decimalPrecision' in question) {
            baseQuestion.decimalPrecision = question.decimalPrecision;
          }
          if ('expression' in question) {
            baseQuestion.expression = question.expression;
          }
          break;
        case 'DESCRIPTIVE':
          // No additional properties needed for descriptive
          break;
        default:
          break;
      }

      return baseQuestion;
    });
  };

  // Get stored attempt ID or fetch from API
  useEffect(() => {
    const storedAttemptId = localStorage.getItem(`quiz-attempt-${processedQuizId}`);
    if (storedAttemptId) {
      setAttemptId(storedAttemptId);
      // Also restore saved answers if they exist
      const storedAnswers = localStorage.getItem(`quiz-answers-${processedQuizId}`);
      if (storedAnswers) {
        try {
          const parsedAnswers = JSON.parse(storedAnswers);
          setAnswers(parsedAnswers);
        } catch (error) {
          console.error('Failed to parse stored answers:', error);
        }
      }

      // Also restore saved questions if they exist
      const storedQuestions = localStorage.getItem(`quiz-questions-${processedQuizId}`);
      if (storedQuestions) {
        try {
          const parsedQuestions = JSON.parse(storedQuestions);
          setQuizQuestions(parsedQuestions);
        } catch (error) {
          console.error('Failed to parse stored questions:', error);
        }
      }
    }
  }, [processedQuizId]);

  // Convert frontend answers to backend SaveQuestion format
  const convertAnswersToSaveFormat = useCallback((): Array<{
    questionId: string;
    questionType: "DESCRIPTIVE" | "SELECT_MANY_IN_LOT" | "ORDER_THE_LOTS" | "NUMERIC_ANSWER_TYPE" | "SELECT_ONE_IN_LOT";
    answer: {
      lotItemId?: string;
      lotItemIds?: string[];
      answerText?: string;
      value?: number;
      orders?: Order[];
    }
  }> => {
    return quizQuestions
      .filter(question => {
        const userAnswer = answers[question.id];
        // Only include questions that have actual answers
        return userAnswer !== undefined && userAnswer !== null && userAnswer !== '';
      })
      .map(question => {
        const userAnswer = answers[question.id];
        const saveAnswer: {
          lotItemId?: string;
          lotItemIds?: string[];
          answerText?: string;
          value?: number;
          orders?: Order[];
        } = {};

        switch (question.type) {
          case 'SELECT_ONE_IN_LOT':
            if (typeof userAnswer === 'number' && question.lotItems) {
              // Get the lot item ID from the selected index
              const selectedLotItem = question.lotItems[userAnswer];
              if (selectedLotItem && selectedLotItem._id) {
                if (typeof selectedLotItem._id === 'string') {
                  saveAnswer.lotItemId = selectedLotItem._id;
                } else if (selectedLotItem._id.buffer && selectedLotItem._id.buffer.data) {
                  // Convert buffer data to hex string
                  const buffer = selectedLotItem._id.buffer.data;
                  saveAnswer.lotItemId = bufferToHex(buffer);
                }
              }
            }
            break;
          case 'SELECT_MANY_IN_LOT':
            if (Array.isArray(userAnswer) && userAnswer.length > 0 && question.lotItems) {
              // Convert indices to lot item IDs
              saveAnswer.lotItemIds = (userAnswer as number[]).map((index: number) => {
                const lotItem = question.lotItems?.[index];
                if (lotItem && lotItem._id) {
                  if (typeof lotItem._id === 'string') {
                    return lotItem._id;
                  } else if (lotItem._id.buffer && lotItem._id.buffer.data) {
                    // Convert buffer data to hex string
                    const buffer = lotItem._id.buffer.data;
                    return bufferToHex(buffer);
                  }
                }
                return index.toString();
              }).filter(id => !id.match(/^\d+$/)); // Filter out failed conversions (pure numbers)
            }
            break;
          case 'DESCRIPTIVE':
            if (typeof userAnswer === 'string' && userAnswer.trim().length > 0) {
              saveAnswer.answerText = userAnswer;
            }
            break;
          case 'NUMERIC_ANSWER_TYPE':
            if (typeof userAnswer === 'number' && !isNaN(userAnswer)) {
              saveAnswer.value = userAnswer;
            }
            break;

          case 'ORDER_THE_LOTS':
            if (Array.isArray(userAnswer) && userAnswer.length > 0) {
              // For ordering, we need to map the ordered items back to their IDs
              const orders = (userAnswer as string[]).map((item: string, idx: number) => {
                // Find the corresponding lot item for this text
                const lotItem = question.lotItems?.find(lotItem => lotItem.text === item);
                let lotItemId: string = item.toString();
                if (lotItem && lotItem._id) {
                  if (typeof lotItem._id === 'string') {
                    lotItemId = lotItem._id;
                  } else if (lotItem._id.buffer && lotItem._id.buffer.data) {
                    // Convert buffer data to hex string
                    const buffer = lotItem._id.buffer.data;
                    lotItemId = bufferToHex(buffer);
                  }
                }
                return {
                  order: idx + 1,
                  lotItemId
                };
              });
              saveAnswer.orders = orders;
            }
            break;
        }

        return {
          questionId: question.id,
          questionType: question.type,
          answer: saveAnswer
        };
      })
      .filter(questionAnswer => {
        // Only include questions that have valid answer data
        const answer = questionAnswer.answer;
        return Object.keys(answer).length > 0 && Object.values(answer).some(value =>
          value !== undefined && value !== null && value !== '' &&
          (!Array.isArray(value) || value.length > 0)
        );
      });
  }, [quizQuestions, answers]);

  const currentQuestion = quizQuestions[currentQuestionIndex];

  function handleSendStartItem() {
    if (!userId || !currentCourse?.itemId) return;
    console.log({
      params: {
        path: {
          userId,
          courseId: currentCourse.courseId,
          courseVersionId: currentCourse.versionId ?? '',
        },
      },
      body: {
        itemId: currentCourse.itemId,
        moduleId: currentCourse.moduleId ?? '',
        sectionId: currentCourse.sectionId ?? '',
      }
    });
    startItem.mutate({
      params: {
        path: {
          userId,
          courseId: currentCourse.courseId,
          courseVersionId: currentCourse.versionId ?? '',
        },
      },
      body: {
        itemId: currentCourse.itemId,
        moduleId: currentCourse.moduleId ?? '',
        sectionId: currentCourse.sectionId ?? '',
      }
    });
    if (startItem.data?.watchItemId) setWatchItemId(startItem.data?.watchItemId);
    itemStartedRef.current = true;
  }

  function handleStopItem() {
    if (!userId || !currentCourse?.itemId || !currentCourse.watchItemId || !itemStartedRef.current) return;
    console.log({
      params: {
        path: {
          userId,
          courseId: currentCourse.courseId,
          courseVersionId: currentCourse.versionId ?? '',
        },
      },
      body: {
        watchItemId: currentCourse.watchItemId,
        itemId: currentCourse.itemId,
        moduleId: currentCourse.moduleId ?? '',
        sectionId: currentCourse.sectionId ?? '',
      }
    });
    stopItem.mutate({
      params: {
        path: {
          userId,
          courseId: currentCourse.courseId,
          courseVersionId: currentCourse.versionId ?? '',
        },
      },
      body: {
        watchItemId: currentCourse.watchItemId,
        itemId: currentCourse.itemId,
        moduleId: currentCourse.moduleId ?? '',
        sectionId: currentCourse.sectionId ?? '',
      }
    });
    itemStartedRef.current = false;
  }

  // ✅ Expose stop function to parent component
  useImperativeHandle(ref, () => ({
    stopItem: handleStopItem
  }));

  // Get user and course data from stores
  const userId = useAuthStore((state) => state.user?.userId);
  const { currentCourse, setWatchItemId } = useCourseStore();
  const startItem = useStartItem();
  const stopItem = useStopItem();
  
  // ✅ Track if item has been started
  const itemStartedRef = useRef(false);

  const completeQuiz = useCallback(async () => {
    if (!attemptId) {
      console.error('No attempt ID available for submission');
      return;
    }

    try {
      // Convert answers to the format expected by the API
      const answersForSubmission = convertAnswersToSaveFormat();
      // Submit the quiz
      const response = await submitQuiz({
        params: { path: { quizId: processedQuizId, attemptId: attemptId } },
        body: { answers: answersForSubmission }
      });

      console.log('Quiz submitted successfully:', response);

      // Store submission results
      setSubmissionResults(response);

      // Update score from server response if available
      if (showScoreAfterSubmission && response.totalScore !== undefined) {
        setScore(response.totalScore);
      } else {
        // Calculate local score as fallback
        let totalScore = 0;
        quizQuestions.forEach(question => {
          const userAnswer = answers[question.id];
          if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
            totalScore += question.points;
          }
        });
        setScore(totalScore);
      }

      setQuizCompleted(true);
      
      // ✅ Stop tracking item when quiz completes
      handleStopItem();
      
      // Clear attempt ID from localStorage since quiz is completed
      localStorage.removeItem(`quiz-attempt-${processedQuizId}`);

      // Also clear saved answers and questions
      localStorage.removeItem(`quiz-answers-${processedQuizId}`);
      localStorage.removeItem(`quiz-questions-${processedQuizId}`);

    } catch (err) {
      console.error('Failed to submit quiz:', err);
      // Still mark as completed for now, but could show error state
      setQuizCompleted(true);
      // ✅ Stop tracking item even if submission fails
      handleStopItem();
    }
  }, [quizQuestions, answers, attemptId, processedQuizId, submitQuiz, convertAnswersToSaveFormat, showScoreAfterSubmission]);

  const handleNextQuestion = useCallback(async () => {
    // Auto-save progress before moving to next question
    if (attemptId && quizQuestions.length > 0) {
      try {
        const answersForSaving = convertAnswersToSaveFormat();
        await saveQuiz({
          params: { path: { quizId: processedQuizId, attemptId: attemptId } },
          body: { answers: answersForSaving }
        });
        console.log('Progress auto-saved successfully');
      } catch (err) {
        console.error('Failed to auto-save progress:', err);
        // Continue with navigation even if save fails
      }
    }

    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      completeQuiz();
    }
  }, [currentQuestionIndex, quizQuestions.length, completeQuiz, attemptId, processedQuizId, saveQuiz, convertAnswersToSaveFormat]);

  // Manual save progress function
  const saveProgress = useCallback(async () => {
    if (!attemptId || quizQuestions.length === 0) {
      console.error('No attempt ID or questions available for saving');
      return;
    }

    try {
      const answersForSaving = convertAnswersToSaveFormat();
      await saveQuiz({
        params: { path: { quizId: processedQuizId, attemptId: attemptId } },
        body: { answers: answersForSaving }
      });
      console.log('Progress saved successfully');
    } catch (err) {
      console.error('Failed to save progress:', err);
    }
  }, [attemptId, quizQuestions, processedQuizId, saveQuiz, convertAnswersToSaveFormat]);

  const startQuiz = async () => {
    try {
      // Check if we already have an attempt ID stored
      let currentAttemptId = localStorage.getItem(`quiz-attempt-${processedQuizId}`);
      let questionsToUse = quizQuestions;
      if (!currentAttemptId) {
        // Call the API to create a new quiz attempt (only once)
        const response = await attemptQuiz({
          params: { path: { quizId: processedQuizId } }
        });
        console.log('Quiz attempt response:', response);
        currentAttemptId = response.attemptId;
        // Store attempt ID in localStorage
        localStorage.setItem(`quiz-attempt-${processedQuizId}`, currentAttemptId);
        // Convert backend questions to frontend format
        const convertedQuestions = convertBackendQuestions(response.questionRenderViews);
        setQuizQuestions(convertedQuestions);
        questionsToUse = convertedQuestions;

        // Store questions in localStorage
        localStorage.setItem(`quiz-questions-${processedQuizId}`, JSON.stringify(convertedQuestions));

        // Clear any previous answers since this is a new attempt
        setAnswers({});
        localStorage.removeItem(`quiz-answers-${processedQuizId}`);
      } else {
        // If we have an attempt ID but no questions loaded, try to load from localStorage
        if (quizQuestions.length === 0) {
          const storedQuestions = localStorage.getItem(`quiz-questions-${processedQuizId}`);
          if (storedQuestions) {
            try {
              const parsedQuestions = JSON.parse(storedQuestions);
              setQuizQuestions(parsedQuestions);
              questionsToUse = parsedQuestions;
            } catch (error) {
              console.error('Failed to parse stored questions:', error);
              // If we can't load questions from storage, we need to restart
              localStorage.removeItem(`quiz-attempt-${processedQuizId}`);
              localStorage.removeItem(`quiz-questions-${processedQuizId}`);
              localStorage.removeItem(`quiz-answers-${processedQuizId}`);
              // Restart the function
              return startQuiz();
            }
          } else {
            // No stored questions, need to restart
            localStorage.removeItem(`quiz-attempt-${processedQuizId}`);
            localStorage.removeItem(`quiz-answers-${processedQuizId}`);
            // Restart the function
            return startQuiz();
          }
        } else {
          questionsToUse = quizQuestions;
        }
      }
      setAttemptId(currentAttemptId);
      console.log('Quiz attempt started with ID:', currentAttemptId);
      setQuizStarted(true);
      setCurrentQuestionIndex(0);
      // Set timer for first question if available
      if (questionsToUse.length > 0 && questionsToUse[0]?.timeLimit) {
        setTimeLeft(questionsToUse[0].timeLimit);
      }

      // ✅ Start tracking item when quiz begins
      handleSendStartItem();
    } catch (err) {
      console.error('Failed to start quiz:', err);
      // Handle error - maybe show a toast or alert
    }
  };

  const handleAnswer = useCallback((answer: string | number | number[] | string[]) => {
    if (currentQuestion) {
      const newAnswers = {
        ...answers,
        [currentQuestion.id]: answer
      };
      setAnswers(newAnswers);
      // Save answers to localStorage
      localStorage.setItem(`quiz-answers-${processedQuizId}`, JSON.stringify(newAnswers));
    }
  }, [currentQuestion, answers, processedQuizId]);

  // Timer effect
  useEffect(() => {
    if (!quizStarted || quizCompleted || timeLeft <= 0 || doGesture) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, quizCompleted, timeLeft, currentQuestionIndex, handleNextQuestion, doGesture]);

  // Set timer for current question
  useEffect(() => {
    if (quizStarted && currentQuestion?.timeLimit) {
      setTimeLeft(currentQuestion.timeLimit);
    }
  }, [currentQuestionIndex, quizStarted, currentQuestion?.timeLimit]);

  const isAnswerValid = (question: QuizQuestion, answer: string | number | number[] | string[]): boolean => {
    if (answer === undefined || answer === null) return false;

    switch (question.type) {
      case 'SELECT_ONE_IN_LOT': {
        return answer !== undefined && answer !== null;
      }
      case 'SELECT_MANY_IN_LOT': {
        return Array.isArray(answer) && answer.length > 0;
      }
      case 'DESCRIPTIVE': {
        return typeof answer === 'string' && answer.trim().length > 0;
      }
      case 'NUMERIC_ANSWER_TYPE': {
        return typeof answer === 'number' && !isNaN(answer);
      }
      case 'ORDER_THE_LOTS': {
        return Array.isArray(answer) && answer.length === (question.options?.length || 0);
      }
      default:
        return false;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  };

  const getTotalPoints = () => {
    return quizQuestions.reduce((total, q) => total + q.points, 0);
  };

  const getQuestionTypeLabel = (type: string): string => {
    switch (type) {
      case 'SELECT_ONE_IN_LOT': return 'Single Select';
      case 'SELECT_MANY_IN_LOT': return 'Multiple Select';
      case 'DESCRIPTIVE': return 'Descriptive';
      case 'NUMERIC_ANSWER_TYPE': return 'Numerical';
      case 'ORDER_THE_LOTS': return 'Ranking';
      default: return 'Question';
    }
  };

  const formatUserAnswer = (question: QuizQuestion, answer: string | number | number[] | string[]): string => {
    switch (question.type) {
      case 'SELECT_ONE_IN_LOT':
        if (typeof answer === 'number' && question.options) {
          return question.options[answer] || 'Invalid selection';
        }
        return String(answer);
      case 'SELECT_MANY_IN_LOT':
        if (Array.isArray(answer) && question.options) {
          return (answer as number[]).map((index: number) => question.options?.[index] || 'Invalid').join(', ');
        }
        return String(answer);

      case 'DESCRIPTIVE':
        return String(answer);

      case 'NUMERIC_ANSWER_TYPE':
        return String(answer);

      case 'ORDER_THE_LOTS':
        if (Array.isArray(answer)) {
          return answer.join(' → ');
        }
        return String(answer);
      default:
        return String(answer);
    }
  };
  // Reset connection and hint visibility when changing questions
  useEffect(() => {
    setCurrentConnecting(null);
    setShowHint(false);
  }, [currentQuestionIndex]);

  // Handle drag start for ranking items
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // Handle drag over for ranking items
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop for ranking items
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (dragIndex === dropIndex) return;

    const currentRanking = [...((answers[currentQuestion.id] as string[]) || currentQuestion.options || [])];
    const dragItem = currentRanking[dragIndex];

    // Remove item from original position
    currentRanking.splice(dragIndex, 1);
    // Insert at new position
    currentRanking.splice(dropIndex, 0, dragItem);

    handleAnswer(currentRanking);
  }, [currentQuestion, answers, handleAnswer]);

  // Quiz not started
  if (!quizStarted) {
    return (
      <div className="mx-auto space-y-8">
        {/* Hero Section */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/50">
          <CardHeader className="pb-8">
            <div className="flex items-center justify-between gap-8">
              <div className="flex-1 space-y-4 text-left">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Ready to Start Your Quiz?
                </CardTitle>
                <CardDescription className="text-lg text-muted-foreground max-w-lg">
                  Test your knowledge and track your progress. Take your time to read through the information below before starting.
                </CardDescription>
              </div>
              <div className="flex flex-col items-center space-y-4 min-w-fit">
                {deadline && quizType !== 'NO_DEADLINE' && (
                  <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 min-w-[300px]">
                    <CardContent className="flex items-center space-x-3 px-4 py-0">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Deadline: {new Date(deadline).toLocaleDateString()} at {new Date(deadline).toLocaleTimeString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button
                  onClick={startQuiz}
                  size="lg"
                  className="w-full min-w-[300px] h-14 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={releaseTime && new Date() < releaseTime || isPending}
                >
                  <PlayCircle className="mr-3 h-6 w-6" />
                  {isPending ? 'Starting Quiz...' :
                    releaseTime && new Date() < releaseTime ? 'Quiz Not Available Yet' : 'Start Quiz Now'}
                </Button>

                {error && (
                  <div className="text-sm text-red-600 text-center max-w-[300px]">
                    Failed to start quiz. Please try again.
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center max-w-[300px]">
                  Make sure you have a stable internet connection and enough time to complete the quiz.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="text-center p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {
                      Array.isArray(questionBankRefs)
                        ? questionBankRefs.reduce((sum, ref) => sum + (typeof ref === 'object' && ref !== null && 'count' in ref ? (ref as questionBankRef).count || 0 : 1), 0)
                        : 0
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Questions</div>
                </div>
              </Card>

              <Card className="text-center p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-2xl font-bold text-primary">{Math.round(passThreshold * 100)}%</div>
                  <div className="text-sm text-muted-foreground">Pass Score</div>
                </div>
              </Card>
              <Card className="text-center p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-primary">{maxAttempts}</div>
                  <div className="text-sm text-muted-foreground">Max Attempts</div>
                </div>
              </Card>
              <Card className="text-center p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                    <Timer className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="text-2xl font-bold text-primary">{approximateTimeToComplete}</div>
                  <div className="text-sm text-muted-foreground">Est. Time</div>
                </div>
              </Card>
            </div>

          </CardContent>
        </Card>
      </div>
    );
  }

  // Quiz completed
  if (quizCompleted) {
    return (
      <Card className="mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Quiz Completed!</CardTitle>
          <CardDescription>Great job! Here are your results.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display - only show if allowed */}
          {showScoreAfterSubmission && (
            <div className="text-center space-y-4">
              <div className="text-6xl font-bold text-primary drop-shadow-sm">
                {submissionResults?.totalScore !== undefined && submissionResults?.totalMaxScore !== undefined
                  ? `${submissionResults.totalScore}/${submissionResults.totalMaxScore}`
                  : `${score}/${getTotalPoints()}`
                }
              </div>
              <p className="text-xl text-foreground">
                You scored {submissionResults?.totalScore !== undefined && submissionResults?.totalMaxScore !== undefined
                  ? Math.round((submissionResults.totalScore / submissionResults.totalMaxScore) * 100)
                  : Math.round((score / getTotalPoints()) * 100)
                }%
              </p>

              {/* Grading Status Badge */}
              {submissionResults?.gradingStatus && (
                <Badge
                  variant={
                    submissionResults.gradingStatus === 'PASSED' ? 'default' :
                      submissionResults.gradingStatus === 'FAILED' ? 'destructive' :
                        'secondary'
                  }
                  className="text-lg px-4 py-2"
                >
                  {submissionResults.gradingStatus === 'PASSED' && '🎉 Passed!'}
                  {submissionResults.gradingStatus === 'FAILED' && 'Failed - Try Again'}
                  {submissionResults.gradingStatus === 'PENDING' && '⏳ Pending Review'}
                </Badge>
              )}
              {(submissionResults?.totalScore === submissionResults?.totalMaxScore) && (
                <Badge variant="default" className="text-lg px-4 py-2 bg-gradient-to-r from-primary to-chart-2 text-primary-foreground">
                  Perfect Score! 🎉
                </Badge>
              )}
            </div>
          )}

          <Separator />

          <div>
            <h3 className="text-xl font-semibold mb-4">Question Details</h3>
            <div className="space-y-3">
              {quizQuestions.map((question, index) => {
                const userAnswer = answers[question.id];
                const hasAnswer = userAnswer !== undefined && userAnswer !== null && userAnswer !== '';
                // Find feedback for this question if available
                const questionFeedback = submissionResults?.overallFeedback?.find(
                  feedback => feedback.questionId === question.id
                );

                return (
                  <Card
                    key={question.id}
                    className={
                      questionFeedback
                        ? questionFeedback.status === 'CORRECT'
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                          : questionFeedback.status === 'PARTIAL'
                            ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20'
                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                        : hasAnswer
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                          : 'border-gray-200'
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">
                            Q{index + 1}: {getQuestionTypeLabel(question.type)}
                          </Badge>
                          {questionFeedback && (
                            <Badge variant={
                              questionFeedback.status === 'CORRECT' ? 'default' :
                                questionFeedback.status === 'PARTIAL' ? 'secondary' :
                                  'destructive'
                            }>
                              {questionFeedback.status === 'CORRECT' ? '✓ Correct' :
                                questionFeedback.status === 'PARTIAL' ? '◐ Partial' :
                                  '✗ Incorrect'}
                            </Badge>
                          )}
                        </div>
                        <Badge variant={
                          questionFeedback
                            ? questionFeedback.status === 'CORRECT' ? 'default' : 'destructive'
                            : hasAnswer ? 'default' : 'destructive'
                        }>
                          {showScoreAfterSubmission && questionFeedback
                            ? `${questionFeedback.score}/${question.points} Points`
                            : hasAnswer ? `+${question.points}` : '0'
                          }
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        <MathRenderer>
                          {preprocessMathContent(question.question)}
                        </MathRenderer>
                      </p>

                      {/* Show user's answer if any */}
                      {hasAnswer && (
                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Your Answer: {formatUserAnswer(question, userAnswer)}
                          </p>
                        </div>
                      )}
                      {/* Show correct answers if enabled and available */}
                      {showCorrectAnswersAfterSubmission && questionFeedback && (
                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/20 rounded">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">
                            Status: {questionFeedback.status}
                          </p>
                        </div>
                      )}
                      {/* Show explanation if enabled and available */}
                      {showExplanationAfterSubmission && questionFeedback?.answerFeedback && (
                        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            <strong>Explanation:</strong> {questionFeedback.answerFeedback}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="text-center">
            <Button
              onClick={() => {
                // Clear localStorage when retaking quiz
                localStorage.removeItem(`quiz-attempt-${processedQuizId}`);
                localStorage.removeItem(`quiz-answers-${processedQuizId}`);
                localStorage.removeItem(`quiz-questions-${processedQuizId}`);
                setQuizStarted(false);
                setQuizCompleted(false);
                setCurrentQuestionIndex(0);
                setAnswers({});
                setScore(0);
                setQuizQuestions([]);
                setAttemptId(null);
                setSubmissionResults(null);
              }}
              variant="outline"
              size="lg"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake Quiz
            </Button>

            {/* Next Lesson Button for completed quiz */}
            {onNext && (
              <Button
                onClick={onNext}
                disabled={isProgressUpdating}
                className="ml-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
                size="lg"
              >
                {isProgressUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />
                    Processing
                  </>
                ) : (
                  <>
                    Next Lesson
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Quiz in progress
  if (!currentQuestion) {
    return (
      <Card className="mx-auto">
        <CardContent className="p-8 text-center">
          <p className="text-lg text-muted-foreground">Loading questions...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <Badge variant="outline">
            Question {currentQuestionIndex + 1} of {quizQuestions.length}
          </Badge>
          {timeLeft > 0 && (
            <Badge
              variant="secondary"
              className={`font-mono text-lg px-3 py-2 ${timeLeft <= 10 ? 'bg-destructive/20 text-destructive animate-pulse border-destructive/50' : ''}`}
            >
              <Clock className="mr-2 h-4 w-4" />
              {formatTime(timeLeft)}
            </Badge>
          )}
        </div>
        <Progress
          value={((currentQuestionIndex + 1) / quizQuestions.length) * 100}
          className="w-full h-3"
        />
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={currentQuestion.type === 'SELECT_ONE_IN_LOT' ? 'default' :
              currentQuestion.type === 'SELECT_MANY_IN_LOT' ? 'secondary' :
                currentQuestion.type === 'DESCRIPTIVE' ? 'outline' :
                  currentQuestion.type === 'NUMERIC_ANSWER_TYPE' ? 'destructive' :
                    'secondary'}>
              {getQuestionTypeLabel(currentQuestion.type)}
            </Badge>
            <Badge variant="outline">
              <Trophy className="mr-1 h-3 w-3" />
              {currentQuestion.points} points
            </Badge>
          </div>
          <h2 className="text-2xl font-semibold leading-tight">
            <MathRenderer>
              {preprocessMathContent(currentQuestion.question)}
            </MathRenderer>
          </h2>
          {/* Hint section with reveal button */}
          {allowHint && currentQuestion.hint && (
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHint(!showHint)}
                className="w-fit"
              >
                <Eye className="mr-2 h-4 w-4" />
                {showHint ? 'Hide Hint' : 'Reveal Hint'}
              </Button>
              {showHint && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Hint:</strong> <MathRenderer>{preprocessMathContent(currentQuestion.hint)}</MathRenderer>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Single Select (SELECT_ONE_IN_LOT) */}
          {currentQuestion.type === 'SELECT_ONE_IN_LOT' && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id]?.toString()}
              onValueChange={(value) => handleAnswer(parseInt(value))}
              className="space-y-3"
            >
              {currentQuestion.options.map((option, index) => (
                <Label
                  key={index}
                  htmlFor={`option-${index}`}
                  className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer w-full hover:bg-accent/50 transition-colors"
                >
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <span className="flex-1">
                    <MathRenderer>
                      {preprocessMathContent(option)}
                    </MathRenderer>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          )}

          {/* Multi-Select (SELECT_MANY_IN_LOT) */}
          {currentQuestion.type === 'SELECT_MANY_IN_LOT' && currentQuestion.options && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select all that apply:</p>
              {currentQuestion.options.map((option, index) => (
                <Label
                  key={index}
                  htmlFor={`multi-${index}`}
                  className="flex items-center space-x-3 rounded-lg border border-border p-4 hover:bg-accent/50 cursor-pointer w-full transition-colors"
                >
                  <Checkbox
                    id={`multi-${index}`}
                    checked={Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as number[]).includes(index)}
                    onCheckedChange={(checked) => {
                      const currentAnswers = Array.isArray(answers[currentQuestion.id]) ? [...(answers[currentQuestion.id] as number[])] : [];
                      if (checked) {
                        handleAnswer([...currentAnswers, index]);
                      } else {
                        handleAnswer(currentAnswers.filter(i => i !== index));
                      }
                    }}
                  />
                  <span className="flex-1">
                    <MathRenderer>
                      {preprocessMathContent(option)}
                    </MathRenderer>
                  </span>
                </Label>
              ))}
            </div>
          )}

          {/* Descriptive Answer */}
          {currentQuestion.type === 'DESCRIPTIVE' && (
            <div className="space-y-2">
              <Label htmlFor="descriptive-answer">Your Answer</Label>
              <Input
                id="descriptive-answer"
                type="text"
                value={(answers[currentQuestion.id] as string) || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Type your answer here"
                className="text-lg"
              />
            </div>
          )}

          {/* Numerical Input (NUMERIC_ANSWER_TYPE) */}
          {currentQuestion.type === 'NUMERIC_ANSWER_TYPE' && (
            <div className="space-y-2">
              <Label htmlFor="numerical-answer">Enter a number</Label>
              <Input
                id="numerical-answer"
                type="number"
                step={currentQuestion.decimalPrecision ? `0.${'0'.repeat(currentQuestion.decimalPrecision - 1)}1` : 'any'}
                value={(answers[currentQuestion.id] as number) || ''}
                onChange={(e) => handleAnswer(parseFloat(e.target.value) || 0)}
                placeholder="Enter a number"
                className="text-lg"
              />
              {currentQuestion.decimalPrecision && (
                <p className="text-xs">
                  Decimal precision: {currentQuestion.decimalPrecision} places
                </p>
              )}
            </div>
          )}

          {/* Ranking Questions (ORDER_THE_LOTS) */}
          {currentQuestion.type === 'ORDER_THE_LOTS' && currentQuestion.options && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Drag and drop items to rank them:</p>
              <div className="space-y-2">
                {((answers[currentQuestion.id] as string[]) || currentQuestion.options).map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center space-x-3 px-4 py-3 bg-card hover:bg-accent/50 cursor-move transition-colors border border-border rounded-lg"
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="outline" className="min-w-[40px] justify-center">
                      {index + 1}
                    </Badge>
                    <span className="flex-1">
                      <MathRenderer>
                        {preprocessMathContent(item)}
                      </MathRenderer>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={saveProgress}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Saving...
                </>
              ) : (
                'Save Progress'
              )}
            </Button>

            <Button
              onClick={handleNextQuestion}
              disabled={!isAnswerValid(currentQuestion, answers[currentQuestion.id]) || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Submitting...
                </>
              ) : (
                <>
                  {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Show save error if any */}
        {saveError && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              <strong>Save Error:</strong> {saveError}
            </p>
          </div>
        )}

        {/* Show submission error if any */}
        {submitError && currentQuestionIndex === quizQuestions.length - 1 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Submission Error:</strong> {submitError}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

Quiz.displayName = "Quiz";

export default Quiz;
