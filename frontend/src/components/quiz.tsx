import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Clock, Trophy, ChevronLeft, ChevronRight, RotateCcw, GripVertical, PlayCircle, BookOpen, Target, Timer, Users, AlertCircle, Eye, FileQuestion, ChevronDown } from "lucide-react";
import { useAttemptQuiz, useSubmitQuiz, useSaveQuiz, useStartItem, useStopItem, CreateAttemptResponse, SaveQuizResponse, useSkipOptionalItem, useSubmitStudentQuestion } from '@/hooks/hooks';
import { useCourseStore } from "@/store/course-store";
import MathRenderer from "./math-renderer";
import { bufferToHex } from '@/utils/helpers';
import type { QuizQuestion, QuizProps, QuizRef, questionBankRef, QuestionRenderView, SubmitQuizResponse } from "@/types/quiz.types";
import { preprocessMathContent, preprocessRemoveFromOptions } from '@/utils/utils';
import Loader from './Loader';
import { error } from 'console';
import { NavigatingOverlay } from './video';
import StudentQuestionComposer from './StudentQuestionComposer';
import type { StudentQuestionSubmissionPayload } from '@/types/student-question.types';

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
  isNavigatingToPrev,
  attemptId,
  setAttemptId,
  displayNextLesson,
  onPrevVideo,
  setQuizPassed,
  rewindVid,
  setIsQuizSkipped,
  linearProgressionEnabled,
  isAlreadyWatched,
  completedItemIdsRef,
  nextItemId,
  pendingStudentQuestionContext,
  clearPendingStudentQuestionContext,
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
  const [isEmptyQuiz, setIsEmptyQuiz] = useState(false);
  const [noAttemptsLeft, setNoAttemptsLeft] = useState(false);
  //  const [explanationBox, setExplanationBox] = useState<{
  //   open: boolean;
  //   text: string;
  //   result?: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT';
  //   resolve?: () => void;
  // }>({ open: false, text: "" });
  // const [showExplanation, setShowExplanation] = useState(false)
  const [failedRedirectCountdown, setFailedRedirectCountdown] = useState<number | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [emptyQuizRedirectCountdown, setEmptyQuizRedirectCountdown] = useState<number | null>(null);
  const emptyQuizNextTimerRef = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);
  const [finshingQuiz, setFinshingQuiz] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  // ===== REFS AND CONSTANTS =====
  const itemStartedRef = useRef(false);
  const quizAttemptedRef = useRef(false);
  const processedQuizId = bufferToHex(quizId);

  // ===== HOOKS =====
  const { currentCourse, setWatchItemId } = useCourseStore();
  const { mutateAsync: attemptQuiz, isPending, error: attemptError, data: attemptData } = useAttemptQuiz();
  const [attempts, setAttempts] = useState<number>(0);
  const { mutateAsync: submitQuiz, isPending: isSubmitting, error: submitError } = useSubmitQuiz();
  const { mutateAsync: saveQuiz, isPending: isSaving, error: saveError } = useSaveQuiz();
  const startItem = useStartItem();
  const stopItem = useStopItem();
  const isStopping = stopItem.isPending;
  const { mutateAsync: skipItemAsync } = useSkipOptionalItem();
  const { submitQuestion, loading: isSubmittingQuestion } = useSubmitStudentQuestion();

  const handleDismissPendingQuestion = useCallback(() => {
    setShowQuestionModal(false);
    clearPendingStudentQuestionContext?.();
  }, [clearPendingStudentQuestionContext]);

  const handleQuestionSubmit = useCallback(async (payload: StudentQuestionSubmissionPayload) => {
    if (!pendingStudentQuestionContext) {
      toast.error('Unable to submit question for this video.');
      return;
    }

    try {
      await submitQuestion(
        pendingStudentQuestionContext.courseId,
        pendingStudentQuestionContext.courseVersionId,
        pendingStudentQuestionContext.segmentId,
        payload,
      );
      toast.success('Question submitted successfully');
      handleDismissPendingQuestion();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit question');
    }
  }, [handleDismissPendingQuestion, pendingStudentQuestionContext, submitQuestion]);

  const handleContinueToQuiz = useCallback(() => {
    clearPendingStudentQuestionContext?.();
  }, [clearPendingStudentQuestionContext]);

  useEffect(() => {
    if (!pendingStudentQuestionContext) {
      setShowQuestionModal(false);
    }
  }, [pendingStudentQuestionContext]);

  const handleSkipItem = async () => {
    if (!currentCourse?.itemId) return;
    try {

      await skipItemAsync({ params: { path: { itemId: currentCourse?.itemId }, query: { cohortId: currentCourse?.cohortId } } });

    } catch (error) {
      console.error('Error skipping item:', error);
      toast.error('Failed to skip item');
    }
  };

  // ===== UTILITY FUNCTIONS =====


  //   function showExplanationBox(text: string, result?: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT') {
  //   setShowExplanation(true)
  //   return new Promise<void>((resolve) => {
  //     setExplanationBox({
  //       open: true,
  //       text,
  //       result,
  //       resolve,
  //     });
  //     // AUTO-CLOSE after 3 seconds
  //     setTimeout(() => {
  //       setExplanationBox(prev => {
  //         if (prev.open) {
  //           prev.resolve?.();
  //         }
  //         setShowExplanation(false)
  //         return { open: false, text: "" };
  //       });
  //     }, 3500);
  //   });
  // }



  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  }, []);

  const getTotalPoints = useCallback(() => {
    return quizQuestions.reduce((total, q) => total + q.points, 0);
  }, [quizQuestions]);
  // console.log('converted questionssssssssssssssssssssssssss',converted)  
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
            // baseQuestion.lotItems = question.lotItems.map(item => ({

            //   text: item.text,
            //   explaination: item.explaination ||'', // This field doesn't exist in LotItem from API
            //   _id: typeof item._id === 'string' ? item._id : item._id
            // }));
            baseQuestion.lotItems = question.lotItems.map(item => {
              let optionId: string;

              if (item._id && typeof item._id === 'object' && 'buffer' in item._id) {
                optionId = bufferToHex(item._id);  // ✅ convert buffer to string
              } else {
                optionId = String(item._id);
              }

              return {
                text: item.text,
                explaination: item.explaination || '',
                _id: optionId,
              };
            });
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

        /*if (!userAnswer&& typeof userAnswer !== 'number') {
          // Default values for empty answers
          saveAnswer.lotItemId = '111111111111111111111111';
          //saveAnswer.lotItemIds = ['111111111111111111111111'];
         // saveAnswer.answerText = 'a';
         // saveAnswer.value = -1e40;
         // saveAnswer.orders = [];
          return {
            questionId: question.id,
            questionType: question.type,
            answer: saveAnswer
          };
        }*/

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
      if(!isAlreadyWatched && (currentCourse!.itemId && !completedItemIdsRef.current.has(currentCourse!.itemId))){
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
            cohortId: currentCourse.cohortId ?? '',
          }
        });

        if (!response?.watchItemId) {
          console.error('No watchItemId returned from startItem');
          return;
        }
        if (response?.watchItemId) setWatchItemId(response.watchItemId);
      }
      itemStartedRef.current = true;
    } catch (error) {
      console.error('Failed to start item:', error);
    }
  }, [currentCourse, startItem, setWatchItemId, isAlreadyWatched, completedItemIdsRef]);

  const handleStopItem = useCallback(async (isSkipped?: boolean) => {
    if (!currentCourse?.itemId || !currentCourse.watchItemId) {
      itemStartedRef.current = false;
      return;
    }

    if (!itemStartedRef.current) {
      return;
    }

    if((isAlreadyWatched || completedItemIdsRef.current.has(currentCourse.itemId)) ){
      return;
    }

    await stopItem.mutateAsync({
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
        isSkipped,
        nextItemId,
        cohortId: currentCourse.cohortId ?? '',
      }
    });
    completedItemIdsRef.current.add(currentCourse.itemId);
    itemStartedRef.current = false;
  }, [currentCourse, stopItem, attemptId, isAlreadyWatched, completedItemIdsRef]);


  const stopItemAsync = useCallback(
    async (isSkipped?: boolean) => {
      if (!currentCourse?.itemId || !currentCourse.watchItemId) {
        itemStartedRef.current = false;
        return;
      }

      if (!itemStartedRef.current) {
        return;
      }

      await stopItem.mutateAsync({
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
          isSkipped,
          nextItemId,
          cohortId: currentCourse.cohortId ?? '',
        },
      });

      itemStartedRef.current = false;
    },
    [currentCourse, stopItem, attemptId]
  );

  useEffect(() => {
    return () => {
      if (emptyQuizNextTimerRef.current) {
        clearTimeout(emptyQuizNextTimerRef.current);
      }
    };
  }, []);

  // Handle empty quiz without attempting to start it
  const handleEmptyQuiz = useCallback(async () => {
    try {
      // Set empty quiz states
      setIsEmptyQuiz(true);
      setQuizStarted(true);
      setQuizCompleted(true);
    } catch (error) {
      console.error('Error handling empty quiz:', error);
      toast.error('Error processing empty quiz. Please try refreshing.');
    }
  }, []);

  useEffect(() => {
    if (emptyQuizRedirectCountdown === null) return;
    if (emptyQuizRedirectCountdown <= 0) {
      setEmptyQuizRedirectCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setEmptyQuizRedirectCountdown(prev => prev !== null ? prev - 1 : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [emptyQuizRedirectCountdown]);

  // Handle empty quiz after quiz attempt was already made
  const handleEmptyQuizAfterAttempt = useCallback(async () => {
    try {
      // Set empty quiz states
      setIsEmptyQuiz(true);
      setQuizStarted(true);
      setQuizCompleted(true);
      setQuizPassed?.(1);

      toast.info('No questions available in this quiz.');
    } catch (error) {
      console.error('Error handling empty quiz after attempt:', error);
      toast.error('Error processing empty quiz. Please try refreshing.');
    }
  }, [setQuizPassed]);

  // ===== QUIZ LIFECYCLE FUNCTIONS =====
  const startQuiz = useCallback(async () => {
    // Prevent multiple attempts for the same quiz
    if (quizAttemptedRef.current || quizStarted || isPending) {
      return;
    }

    clearPendingStudentQuestionContext?.();

    quizAttemptedRef.current = true;

    try {
      // Remove previous stop call
      // if (itemStartedRef.current) {
      //   handleStopItem();
      // }
      // Create new quiz attempt
      const response = await attemptQuiz({
        params: { path: { quizId: processedQuizId } },
        body: { cohortId: currentCourse?.cohortId ?? '' }
      }) as CreateAttemptResponse | { message: string };

      // Check if we got a message about no attempts left 
      if ('message' in response) {
        console.log('Quiz attempt failed with message:', response.message);
        toast.error(response.message);

        // Instead of showing UI, properly mark the quiz as completed with skip
        setQuizCompleted(true);
        setQuizPassed?.(1);

        // Start tracking item first so we can stop it with isSkipped
        await handleSendStartItem();

        // Mark the quiz as skipped in the progress system
        setTimeout(() => {
          handleStopItem(true); // isSkipped = true
        }, 500);

        // Set flag to show completion UI
        setNoAttemptsLeft(true);
        return;
      }

      const currentAttemptId = response.attemptId;
      setAttemptId?.(currentAttemptId);

      // Convert backend questions to frontend format
      const convertedQuestions = convertBackendQuestions(response.questionRenderViews);
      setQuizQuestions(convertedQuestions);

      // Check if quiz is empty (no questions available)
      if (convertedQuestions.length === 0) {
        console.log('Empty quiz detected after attempt - no questions returned');
        // Handle empty quiz with completion and navigation
        await handleEmptyQuizAfterAttempt();
        return;
      }

      // Reset quiz state for non-empty quizzes
      setAnswers({});
      setQuizStarted(true);
      setCurrentQuestionIndex(0);
      setIsEmptyQuiz(false);

      // Set timer for first question if available
      if (convertedQuestions.length > 0 && convertedQuestions[0]?.timeLimit) {
        setTimeLeft(convertedQuestions[0].timeLimit);
      }

      // Start tracking item
      await handleSendStartItem();
    } catch (err: any) {
      console.error('Failed to start quiz:', err);

      let errorMessage = 'Unknown error';
      try {
        errorMessage = err?.message || err?.error?.message || err?.response?.data?.message ||
          (typeof err === 'string' ? err : JSON.stringify(err));
      } catch {
        errorMessage = 'Failed to start quiz';
      }
      console.log('Error message:', errorMessage);

      if (errorMessage && (errorMessage.includes('No available attempts left') || errorMessage.includes('no available attempts'))) {
        toast.info('You have used all available attempts for this quiz.');

        setQuizCompleted(true);
        setQuizPassed?.(1);
        setNoAttemptsLeft(true);

        return;
      }

      quizAttemptedRef.current = false;
      toast.error('Failed to start quiz: ' + errorMessage);
    }
  }, [attemptQuiz, processedQuizId, setAttemptId, convertBackendQuestions, handleSendStartItem, quizStarted, isPending, clearPendingStudentQuestionContext]);

  const completeQuiz = useCallback(async (isSkipped?: boolean) => {
    if (!attemptId) {
      console.error('No attempt ID available for submission');
      return;
    }
    setFinshingQuiz(true);
    try {
      // For non-skipped quizzes, save all answers first, then submit
      if (!isSkipped) {
        try {
          const answersForSaving = convertAnswersToSaveFormat();
          await saveQuiz({
            params: { path: { quizId: processedQuizId, attemptId: attemptId } },
            body: { answers: answersForSaving, cohortId: currentCourse?.cohortId??'' }
          });
        } catch (saveErr) {
          console.warn('Failed to save answers before submission:', saveErr);
          toast.error('Failed to save answers before submission');
          // Continue with submission even if save fails
        }
      }

      const answersForSubmission = convertAnswersToSaveFormat();
      const response = await submitQuiz({
        params: { path: { quizId: processedQuizId, attemptId: attemptId } },
        body: {
          answers: answersForSubmission, isSkipped, courseId: currentCourse?.courseId,
          courseVersionId: currentCourse?.versionId,
          cohortId: currentCourse?.cohortId??''
        }
      });

      // No response for skipped quiz!
      if (!response) {
        // ✅ Stop will be called by course-page.tsx via ref
        setQuizCompleted(true);
        setFinshingQuiz(false);
        return;
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

      // Only call stopItem for PASSED quizzes to mark them as completed
      if (response.gradingStatus === 'PASSED') {
        // console.log('Quiz passed - marking as completed');
        try {
          await handleStopItem(false);
        } catch (stopError) {
          console.error('Failed to update progress after quiz pass:', stopError);
        }
      }
      completedItemIdsRef.current.add(processedQuizId);

      setQuizCompleted(true);
      setFinshingQuiz(false);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
        setQuizCompleted(false);
      setFinshingQuiz(false);
    }
  }, [attemptId, convertAnswersToSaveFormat, submitQuiz, processedQuizId, showScoreAfterSubmission, quizQuestions, answers, handleStopItem, saveQuiz]);

  const handleNextQuestion = useCallback(async () => {
    setTimeLeft(0);

    //   if (attemptId && quizQuestions.length > 0) {
    //   try {
    //     const answersForSaving = convertAnswersToSaveFormat();
    //     const response = await saveQuiz({
    //       params: { path: { quizId: processedQuizId, attemptId: attemptId } },
    //       body: { answers: answersForSaving }
    //     });

    //     // Use response explanation and result if available
    //     if (response && response.explanation && response.explanation.trim() && response.explanation !== 'Nil') {
    //       await showExplanationBox(response.explanation, response.result);
    //     }
    //   } catch (err: any) {
    //     const errorMessage =
    //       err?.message || (typeof err === 'string' ? err : null) ||
    //       "Failed to save, try again!";
    //     toast.error(errorMessage);
    //     console.error('Failed to auto-save progress:', err);
    //   }
    // }

    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      completeQuiz();
    }
  }, [currentQuestionIndex, quizQuestions.length, completeQuiz, timeLeft, quizStarted]);

  // Track attempts using the attempt data from the hook
  useEffect(() => {
    if (attemptData) {

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
  }, [attempts, processedQuizId, handleStopItem, onNext]);


  const saveProgress = useCallback(async () => {     //one here
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
    setIsEmptyQuiz(false);
    setNoAttemptsLeft(false);
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

  // Reset state when quiz ID changes
  useEffect(() => {
    resetQuiz();
  }, [processedQuizId, resetQuiz]);

  useEffect(() => {
    if (rewindVid) {
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
      setIsEmptyQuiz(false);
      setNoAttemptsLeft(false);
      quizAttemptedRef.current = false;
    }
  }, [rewindVid]);

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

  // Auto-start quiz for NO_DEADLINE type, but first check if quiz is empty
  useEffect(() => {
    if (!quizStarted && !quizCompleted && !isEmptyQuiz && !noAttemptsLeft && quizType === 'NO_DEADLINE' && quizQuestions.length === 0 && !isPending && !quizAttemptedRef.current && !dontStart && !pendingStudentQuestionContext) {
      // Check if quiz has any question banks first to detect empty quizzes early
      if (!questionBankRefs || questionBankRefs.length === 0) {
        handleEmptyQuiz();
      } else {
        startQuiz();
      }
      setDontStart(true);
    }
  }, [quizType, quizStarted, quizCompleted, isEmptyQuiz, noAttemptsLeft, quizQuestions.length, isPending, dontStart, startQuiz, questionBankRefs, pendingStudentQuestionContext]);


  useEffect(() => {
    if (quizCompleted) {
      setDontStart(false);
    }
  }, [quizCompleted, dontStart]);

  // Handle quiz completion for all quiz types
  useEffect(() => {
    if (quizCompleted && !isEmptyQuiz) {
      console.log('Quiz completed, processing results...', {
        gradingStatus: submissionResults?.gradingStatus,
        quizType,
        noAttemptsLeft,
        passThreshold
      });

      // For no attempts left, always proceed to next (since we marked it as passed)
      if (noAttemptsLeft) {
        setQuizPassed?.(1);
        setTimeout(() => {
          setQuizCompleted(false);
          onNext?.();
        }, 1000);
        return;
      }

      // For regular completion, check grading status to determine pass/fail
      if (submissionResults?.gradingStatus === "PASSED") {
        setQuizPassed?.(1);
        setFailedRedirectCountdown(null); // Clear any countdown
      } else if (submissionResults?.gradingStatus === "FAILED") {
        setQuizPassed?.(0);
        setFailedRedirectCountdown(10);
      } else {
        // Handle edge case where grading status is not available
        // Default to failed if we can't determine the status
        setQuizPassed?.(0);
        setFailedRedirectCountdown(10);
      }
    }
  }, [quizCompleted, quizType, submissionResults?.gradingStatus, setQuizPassed, onNext, onPrevVideo, noAttemptsLeft, isEmptyQuiz, passThreshold]);

  useEffect(() => {
    if (failedRedirectCountdown === null) return;

    if (failedRedirectCountdown <= 0) {
      setQuizCompleted(false);
      setFailedRedirectCountdown(null);
      onPrevVideo?.();
      return;
    }

    const timer = setTimeout(() => {
      setFailedRedirectCountdown(prev => prev !== null ? prev - 1 : null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [failedRedirectCountdown, onPrevVideo]);



  // Cleanup effect
  useEffect(() => {
    return () => {
      // Remove this cleanup call so stop is only called after submission
      // if (itemStartedRef.current) {
      //   handleStopItem();
      // }
    };
  }, [handleStopItem]);

  // Early detection for empty quizzes (all types)
  // useEffect(() => {
  //   if (!quizStarted && !quizAttemptedRef.current && !isEmptyQuiz && !noAttemptsLeft && !isPending) {
  //     if (!questionBankRefs || questionBankRefs.length === 0) {
  //       quizAttemptedRef.current = true; // Prevent other start attempts
  //       handleEmptyQuiz();
  //     }
  //   }
  // }, [questionBankRefs, quizStarted, isEmptyQuiz, noAttemptsLeft, isPending, handleEmptyQuiz]);

  // ===== IMPERATIVE HANDLE =====
  useImperativeHandle(ref, () => ({
    stopItem: async () => {
      if (!currentCourse?.itemId || !currentCourse.watchItemId || !itemStartedRef.current) return;
      if( isAlreadyWatched || completedItemIdsRef.current.has(currentCourse.itemId) ){
        return;
      }
      try {
        await stopItem.mutateAsync({
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
            isSkipped: false,
            nextItemId,
            cohortId: currentCourse.cohortId ?? '',
          }
        });
        itemStartedRef.current = false;
        completedItemIdsRef.current.add(currentCourse.itemId);
      } catch (error: any) {
        console.error('❌ Quiz stopItem error:', error);
        throw error; // Re-throw for parent to catch
      }
    },
    cleanup: () => {
      resetQuiz();
    },
    getCurrentDetails: () => {
      return {
        questionId: currentQuestion?.id
      };
    }
  }), [stopItem, currentCourse, attemptId, resetQuiz, currentQuestion]);

  // ===== RENDER LOGIC =====


  // Quiz not started

  if (!quizStarted) {
    if (pendingStudentQuestionContext) {
      return (
        <div className="mx-auto space-y-8">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/40">
            <CardHeader className="pb-4">
              <div className="space-y-3">
                <CardTitle className="text-2xl font-bold">
                  Before the Quiz, Submit an MCQ for This Video
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  You just completed the video segment. Please submit one MCQ for this segment before proceeding to the quiz.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => setShowQuestionModal(true)}
                  disabled={isSubmittingQuestion}
                >
                  Submit MCQ Question
                </Button>
                <Button
                  variant="outline"
                  onClick={handleContinueToQuiz}
                  disabled={isSubmittingQuestion}
                >
                  Skip and Continue to Quiz
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The MCQ supports flexible option count and optional images in question content and options.
              </p>
            </CardContent>
          </Card>

          <Dialog
            open={showQuestionModal}
            onOpenChange={(open) => {
              if (!isSubmittingQuestion) {
                setShowQuestionModal(open);
              }
            }}
          >
            <DialogContent
              className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto"
              onInteractOutside={e => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Submit an MCQ Question</DialogTitle>
              </DialogHeader>
              <StudentQuestionComposer
                isOpen={showQuestionModal}
                isSubmitting={isSubmittingQuestion}
                onCancel={() => setShowQuestionModal(false)}
                onSubmit={handleQuestionSubmit}
              />
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    if (quizType === 'DEADLINE') {
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

          <Dialog
            open={showQuestionModal}
            onOpenChange={(open) => {
              if (!isSubmittingQuestion) {
                setShowQuestionModal(open);
              }
            }}
          >
            <DialogContent
              className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto"
              onInteractOutside={e => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Submit an MCQ Question</DialogTitle>
              </DialogHeader>
              <StudentQuestionComposer
                isOpen={showQuestionModal}
                isSubmitting={isSubmittingQuestion}
                onCancel={() => setShowQuestionModal(false)}
                onSubmit={handleQuestionSubmit}
              />
            </DialogContent>
          </Dialog>
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
    // Special handling for empty quiz
    if (isEmptyQuiz) {
      return (
        <Card className="mx-auto">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto">
              <FileQuestion className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground">
              No questions available in this quiz.
            </h3>
            {/* Live countdown timer for empty quizzes */}
            {emptyQuizRedirectCountdown !== null && (
              <p className="mt-2 text-md text-primary font-medium animate-pulse">
                Moving to next item in {emptyQuizRedirectCountdown} second{emptyQuizRedirectCountdown !== 1 ? 's' : ''}...
              </p>
            )}
            {/* Action Buttons - side by side */}
            <div className="pt-4 flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-3">
                {/* Rewatch Video Button - always available */}
                {onPrevVideo && (
                  <Button
                    onClick={() => {
                      // setQuizCompleted(false);
                      clearTimeout(emptyQuizNextTimerRef.current);
                      setEmptyQuizRedirectCountdown(null);
                      onPrevVideo();
                    }}
                    disabled={isProgressUpdating}
                    variant="outline"
                    className="min-w-[180px] h-12 text-lg font-semibold border-2 hover:bg-accent transition-all duration-200"
                    size="lg"
                  >
                    {isNavigatingToPrev ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                        Processing
                      </>
                    ) : (
                      <>
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Rewatch Video
                      </>
                    )}
                  </Button>
                )}
                {/* Next Lesson Button-If user doesn't want to wait*/}
                {onNext && (submissionResults?.gradingStatus !== "FAILED") && (
                  <Button
                    onClick={async ()=>{
                        await handleSkipItem();
                        if(onNext){
                        onNext();
                        }
                      }
                    }
                    disabled={isProgressUpdating}
                    className="min-w-[180px] h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
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
            </div>
          </CardContent>
        </Card>
      );
    }

    // Special handling for no attempts left
    if (noAttemptsLeft) {
      return (
        <Card className="mx-auto">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold text-foreground">Quiz Completed</h3>
              <p className="text-muted-foreground text-lg">
                No attempts remaining for this quiz. Moving to next item...
              </p>
            </div>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            </div>
          </CardContent>
        </Card>
      );
    }

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
                    submissionResults.gradingStatus === 'PASSED' ? 'success' :
                      submissionResults.gradingStatus === 'FAILED' ? 'destructive' :
                        'secondary'
                  }
                  className="text-lg px-4 py-2 mx-2"
                >
                  {submissionResults.gradingStatus === 'PASSED' && '🎉 Passed!'}
                  {submissionResults.gradingStatus === 'FAILED' && 'Attempt Unsuccessful'}
                  {submissionResults.gradingStatus === 'PENDING' && '⏳ Pending Review'}
                </Badge>
              )}
              {(submissionResults?.totalScore === submissionResults?.totalMaxScore) && (
                <Badge variant="success" className="text-lg px-4 py-2 from-primary to-chart-2 mx-2">
                  Perfect Score! 🎉
                </Badge>
              )}

              {/* Action Buttons - side by side */}
              <div className="pt-4 flex flex-col items-center gap-3">
                <div className="flex flex-wrap justify-center gap-3">
                  {/* Rewatch Video Button - always available */}
                  {onPrevVideo && (
                    <Button
                      onClick={() => {
                        setQuizCompleted(false);
                        setFailedRedirectCountdown(null);
                        onPrevVideo();
                      }}
                      disabled={isProgressUpdating}
                      variant="outline"
                      className="min-w-[180px] h-12 text-lg font-semibold border-2 hover:bg-accent transition-all duration-200"
                      size="lg"
                    >
                      {isNavigatingToPrev ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                          Processing
                        </>
                      ) : (
                        <>
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Rewatch Video
                        </>
                      )}
                    </Button>
                  )}

                  {/* Next Lesson Button - only for passed quizzes */}
                  {onNext && (submissionResults?.gradingStatus !== "FAILED") && (
                    <Button
                      onClick={onNext}
                      disabled={isProgressUpdating}
                      className="min-w-[180px] h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
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

                {/* Live countdown timer for failed quizzes */}
                {failedRedirectCountdown !== null && (
                  <p className="text-sm text-destructive font-medium animate-pulse">
                    Auto-redirecting in {failedRedirectCountdown} second{failedRedirectCountdown !== 1 ? 's' : ''}...
                  </p>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Question Details with scrollable container */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Question Details</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {quizQuestions.map((question, index) => {
                const userAnswer = answers[question.id];
                const hasAnswer = userAnswer !== undefined && userAnswer !== null && userAnswer !== '';
                const questionFeedback = submissionResults?.overallFeedback?.find(
                  feedback => {
                    const fbId = typeof feedback.questionId === 'object' && feedback.questionId !== null && 'buffer' in feedback.questionId
                      ? bufferToHex(feedback.questionId as any)
                      : String(feedback.questionId);
                    return fbId === question.id;
                  }
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
                          ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/20'
                          : 'border-gray-200'
                    }
                  >
                    <CardContent className="px-4 py-2">
                      <div
                        className="flex items-center justify-between cursor-pointer select-none"
                        onClick={() =>
                          setOpenQuestionId(openQuestionId === question.id ? null : question.id)
                        }
                      >
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
                        </div>
                        <div className='flex justify-center items-center'>
                          <Badge variant={
                            questionFeedback
                              ? questionFeedback.status === 'CORRECT' ? 'default' : 'destructive'
                              : hasAnswer ? 'secondary' : 'destructive'
                          }>
                            {showScoreAfterSubmission && questionFeedback
                              ? `${questionFeedback.score}/${question.points} Points`
                              : hasAnswer ? `+${question.points}` : '0'
                            }
                          </Badge>
                          <ChevronDown className={`w-5 h-5 ml-5 transition-transform ${openQuestionId === question.id ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {openQuestionId === question.id && (<>
                        <p className="text-sm text-muted-foreground my-3 ml-2">
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
                      </>)}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty quiz detected
  if (isEmptyQuiz && quizStarted) {
    return (
      <Card className="mx-auto">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold text-foreground">No Questions Found</h3>
            <p className="text-muted-foreground text-lg">
              This quiz doesn't contain any questions at the moment.
            </p>
          </div>
          {onNext && (
            <div className="pt-4">
              <Button
                onClick={() => {
                  handleSkipItem();
                  onNext();
                }}
                disabled={isProgressUpdating}
                className="min-w-[180px] h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
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
            </div>
          )}
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
      {isStopping && (
        <div
          className="absolute inset-0 z-40 cursor-not-allowed"
          style={{ pointerEvents: 'all' }}
        />
      )}
      <NavigatingOverlay
        visible={isStopping}
        title="Verifying answers"
        message="Please wait while we submit and validate your responses…"
      />
      <CardHeader>
        <div className="flex justify-between items-center">
          <Badge variant="outline">
            Question {currentQuestionIndex + 1} of {quizQuestions.length}
          </Badge>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {maxAttempts === -1 ? `Attempt ${attempts || 0 + 1}` :
                `Attempt ${attempts || 0 + 1} of ${maxAttempts}`}
            </Badge>
            {timeLeft > 0 && (
              <Badge
                variant="secondary"
                className={`font-mono text-lg font-semibold px-3 py-2 border
                  ${timeLeft <= 10
                    ? 'bg-destructive text-destructive-foreground border-destructive ring-2 ring-destructive/60 animate-pulse'
                    : 'bg-muted text-foreground border-border'
                  }
                `}
              >
                <Clock className="mr-2 h-4 w-4" />
                {formatTime(timeLeft)}
              </Badge>
            )}
          </div>
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
            {/* <MathRenderer>
              {preprocessMathContent(currentQuestion.question.replace(/\\n/g, '\n'))}
            </MathRenderer> */}
            <div className="whitespace-pre-wrap">
              <MathRenderer>
                {preprocessMathContent(currentQuestion.question.replace(/\\n/g, '\n'))}
              </MathRenderer>
            </div>
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
          {/* 
          {explanationBox.open && (
            <div className={`mb-4 p-3 rounded-lg animate-in fade-in ${explanationBox.result === 'CORRECT'
              ? 'bg-green-100 dark:bg-green-950/20 text-green-900 dark:text-green-100 border border-green-300 dark:border-green-800'
              : 'bg-red-100 dark:bg-red-950/20 text-red-900 dark:text-red-100 border border-red-300 dark:border-red-800'
              }`}>
              <p className="text-sm leading-relaxed">{explanationBox.text}</p>

              {/* OPTIONAL Next Button */}
          {/* <button
      className="mt-2 px-3 py-1 rounded bg-green-600 text-white text-sm"
      onClick={() => {
        explanationBox.resolve?.();
        setExplanationBox({ open: false, text: "" });
      }}
    >
      Next →
    </button> */}
          {/* </div>
          )} */}
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
              <Textarea
                id={`descriptive-answer-${currentQuestion.id}`}
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
                value={(answers[currentQuestion.id] as number) || 0}
                onChange={(e) => handleAnswer(parseFloat(e.target.value) || 0)}
                placeholder="Enter a number"
                className="text-lg"
              />
              {currentQuestion.decimalPrecision !== undefined &&
                currentQuestion.decimalPrecision > 0 && (
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
          {(attempts >= 5 && allowSkip == true) && (
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
              disabled={!isAnswerValid(currentQuestion, answers[currentQuestion.id]) || isSubmitting || finshingQuiz}
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
        {/* {saveError && !submitError && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              <strong>Save Error:</strong> {saveError}
            </p>
          </div>
        )} */}

        {/* Show submission error if any */}
        {/* {submitError && currentQuestionIndex === quizQuestions.length - 1 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Submission Error:</strong> {submitError}
            </p>
          </div>
        )} */}

        {((submitError && currentQuestionIndex === quizQuestions.length - 1) || saveError) && (
          <div className="mt-4 p-3 rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">
              {saveError ? (
                <>
                  <strong>Save Error:</strong> {saveError}
                </>
              ) : submitError ? (
                submitError
              ) : (
                'An error occurred.'
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>


  );
});

Quiz.displayName = "Quiz";

export default Quiz;
