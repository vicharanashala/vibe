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
import { useAttemptQuiz, useSubmitQuiz, useSaveQuiz, useStartItem, useStopItem } from '@/hooks/hooks';
import { useCourseStore } from "@/store/course-store";
import MathRenderer from "./math-renderer";
import { bufferToHex } from '@/utils/helpers';
import type { QuizQuestion, QuizProps, QuizRef, questionBankRef, QuestionRenderView, SubmitQuizResponse } from "@/types/quiz.types";
import { preprocessMathContent, preprocessRemoveFromOptions } from '@/utils/utils';
import Loader from './Loader';

// Type for Order interface (if not defined elsewhere)
interface Order {
  order: number;
  lotItemId: string;
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
  allowSkip,
  showCorrectAnswersAfterSubmission,
  showExplanationAfterSubmission,
  showScoreAfterSubmission,
  quizId,
  doGesture = false,
  onNext,
  isProgressUpdating,
  attemptId,
  setAttemptId,
  displayNextLesson,
  onPrevVideo,
  setQuizPassed,
  rewindVid,
  setIsQuizSkipped
}, ref) => {
  // console.log('Quiz component rendered with props:', {});
  // ===== CORE STATE =====
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number | number[] | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [submissionResults, setSubmissionResults] = useState<SubmitQuizResponse | null>(null);
  const [dontStart, setDontStart] = useState(false);

  // ===== REFS AND CONSTANTS =====
  const itemStartedRef = useRef(false);
  const quizAttemptedRef = useRef(false);
  const processedQuizId = bufferToHex(quizId);

  // ===== HOOKS =====
  const { currentCourse, setWatchItemId } = useCourseStore();
  const { mutateAsync: attemptQuiz, isPending, error: attemptError,data: attemptData} = useAttemptQuiz();
  const [attempts, setAttempts] = useState<number>(0);
  const { mutateAsync: submitQuiz, isPending: isSubmitting, error: submitError } = useSubmitQuiz();
  const { mutateAsync: saveQuiz, isPending: isSaving, error: saveError } = useSaveQuiz();
  const startItem = useStartItem();
  const stopItem = useStopItem();

  // ===== UTILITY FUNCTIONS =====
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  }, []);

  const getTotalPoints = useCallback(() => {
    return quizQuestions.reduce((total, q) => total + q.points, 0);
  }, [quizQuestions]);

  const getQuestionTypeLabel = useCallback((type: string): string => {
    switch (type) {
      case 'SELECT_ONE_IN_LOT': return 'Single Select';
      case 'SELECT_MANY_IN_LOT': return 'Multiple Select';
      case 'DESCRIPTIVE': return 'Descriptive';
      case 'NUMERIC_ANSWER_TYPE': return 'Numerical';
      case 'ORDER_THE_LOTS': return 'Ranking';
      default: return 'Question';
    }
  }, []);

  const formatUserAnswer = useCallback((question: QuizQuestion, answer: string | number | number[] | string[]): string => {
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
  }, []);

  const isAnswerValid = useCallback((question: QuizQuestion, answer: string | number | number[] | string[]): boolean => {
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
  }, []);

  // ===== DATA CONVERSION FUNCTIONS =====
  const convertBackendQuestions = useCallback((questionRenderViews: QuestionRenderView[]): QuizQuestion[] => {
    return questionRenderViews.map((question) => {
      // Convert BufferId to string using the bufferToHex utility
      let questionId: string;
      if (question._id && typeof question._id === 'object' && 'buffer' in question._id) {
        // Handle BufferId type - convert buffer data to hex string
        questionId = bufferToHex((question._id));
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
  }, []);

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
      .map(question => {
        const userAnswer = answers[question.id];
        const saveAnswer: {
          lotItemId?: string;
          lotItemIds?: string[];
          answerText?: string;
          value?: number;
          orders?: Order[];
        } = {};
        
        if (!userAnswer&& typeof userAnswer !== 'number') {
          // Default values for empty answers
          saveAnswer.lotItemId = '111111111111111111111111';
          saveAnswer.lotItemIds = ['111111111111111111111111'];
          saveAnswer.answerText = 'a';
          saveAnswer.value = -1e40;
          saveAnswer.orders = [];
          return {
            questionId: question.id,
            questionType: question.type,
            answer: saveAnswer
          };
        }

        switch (question.type) {
          case 'SELECT_ONE_IN_LOT':
            if (typeof userAnswer === 'number' && question.lotItems) {
              const selectedLotItem = question.lotItems[userAnswer];
              if (selectedLotItem && selectedLotItem._id) {
                if (typeof selectedLotItem._id === 'string') {
                  saveAnswer.lotItemId = selectedLotItem._id;
                } else if (selectedLotItem._id.buffer && selectedLotItem._id) {
                  const buffer = selectedLotItem._id;
                  saveAnswer.lotItemId = bufferToHex(buffer);
                }
              }
            }
            break;
          case 'SELECT_MANY_IN_LOT':
            if (Array.isArray(userAnswer) && userAnswer.length > 0 && question.lotItems) {
              saveAnswer.lotItemIds = (userAnswer as number[]).map((index: number) => {
                const lotItem = question.lotItems?.[index];
                if (lotItem && lotItem._id) {
                  if (typeof lotItem._id === 'string') {
                    return lotItem._id;
                  } else if (lotItem._id.buffer && lotItem._id) {
                    const buffer = lotItem._id;
                    return bufferToHex(buffer);
                  }
                }
                return index.toString();
              }).filter(id => !id.match(/^\d+$/)); // Filter out failed conversions
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
              const orders = (userAnswer as string[]).map((item: string, idx: number) => {
                const lotItem = question.lotItems?.find(lotItem => lotItem.text === item);
                let lotItemId: string = item.toString();
                if (lotItem && lotItem._id) {
                  if (typeof lotItem._id === 'string') {
                    lotItemId = lotItem._id;
                  } else if (lotItem._id.buffer && lotItem._id) {
                    const buffer = lotItem._id;
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

  // ===== COURSE ITEM TRACKING FUNCTIONS =====
  const handleSendStartItem = useCallback(async () => {
    if (!currentCourse?.itemId) return;
    try {
      const response = await startItem.mutateAsync({
        params: {
          path: {
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

      if (!response?.watchItemId) {
        console.error('No watchItemId returned from startItem');
        return;
      }
      if (response?.watchItemId) setWatchItemId(response.watchItemId);
      itemStartedRef.current = true;
    } catch (error) {
      console.error('Failed to start item:', error);
    }
  }, [currentCourse, startItem, setWatchItemId]);

  const handleStopItem = useCallback((isSkipped?:boolean) => {
    if (!currentCourse?.itemId || !currentCourse.watchItemId) {
      itemStartedRef.current = false;
      return;
    }
    
    if (!itemStartedRef.current) {
      return;
    }
    
    stopItem.mutate({
      params: {
        path: {
          courseId: currentCourse.courseId,
          courseVersionId: currentCourse.versionId ?? '',
        },
      },
      body: {
        watchItemId: currentCourse.watchItemId,
        itemId: currentCourse.itemId,
        moduleId: currentCourse.moduleId ?? '',
        sectionId: currentCourse.sectionId ?? '',
        attemptId,
        isSkipped
      }
    });
    itemStartedRef.current = false;
  }, [currentCourse, stopItem, attemptId]);

  // ===== QUIZ LIFECYCLE FUNCTIONS =====
  const startQuiz = useCallback(async () => {
    // Prevent multiple attempts for the same quiz
    if (quizAttemptedRef.current || quizStarted || isPending) {
      return;
    }
    
    quizAttemptedRef.current = true;
    
    try {
      // Remove previous stop call
      // if (itemStartedRef.current) {
      //   handleStopItem();
      // }

      // Create new quiz attempt
      const response = await attemptQuiz({
        params: { path: { quizId: processedQuizId } }
      });
      
      const currentAttemptId = response.attemptId;
      setAttemptId?.(currentAttemptId);
      
      // Convert backend questions to frontend format
      const convertedQuestions = convertBackendQuestions(response.questionRenderViews);
      setQuizQuestions(convertedQuestions);
      
      // Reset quiz state
      setAnswers({});
      setQuizStarted(true);
      setCurrentQuestionIndex(0);
      
      // Set timer for first question if available
      if (convertedQuestions.length > 0 && convertedQuestions[0]?.timeLimit) {
        setTimeLeft(convertedQuestions[0].timeLimit);
      }

      // Start tracking item
      await handleSendStartItem();
    } catch (err) {
      console.error('Failed to start quiz:', err);
      // Reset the flag on error so user can try again
      quizAttemptedRef.current = false;
    }
  }, [attemptQuiz, processedQuizId, setAttemptId, convertBackendQuestions, handleSendStartItem, quizStarted, isPending]);

  const completeQuiz = useCallback(async (isSkipped?:boolean) => {
    if (!attemptId) {
      console.error('No attempt ID available for submission');
      return;
    }

    try {
      const answersForSubmission = convertAnswersToSaveFormat();
      const response = await submitQuiz({
        params: { path: { quizId: processedQuizId, attemptId: attemptId } },
        body: { answers: answersForSubmission, isSkipped }
      });
      
      if(!response){
        setQuizCompleted(true);
        handleStopItem(isSkipped);
        return
      }
      // Convert the response to match the expected type
      const formattedResponse: SubmitQuizResponse = {
        ...response,
        gradedAt: response.gradedAt ? new Date(response.gradedAt).toISOString() : undefined,
      };
      
      setSubmissionResults(formattedResponse);

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
      handleStopItem();
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      // setQuizCompleted(true);
      handleStopItem();
    }
  }, [attemptId, convertAnswersToSaveFormat, submitQuiz, processedQuizId, showScoreAfterSubmission, quizQuestions, answers, handleStopItem]);

  const handleNextQuestion = useCallback(async () => {
    setTimeLeft(0);

    // Auto-save progress before moving to next question
    if (attemptId && quizQuestions.length > 0) {
      try {
        const answersForSaving = convertAnswersToSaveFormat();
        await saveQuiz({
          params: { path: { quizId: processedQuizId, attemptId: attemptId } },
          body: { answers: answersForSaving }
        });
      } catch (err) {
        console.error('Failed to auto-save progress:', err);
      }
    }

    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      completeQuiz();
    }
  }, [currentQuestionIndex, quizQuestions.length, completeQuiz, attemptId, processedQuizId, saveQuiz, convertAnswersToSaveFormat]);

    // Track attempts using the attempt data from the hook
    useEffect(() => {
      if (attemptData) {
        console.log("Attempt data: ", attemptData);

        // Update the attempt count when a new attempt is created
        setAttempts(attemptData.userAttempts);
      }
    }, [attemptData]);

  const handleSkipQuiz = useCallback(async () => {

    // 1. if no attempt id return
    if (!attemptId) return;
    setIsQuizSkipped(true);
    try {
      // flag for skipping
      const isSkipped = true;
      // submit the quiz with isSkipped payload
      completeQuiz(isSkipped);
      } catch (error) {
        setIsQuizSkipped(false);
        console.error('Error during quiz skip:', error);
      }
  }, [attempts, processedQuizId,handleStopItem,onNext]);


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
    } catch (err) {
      console.error('Failed to save progress:', err);
    }
  }, [attemptId, quizQuestions, processedQuizId, saveQuiz, convertAnswersToSaveFormat]);

  const currentQuestion = quizQuestions[currentQuestionIndex];

  const handleAnswer = useCallback((answer: string | number | number[] | string[] | undefined) => {
    if (answer === undefined) return;
    if (!currentQuestion) return;
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
  }, [currentQuestion]);

  const resetQuiz = useCallback(() => {
    setQuizStarted(false);
    setQuizCompleted(false);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setScore(0);
    setQuizQuestions([]);
    setAttemptId?.('');
    setSubmissionResults(null);
    setShowHint(false);
    setTimeLeft(0);
    // Reset the attempt flag so quiz can be started again
    quizAttemptedRef.current = false;
  }, [setAttemptId]);

  // ===== DRAG AND DROP HANDLERS =====
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (dragIndex === dropIndex) return;

    if (!currentQuestion) return;

    const currentRanking = [...((answers[currentQuestion.id] as string[]) || currentQuestion.options || [])];
    const dragItem = currentRanking[dragIndex];

    currentRanking.splice(dragIndex, 1);
    currentRanking.splice(dropIndex, 0, dragItem);

    handleAnswer(currentRanking);
  }, [answers, currentQuestion, handleAnswer]);

  // ===== EFFECTS =====

  useEffect(()=> {
    if(attemptError && attemptError.includes("No available attempts") ){
      onNext?.();
      return;
    }
  },[attemptError, currentQuestion])

  // Reset state when quiz ID changes
  useEffect(() => {
    resetQuiz();
  }, [processedQuizId, resetQuiz]);

  useEffect(() => {
    if (rewindVid){
      onPrevVideo?.();
      resetQuiz();
      setQuizStarted(false);
      setQuizCompleted(false);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setScore(0);
      setQuizQuestions([]);
      setAttemptId?.('');
      setSubmissionResults(null);
      setShowHint(false);
      setTimeLeft(0);
      quizAttemptedRef.current = false;
    }}, [rewindVid]);

  // Timer effect
   useEffect(() => {
    if (!quizStarted || quizCompleted || doGesture || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-advance to next question when time runs out (uncomment if needed)
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, quizCompleted, doGesture, timeLeft]);
  // Set timer for current question
  useEffect(() => {
    if (quizStarted && !quizCompleted && currentQuestion?.timeLimit) {
      setTimeLeft(currentQuestion.timeLimit);
    }
  }, [currentQuestionIndex, quizStarted, quizCompleted, currentQuestion?.timeLimit]);

  // Reset hint when changing questions
  useEffect(() => {
    setShowHint(false);
  }, [currentQuestionIndex]);

  // Auto-start quiz for NO_DEADLINE type
  useEffect(() => {
    if (!quizStarted && !quizCompleted && quizType === 'NO_DEADLINE' && quizQuestions.length === 0 && !isPending && !quizAttemptedRef.current && !dontStart) {
      startQuiz();
      setDontStart(true);
    }
  }, [quizType, quizStarted, quizCompleted, quizQuestions.length, isPending, dontStart]);


  useEffect(() => {
    if (quizCompleted) {
      setDontStart(false);
    }
  }, [quizCompleted, dontStart]);

  // Handle quiz completion for NO_DEADLINE type
  useEffect(() => {
    if (quizCompleted && quizType === 'NO_DEADLINE') {
      setQuizCompleted(false);
      if (submissionResults?.gradingStatus !== "FAILED") {
        setQuizPassed?.(1);
        onNext?.();
      } else {
        setQuizPassed?.(0);
        onPrevVideo?.();
      }
    }
  }, [quizCompleted, quizType, submissionResults?.gradingStatus, setQuizPassed, onNext, onPrevVideo]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Remove this cleanup call so stop is only called after submission
      // if (itemStartedRef.current) {
      //   handleStopItem();
      // }
    };
  }, [handleStopItem]);

  // ===== IMPERATIVE HANDLE =====
  useImperativeHandle(ref, () => ({
    stopItem: handleStopItem,
    cleanup: () => {
      // Remove the stop call here too
      // if (itemStartedRef.current) {
      //   handleStopItem();
      // }
      resetQuiz();
    }
  }), [handleStopItem, resetQuiz]);

  // ===== RENDER LOGIC =====
  // Quiz not started
  if (!quizStarted) {
    // console.log("QUIZTYPE:", quizType);
    if (quizType === 'DEADLINE'){
      return (
        <div className="mx-auto space-y-8">
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
                  {deadline && (
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

                  {attemptError && (
                    <div className="text-sm text-red-600 text-center max-w-[300px]">
                      {attemptError || 'Failed to start quiz. Please try again later.'}
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

              {/* Show Next Lesson button at the bottom if displayNextLesson is true */}
              {displayNextLesson && onNext && (
                <div className="text-center pt-4">
                  <Button
                    onClick={onNext}
                    disabled={isProgressUpdating}
                    variant="outline"
                    size="lg"
                    className="min-w-[300px] h-12 text-lg font-semibold border-2 hover:bg-accent transition-all duration-200"
                  >
                    {isProgressUpdating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-3" />
                        Processing
                      </>
                    ) : (
                      <>
                        Skip to Next Lesson
                        <ChevronRight className="h-5 w-5 ml-3" />
                      </>
                    )}
                  </Button>
                </div>
              )}
              {!displayNextLesson && onPrevVideo && (
                <div className="text-center pt-4">
                  <Button
                    onClick={onPrevVideo}
                    disabled={isProgressUpdating}
                    variant="outline"
                    size="lg"
                    className="min-w-[300px] h-12 text-lg font-semibold border-2 hover:bg-accent transition-all duration-200"
                  >
                    <ChevronLeft className="h-5 w-5 mr-3" />
                    Rewatch Previous Video
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
    else {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader />
          <span
          className='text-lg text-muted-foreground ml-4'
          > Loading quiz...</span>
        </div>
      );
    }

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

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
            {onPrevVideo && (
              <Button
                onClick={onPrevVideo}
                disabled={isProgressUpdating}
                variant="outline"
                size="lg"
                className="min-w-[220px] h-12 text-lg font-semibold border-2 hover:bg-accent transition-all duration-200"
              >
                <ChevronLeft className="h-5 w-5 mr-3" />
                Rewatch Previous Video
              </Button>
            )}
            <Button
              onClick={resetQuiz}
              variant="outline"
              size="lg"
              className="min-w-[220px] h-12 text-lg font-semibold border-2 hover:bg-accent transition-all duration-200"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake Quiz
            </Button>
            {onNext && (submissionResults?.gradingStatus !== "FAILED") && (
              <Button
                onClick={onNext}
                disabled={isProgressUpdating}
                className="min-w-[220px] h-12 text-lg font-semibold ml-0 md:ml-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
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
              key={currentQuestion.id}
              name={`question-${currentQuestion.id}`}
              value={answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id].toString() : undefined}
              onValueChange={(value) => handleAnswer(value ? parseInt(value) : undefined)}
              className="space-y-3"
            >
              {currentQuestion.options.map((option, index) => (
                <Label
                  key={index}
                  htmlFor={`option-${currentQuestion.id}-${index}`}
                  className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer w-full hover:bg-accent/50 transition-colors"
                >
                  <RadioGroupItem value={index.toString()} id={`option-${currentQuestion.id}-${index}`} />
                  <span className="flex-1">
                    <MathRenderer>
                      {preprocessMathContent(preprocessRemoveFromOptions(option))}
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
                  htmlFor={`multi-${currentQuestion.id}-${index}`}
                  className="flex items-center space-x-3 rounded-lg border border-border p-4 hover:bg-accent/50 cursor-pointer w-full transition-colors"
                >
                  <Checkbox
                    id={`multi-${currentQuestion.id}-${index}`}
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
                      {preprocessMathContent(preprocessRemoveFromOptions(option))}
                    </MathRenderer>
                  </span>
                </Label>
              ))}
            </div>
          )}

          {/* Descriptive Answer */}
          {currentQuestion.type === 'DESCRIPTIVE' && (
            <div className="space-y-2">
              <Label htmlFor={`descriptive-answer-${currentQuestion.id}`}>Your Answer</Label>
              <Input
                id={`descriptive-answer-${currentQuestion.id}`}
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
              <Label htmlFor={`numerical-answer-${currentQuestion.id}`}>Enter a number</Label>
              <Input
                id={`numerical-answer-${currentQuestion.id}`}
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
                        {preprocessMathContent(preprocessRemoveFromOptions(item))}
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
        <div className="flex justify-between items-center">
          {/* Skip button (shown after 5 attempts) */}
          {(allowSkip==true) && (
          // {(attempts >= 5 && allowSkip==true) && (
            <Button
              // variant="outline"
              onClick={handleSkipQuiz}
              // className="text-white hover:text-background/90 hover:bg-foreground/10"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Skipping...' : 'Skip Quiz'}
            </Button>
          )}
          
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
