import { useState, useEffect } from 'react';

// Simple question types
interface QuizQuestion {
  id: string;
  type: 'mcq' | 'text';
  question: string;
  options?: string[]; // For MCQ questions
  correctAnswer: string | number; // For MCQ: index, for text: string
  points: number;
  timeLimit?: number; // in seconds
}

interface QuizProps {
  content: string;
}

export default function Quiz({ content }: QuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);

  // Generate questions based on content
  const generateQuestionsFromContent = (content: string): QuizQuestion[] => {
    // Simple question generation based on content keywords
    const questions: QuizQuestion[] = [];
    
    // Add some basic questions based on content
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

    questions.push({
      id: '2',
      type: 'text',
      question: 'What is the main topic of this content?',
      correctAnswer: 'education',
      points: 5,
      timeLimit: 20
    });

    questions.push({
      id: '3',
      type: 'mcq',
      question: 'How would you rate your understanding of this content?',
      options: ['Poor', 'Fair', 'Good', 'Excellent'],
      correctAnswer: 2,
      points: 5,
      timeLimit: 15
    });

    return questions;
  };

  const quizQuestions = generateQuestionsFromContent(content);
  const currentQuestion = quizQuestions[currentQuestionIndex];

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
  }, [quizStarted, quizCompleted, timeLeft, currentQuestionIndex]);

  // Set timer for current question
  useEffect(() => {
    if (quizStarted && currentQuestion?.timeLimit) {
      setTimeLeft(currentQuestion.timeLimit);
    }
  }, [currentQuestionIndex, quizStarted]);

  const startQuiz = () => {
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setAnswers({});
    if (currentQuestion?.timeLimit) {
      setTimeLeft(currentQuestion.timeLimit);
    }
  };

  const handleAnswer = (answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      completeQuiz();
    }
  };

  const completeQuiz = () => {
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
  };

  const isCorrectAnswer = (question: QuizQuestion, userAnswer: any): boolean => {
    if (question.type === 'mcq') {
      return userAnswer === question.correctAnswer;
    } else {
      return userAnswer?.toString().toLowerCase().trim() === 
             question.correctAnswer.toString().toLowerCase().trim();
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

  // Quiz not started
  if (!quizStarted) {
    return (
      <div className="quiz-container max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="quiz-title text-2xl font-bold mb-4">Quiz</h1>
        <div className="quiz-content">
          <p className="mb-4">{content}</p>
          <div className="mb-4">
            <p className="text-gray-600">
              Questions: {quizQuestions.length} | Total Points: {getTotalPoints()}
            </p>
          </div>
          <button 
            onClick={startQuiz}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  // Quiz completed
  if (quizCompleted) {
    return (
      <div className="quiz-container max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="quiz-title text-2xl font-bold mb-4">Quiz Completed!</h1>
        <div className="quiz-results text-center">
          <div className="text-4xl font-bold text-green-600 mb-4">
            {score}/{getTotalPoints()}
          </div>
          <p className="text-lg mb-4">
            You scored {Math.round((score / getTotalPoints()) * 100)}%
          </p>
          <button 
            onClick={() => {
              setQuizStarted(false);
              setQuizCompleted(false);
              setCurrentQuestionIndex(0);
              setAnswers({});
              setScore(0);
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  // Quiz in progress
  return (
    <div className="quiz-container max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-gray-600">
          Question {currentQuestionIndex + 1} of {quizQuestions.length}
        </div>
        {timeLeft > 0 && (
          <div className="text-lg font-mono bg-black text-white px-3 py-1 rounded">
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
        ></div>
      </div>

      {/* Question */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">
          {currentQuestion.question}
        </h2>
        <div className="text-sm text-gray-600 mb-4">
          {currentQuestion.points} points
        </div>

        {/* MCQ Options */}
        {currentQuestion.type === 'mcq' && currentQuestion.options && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <label 
                key={index}
                className="flex items-center space-x-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={index}
                  checked={answers[currentQuestion.id] === index}
                  onChange={() => handleAnswer(index)}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )}

        {/* Text Input */}
        {currentQuestion.type === 'text' && (
          <input
            type="text"
            value={answers[currentQuestion.id] || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder="Type your answer here"
            className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <button
          onClick={handleNextQuestion}
          disabled={!answers[currentQuestion.id] && answers[currentQuestion.id] !== 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}