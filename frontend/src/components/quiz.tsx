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
import { Clock, Trophy, ChevronLeft, ChevronRight, RotateCcw, GripVertical } from "lucide-react";

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
  content: string;
}

export default function Quiz({ content }: QuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number | number[] | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [, setCurrentConnecting] = useState<string | null>(null);

  // Generate questions based on content
  const generateQuestionsFromContent = (content: string): QuizQuestion[] => {
    // Enhanced question generation with various question types
    const questions: QuizQuestion[] = [];
    
    // Multiple Choice Question
    questions.push({
      id: '1',
      type: 'mcq',
      question: `Based on the content about "${content.substring(0, 30)}...", which statement is most relevant?`,
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
      correctAnswer: content.length,
      tolerance: content.length * 0.1, // 10% tolerance
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

  const quizQuestions = generateQuestionsFromContent(content);
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
    if (!quizStarted || quizCompleted || timeLeft <= 0) return;

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
  }, [quizStarted, quizCompleted, timeLeft, currentQuestionIndex, handleNextQuestion]);

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
      <Card className="mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Enhanced Quiz</CardTitle>
          <CardDescription className="text-lg">
            Test your knowledge with this interactive quiz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-muted-foreground">{content}</p>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-4">Quiz Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📊</span>
                <span>Questions: {quizQuestions.length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5" />
                <span>Total Points: {getTotalPoints()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Est. Time: {Math.ceil(quizQuestions.reduce((total, q) => total + (q.timeLimit || 30), 0) / 60)} min</span>
              </div>
            </div>
          </div>
          
          <Button onClick={startQuiz} className="w-full" size="lg">
            Start Quiz
          </Button>
        </CardContent>
      </Card>
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