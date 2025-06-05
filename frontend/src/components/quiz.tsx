import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Clock, Trophy, ChevronLeft, ChevronRight, RotateCcw, GripVertical, PlayCircle, BookOpen, Target, Timer, Users, AlertCircle } from "lucide-react";
import { useAttemptQuiz } from '@/lib/api/hooks';

// Enhanced question types
interface QuizQuestion {
  id: string;
  type: 'mcq' | 'multi_select' | 'numerical' | 'short_answer' | 'ranking';
  question: string;
  options?: string[]; // For MCQ, multi-select, ranking questions
  correctAnswer: string | number | number[] | string[]; // Different types for different question types
  points: number;
  timeLimit?: number; // in seconds
  tolerance?: number; // For numerical questions
  minAnswer?: number; // For numerical questions
  maxAnswer?: number; // For numerical questions
}

interface QuizProps {
  questionBankRefs: string[]; // question ids
  passThreshold: number; // 0-1
  maxAttempts: number; // Maximum number of attempts allowed
  quizType: 'DEADLINE' | 'NO_DEADLINE' | ''; // Type of quiz
  releaseTime: Date | undefined; // Release time for the quiz
  questionVisibility: number; // Number of questions visible to the user at a time
  deadline?: Date; // Deadline for the quiz, only applicable for DEADLINE type
  approximateTimeToComplete: string; // Approximate time to complete in HH:MM:SS format
  allowPartialGrading: boolean; // If true, allows partial grading for questions
  allowHint: boolean; // If true, allows users to use hints for questions
  showCorrectAnswersAfterSubmission: boolean; // If true, shows correct answers after submission
  showExplanationAfterSubmission: boolean; // If true, shows explanation after submission
  showScoreAfterSubmission: boolean;
  quizId: string;
  doGesture?: boolean; // Optional prop to trigger gesture detection
}

export default function Quiz({
  questionBankRefs,
  passThreshold,
  maxAttempts,
  quizType,
  releaseTime,
  questionVisibility,
  deadline,
  approximateTimeToComplete,
  allowPartialGrading,
  allowHint,
  showCorrectAnswersAfterSubmission,
  showExplanationAfterSubmission,
  showScoreAfterSubmission,
  quizId,
  doGesture = false, // Optional prop to trigger gesture detection
}: QuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number | number[] | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [, setCurrentConnecting] = useState<string | null>(null);
  
  // Generate questions based on content
  const generateQuestionsFromContent = (): QuizQuestion[] => {
    // Enhanced question generation with various question types
    const questions: QuizQuestion[] = [];

    // Multiple Choice Question
    questions.push({
      id: '1',
      type: 'mcq',
      question: `Based on the content about , which statement is most relevant?`,
      options: [
        'This content is educational',
        'This content is irrelevant',
        'This content needs more detail',
        'This content is perfect as is'
      ],
      correctAnswer: 0,
      points: 10,
      timeLimit: 30
    });

    // Multiple Select Question
    questions.push({
      id: '2',
      type: 'multi_select',
      question: 'Which of the following best describe this content? (Select all that apply)',
      options: ['Educational', 'Informative', 'Complex', 'Well-structured', 'Outdated'],
      correctAnswer: [0, 1, 3], // Educational, Informative, Well-structured
      points: 15,
      timeLimit: 45
    });

    // Short Answer Question
    questions.push({
      id: '3',
      type: 'short_answer',
      question: 'What is the main topic of this content?',
      correctAnswer: 'education',
      points: 5,
      timeLimit: 20
    });

    // Numerical Question
    questions.push({
      id: '4',
      type: 'numerical',
      question: 'How many characters are approximately in this content?',
      correctAnswer: 1,
      tolerance: 1 * 0.1, // 10% tolerance
      points: 8,
      timeLimit: 15
    });

    // Ranking Question
    questions.push({
      id: '5',
      type: 'ranking',
      question: 'Rank the following learning methods from most effective to least effective:',
      options: ['Active Practice', 'Passive Reading', 'Interactive Quizzes', 'Group Discussion'],
      correctAnswer: ['Active Practice', 'Interactive Quizzes', 'Group Discussion', 'Passive Reading'],
      points: 10,
      timeLimit: 40
    });

    return questions;
  };

  const quizQuestions = generateQuestionsFromContent();
  const currentQuestion = quizQuestions[currentQuestionIndex];

  const completeQuiz = useCallback(() => {
    // Calculate score
    let totalScore = 0;
    quizQuestions.forEach(question => {
      const userAnswer = answers[question.id];
      if (isCorrectAnswer(question, userAnswer)) {
        totalScore += question.points;
      }
    });

    setScore(totalScore);
    setQuizCompleted(true);
  }, [quizQuestions, answers]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      completeQuiz();
    }
  }, [currentQuestionIndex, quizQuestions.length, completeQuiz]);

  const startQuiz = () => {
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setAnswers({});
    if (currentQuestion?.timeLimit) {
      setTimeLeft(currentQuestion.timeLimit);
    }
  };

  const handleAnswer = (answer: string | number | number[] | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
  };

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

  const isCorrectAnswer = (question: QuizQuestion, userAnswer: string | number | number[] | string[]): boolean => {
    switch (question.type) {
      case 'mcq': {
        return userAnswer === question.correctAnswer;
      }

      case 'multi_select': {
        if (!Array.isArray(userAnswer) || !Array.isArray(question.correctAnswer)) return false;
        const userSet = new Set(userAnswer.map(String));
        const correctSet = new Set((question.correctAnswer as number[]).map(String));
        return userSet.size === correctSet.size && [...userSet].every(x => correctSet.has(x));
      }

      case 'short_answer': {
        return userAnswer?.toString().toLowerCase().trim() ===
          question.correctAnswer.toString().toLowerCase().trim();
      }

      case 'numerical': {
        const numAnswer = typeof userAnswer === 'number' ? userAnswer : parseFloat(userAnswer?.toString() || '');
        const correctNum = typeof question.correctAnswer === 'number' ? question.correctAnswer : parseFloat(question.correctAnswer.toString());
        const tolerance = question.tolerance || 0;
        return Math.abs(numAnswer - correctNum) <= tolerance;
      }

      case 'ranking': {
        if (!Array.isArray(userAnswer) || !Array.isArray(question.correctAnswer)) return false;
        return JSON.stringify(userAnswer) === JSON.stringify(question.correctAnswer);
      }

      default:
        return false;
    }
  };

  const isAnswerValid = (question: QuizQuestion, answer: string | number | number[] | string[]): boolean => {
    if (answer === undefined || answer === null) return false;

    switch (question.type) {
      case 'mcq': {
        return answer !== undefined && answer !== null;
      }
      case 'multi_select': {
        return Array.isArray(answer) && answer.length > 0;
      }
      case 'short_answer': {
        return typeof answer === 'string' && answer.trim().length > 0;
      }
      case 'numerical': {
        return typeof answer === 'number' && !isNaN(answer);
      }
      case 'ranking': {
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
      case 'mcq': return 'Multiple Choice';
      case 'multi_select': return 'Multiple Select';
      case 'short_answer': return 'Short Answer';
      case 'numerical': return 'Numerical';
      case 'ranking': return 'Ranking';
      default: return 'Question';
    }
  };
  // Reset connection when changing questions
  useEffect(() => {
    setCurrentConnecting(null);
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
                  disabled={releaseTime && new Date() < releaseTime}
                >
                  <PlayCircle className="mr-3 h-6 w-6" />
                  {releaseTime && new Date() < releaseTime ? 'Quiz Not Available Yet' : 'Start Quiz Now'}
                </Button>
                
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
                  <div className="text-2xl font-bold text-primary">{questionBankRefs.length}</div>
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
        <CardContent className="space-y-6">            <div className="text-center space-y-4">
          <div className="text-6xl font-bold text-primary drop-shadow-sm">
            {score}/{getTotalPoints()}
          </div>
          <p className="text-xl text-foreground">
            You scored {Math.round((score / getTotalPoints()) * 100)}%
          </p>
          {score === getTotalPoints() && (
            <Badge variant="default" className="text-lg px-4 py-2 bg-gradient-to-r from-primary to-chart-2 text-primary-foreground">
              Perfect Score! 🎉
            </Badge>
          )}
        </div>

          <Separator />

          <div>
            <h3 className="text-xl font-semibold mb-4">Question Details</h3>
            <div className="space-y-3">
              {quizQuestions.map((question, index) => {
                const userAnswer = answers[question.id];
                const correct = isCorrectAnswer(question, userAnswer);
                return (
                  <Card key={question.id} className={correct ? 'quiz-success-card' : 'quiz-error-card'}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">
                            Q{index + 1}: {getQuestionTypeLabel(question.type)}
                          </Badge>
                        </div>
                        <Badge variant={correct ? 'default' : 'destructive'}>
                          {correct ? `+${question.points}` : '0'} / {question.points} points
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{question.question}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="text-center">
            <Button
              onClick={() => {
                setQuizStarted(false);
                setQuizCompleted(false);
                setCurrentQuestionIndex(0);
                setAnswers({});
                setScore(0);
              }}
              variant="outline"
              size="lg"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake Quiz
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Quiz in progress
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
            <Badge variant={currentQuestion.type === 'mcq' ? 'default' :
              currentQuestion.type === 'multi_select' ? 'secondary' :
                currentQuestion.type === 'short_answer' ? 'outline' :
                  currentQuestion.type === 'numerical' ? 'destructive' :
                    'secondary'}>
              {getQuestionTypeLabel(currentQuestion.type)}
            </Badge>
            <Badge variant="outline">
              <Trophy className="mr-1 h-3 w-3" />
              {currentQuestion.points} points
            </Badge>
          </div>
          <h2 className="text-2xl font-semibold leading-tight">
            {currentQuestion.question}
          </h2>

          {/* MCQ Options */}
          {currentQuestion.type === 'mcq' && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id]?.toString()}
              onValueChange={(value) => handleAnswer(parseInt(value))}
              className="space-y-3"
            >
              {currentQuestion.options.map((option, index) => (
                <Label
                  key={index}
                  htmlFor={`option-${index}`}
                  className="quiz-option-hover flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer w-full"
                >
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <span className="flex-1">{option}</span>
                </Label>
              ))}
            </RadioGroup>
          )}

          {/* Multi-Select Options */}
          {currentQuestion.type === 'multi_select' && currentQuestion.options && (
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
                  <span className="flex-1">{option}</span>
                </Label>
              ))}
            </div>
          )}

          {/* Short Answer Input */}
          {currentQuestion.type === 'short_answer' && (
            <div className="space-y-2">
              <Label htmlFor="short-answer">Your Answer</Label>
              <Input
                id="short-answer"
                type="text"
                value={(answers[currentQuestion.id] as string) || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Type your answer here"
                className="text-lg"
              />
            </div>
          )}

          {/* Numerical Input */}
          {currentQuestion.type === 'numerical' && (
            <div className="space-y-2">
              <Label htmlFor="numerical-answer">Enter a number</Label>
              <Input
                id="numerical-answer"
                type="number"
                value={(answers[currentQuestion.id] as number) || ''}
                onChange={(e) => handleAnswer(parseFloat(e.target.value) || 0)}
                placeholder="Enter a number"
                className="text-lg"
              />
              {currentQuestion.tolerance && (
                <p className="text-xs text-muted-foreground">
                  Tolerance: ±{currentQuestion.tolerance}
                </p>
              )}
            </div>
          )}

          {/* Ranking Questions */}
          {currentQuestion.type === 'ranking' && currentQuestion.options && (
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
                    <span className="flex-1">{item}</span>
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

          <Button
            onClick={handleNextQuestion}
            disabled={!isAnswerValid(currentQuestion, answers[currentQuestion.id])}
          >
            {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish' : 'Next'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}