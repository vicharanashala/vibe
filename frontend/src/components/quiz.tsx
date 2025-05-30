import { useState, useEffect, useCallback } from 'react';

// Enhanced question types
interface QuizQuestion {
  id: string;
  type: 'mcq' | 'multi_select' | 'numerical' | 'matching' | 'short_answer' | 'ranking';
  question: string;
  options?: string[]; // For MCQ, multi-select, ranking questions
  pairs?: { left: string; right: string }[]; // For matching questions
  correctAnswer: string | number | number[] | { [key: string]: string } | string[]; // Different types for different question types
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
  const [answers, setAnswers] = useState<Record<string, string | number | number[] | { [key: string]: string } | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [currentConnecting, setCurrentConnecting] = useState<string | null>(null);

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

    // Matching Question
    questions.push({
      id: '5',
      type: 'matching',
      question: 'Match the following concepts with their descriptions:',
      pairs: [
        { left: 'Quiz', right: 'Interactive assessment tool' },
        { left: 'Content', right: 'Educational material' },
        { left: 'Learning', right: 'Knowledge acquisition process' },
        { left: 'Assessment', right: 'Evaluation method' },
        { left: 'Feedback', right: 'Response to performance' }
      ],
      // Add extra options to make it more challenging
      options: [
        'Interactive assessment tool',
        'Educational material', 
        'Knowledge acquisition process',
        'Evaluation method',
        'Response to performance',
        'Teaching methodology',
        'Student engagement tool'
      ],
      correctAnswer: {
        'Quiz': 'Interactive assessment tool',
        'Content': 'Educational material',
        'Learning': 'Knowledge acquisition process',
        'Assessment': 'Evaluation method',
        'Feedback': 'Response to performance'
      },
      points: 12,
      timeLimit: 60
    });

    // Ranking Question
    questions.push({
      id: '6',
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

  const handleAnswer = (answer: string | number | number[] | { [key: string]: string } | string[]) => {
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

  const isCorrectAnswer = (question: QuizQuestion, userAnswer: string | number | number[] | { [key: string]: string } | string[]): boolean => {
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
      
      case 'matching': {
        if (typeof userAnswer !== 'object' || typeof question.correctAnswer !== 'object') return false;
        const userMatching = userAnswer as { [key: string]: string };
        const correctMatching = question.correctAnswer as { [key: string]: string };
        return Object.keys(correctMatching).every(key => userMatching[key] === correctMatching[key]);
      }
      
      case 'ranking': {
        if (!Array.isArray(userAnswer) || !Array.isArray(question.correctAnswer)) return false;
        return JSON.stringify(userAnswer) === JSON.stringify(question.correctAnswer);
      }
      
      default:
        return false;
    }
  };

  const isAnswerValid = (question: QuizQuestion, answer: string | number | number[] | { [key: string]: string } | string[]): boolean => {
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
      case 'matching': {
        if (typeof answer !== 'object' || !question.pairs) return false;
        const matchAnswer = answer as { [key: string]: string };
        return question.pairs.every(pair => matchAnswer[pair.left] && matchAnswer[pair.left].trim().length > 0);
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
      case 'matching': return 'Matching';
      case 'ranking': return 'Ranking';
      default: return 'Question';
    }
  };

  const getQuestionTypeColor = (type: string): string => {
    switch (type) {
      case 'mcq': return 'bg-blue-100 text-blue-800';
      case 'multi_select': return 'bg-green-100 text-green-800';
      case 'short_answer': return 'bg-yellow-100 text-yellow-800';
      case 'numerical': return 'bg-purple-100 text-purple-800';
      case 'matching': return 'bg-red-100 text-red-800';
      case 'ranking': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle line drawing for matching questions
  const handleMatchingItemClick = useCallback((item: string, isLeftSide: boolean) => {
    if (currentQuestion.type !== 'matching') return;
    
    if (currentConnecting === null) {
      // Start new connection
      setCurrentConnecting(`${isLeftSide ? 'left:' : 'right:'}${item}`);
    } else {
      const [side, selectedItem] = currentConnecting.split(':');
      
      // Only allow connecting from left to right or right to left
      if ((side === 'left' && !isLeftSide) || (side === 'right' && isLeftSide)) {
        // Complete connection
        const currentMatches = (answers[currentQuestion.id] as { [key: string]: string }) || {};
        const newMatches = { ...currentMatches };
        
        if (side === 'left') {
          newMatches[selectedItem] = item;
        } else {
          newMatches[item] = selectedItem;
        }
        
        handleAnswer(newMatches);
        setCurrentConnecting(null);
      } else {
        // Switch to new item on same side
        setCurrentConnecting(`${isLeftSide ? 'left:' : 'right:'}${item}`);
      }
    }
  }, [currentConnecting, currentQuestion, answers, handleAnswer]);

  // Reset connection when changing questions
  useEffect(() => {
    setCurrentConnecting(null);
  }, [currentQuestionIndex]);
  
  // Function to check if an item is connected
  const isItemConnected = useCallback((item: string, isLeftSide: boolean) => {
    if (currentQuestion.type !== 'matching' || !answers[currentQuestion.id]) return false;
    
    const matches = answers[currentQuestion.id] as { [key: string]: string };
    
    if (isLeftSide) {
      return item in matches;
    } else {
      return Object.values(matches).includes(item);
    }
  }, [currentQuestion, answers]);

  // Function to get connected pair
  const getConnectedPair = useCallback((item: string, isLeftSide: boolean) => {
    if (currentQuestion.type !== 'matching' || !answers[currentQuestion.id]) return null;
    
    const matches = answers[currentQuestion.id] as { [key: string]: string };
    
    if (isLeftSide) {
      return matches[item] || null;
    } else {
      const key = Object.keys(matches).find(k => matches[k] === item);
      return key || null;
    }
  }, [currentQuestion, answers]);

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
      <div className="quiz-container mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="quiz-title text-2xl font-bold mb-4">Enhanced Quiz</h1>
        <div className="quiz-content">
          <p className="mb-6 text-gray-700">{content}</p>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Quiz Overview:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {quizQuestions.map((q, index) => (
                <div key={q.id} className={`text-xs px-2 py-1 rounded-full text-center ${getQuestionTypeColor(q.type)}`}>
                  Q{index + 1}: {getQuestionTypeLabel(q.type)}
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>📊 Questions: {quizQuestions.length}</p>
              <p>🎯 Total Points: {getTotalPoints()}</p>
              <p>⏱️ Estimated Time: {Math.ceil(quizQuestions.reduce((total, q) => total + (q.timeLimit || 30), 0) / 60)} minutes</p>
            </div>
          </div>
          
          <button 
            onClick={startQuiz}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
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
      <div className="quiz-container mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="quiz-title text-2xl font-bold mb-4">Quiz Completed!</h1>
        <div className="quiz-results">
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-green-600 mb-4">
              {score}/{getTotalPoints()}
            </div>
            <p className="text-lg mb-4">
              You scored {Math.round((score / getTotalPoints()) * 100)}%
            </p>
            {score === getTotalPoints() && (
              <p className="text-green-600 font-medium">Perfect Score! 🎉</p>
            )}
          </div>
          
          {/* Detailed Results */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Question Details:</h3>
            <div className="space-y-3">
              {quizQuestions.map((question, index) => {
                const userAnswer = answers[question.id];
                const correct = isCorrectAnswer(question, userAnswer);
                return (
                  <div key={question.id} className={`p-3 rounded-md border ${correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Q{index + 1}. {getQuestionTypeLabel(question.type)}
                      </span>
                      <span className={`text-sm ${correct ? 'text-green-600' : 'text-red-600'}`}>
                        {correct ? `+${question.points}` : '0'} / {question.points} points
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{question.question}</p>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="text-center">
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
      </div>
    );
  }

  // Quiz in progress
  return (
    <div className="quiz-container mx-auto p-6 bg-white rounded-lg shadow-md">
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
        <div className="flex items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getQuestionTypeColor(currentQuestion.type)}`}>
            {getQuestionTypeLabel(currentQuestion.type)}
          </span>
          <span className="text-sm text-gray-600">
            {currentQuestion.points} points
          </span>
        </div>
        <h2 className="text-xl font-semibold mb-4">
          {currentQuestion.question}
        </h2>

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

        {/* Multi-Select Options */}
        {currentQuestion.type === 'multi_select' && currentQuestion.options && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-3">Select all that apply:</p>
            {currentQuestion.options.map((option, index) => (
              <label 
                key={index}
                className="flex items-center space-x-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  value={index}
                  checked={Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as number[]).includes(index)}
                  onChange={(e) => {
                    const currentAnswers = Array.isArray(answers[currentQuestion.id]) ? [...(answers[currentQuestion.id] as number[])] : [];
                    if (e.target.checked) {
                      handleAnswer([...currentAnswers, index]);
                    } else {
                      handleAnswer(currentAnswers.filter(i => i !== index));
                    }
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )}

        {/* Short Answer Input */}
        {currentQuestion.type === 'short_answer' && (
          <input
            type="text"
            value={(answers[currentQuestion.id] as string) || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder="Type your answer here"
            className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {/* Numerical Input */}
        {currentQuestion.type === 'numerical' && (
          <div>
            <input
              type="number"
              value={(answers[currentQuestion.id] as number) || ''}
              onChange={(e) => handleAnswer(parseFloat(e.target.value) || 0)}
              placeholder="Enter a number"
              className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {currentQuestion.tolerance && (
              <p className="text-xs text-gray-500 mt-1">
                Tolerance: ±{currentQuestion.tolerance}
              </p>
            )}
          </div>
        )}

        {/* Matching Questions - Improved Interface */}
        {currentQuestion.type === 'matching' && currentQuestion.pairs && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-3">Click items to connect matching pairs:</p>
            
            <div className="relative flex justify-between">
              {/* Left Column */}
              <div className="w-5/12 space-y-4">
                {currentQuestion.pairs.map((pair, index) => (
                  <div 
                    key={`left-${index}`}
                    onClick={() => handleMatchingItemClick(pair.left, true)}
                    className={`p-3 border rounded-md cursor-pointer transition-all
                      ${currentConnecting === `left:${pair.left}` ? 'bg-blue-200 border-blue-500' : ''}
                      ${isItemConnected(pair.left, true) ? 'bg-green-100 border-green-500' : 'hover:bg-gray-50'}
                    `}
                  >
                    {pair.left}
                    <div className="w-3 h-3 rounded-full bg-blue-600 absolute -right-1.5 top-1/2 transform -translate-y-1/2"></div>
                  </div>
                ))}
              </div>
              
              {/* Connection Lines */}
              <div className="absolute w-full h-full pointer-events-none">
                {currentQuestion.pairs.map((pair, index) => {
                  const connectedRight = getConnectedPair(pair.left, true);
                  if (!connectedRight) return null;
                  
                  // Find indexes to calculate positions
                  const rightOptions = currentQuestion.options || 
                    currentQuestion.pairs?.map(p => p.right) || [];
                  const rightIndex = rightOptions.findIndex(item => item === connectedRight);
                  
                  return (
                    <svg 
                      key={`line-${index}`} 
                      className="absolute top-0 left-0 w-full h-full"
                    >
                      <line 
                        x1="45%" 
                        y1={`${(index * 50) + 25}px`}
                        x2="55%" 
                        y2={`${(rightIndex * 50) + 25}px`}
                        stroke="green" 
                        strokeWidth="2"
                      />
                    </svg>
                  );
                })}
              </div>
              
              {/* Right Column */}
              <div className="w-5/12 space-y-4">
                {(currentQuestion.options || currentQuestion.pairs?.map(p => p.right)).map((item, index) => (
                  <div 
                    key={`right-${index}`}
                    onClick={() => handleMatchingItemClick(item, false)}
                    className={`p-3 border rounded-md cursor-pointer transition-all
                      ${currentConnecting === `right:${item}` ? 'bg-blue-200 border-blue-500' : ''}
                      ${isItemConnected(item, false) ? 'bg-green-100 border-green-500' : 'hover:bg-gray-50'}
                    `}
                  >
                    {item}
                    <div className="w-3 h-3 rounded-full bg-blue-600 absolute -left-1.5 top-1/2 transform -translate-y-1/2"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset Connections Button */}
            {Object.keys((answers[currentQuestion.id] as { [key: string]: string }) || {}).length > 0 && (
              <button 
                onClick={() => {
                  handleAnswer({});
                  setCurrentConnecting(null);
                }}
                className="text-sm px-3 py-1 text-red-600 border border-red-300 rounded hover:bg-red-50"
              >
                Reset Connections
              </button>
            )}
          </div>
        )}

        {/* Ranking Questions - Improved Drag & Drop Interface */}
        {currentQuestion.type === 'ranking' && currentQuestion.options && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-3">Drag and drop items to rank them:</p>
            <div className="space-y-2">
              {((answers[currentQuestion.id] as string[]) || currentQuestion.options).map((item, index) => (
                <div 
                  key={item} 
                  className="flex items-center space-x-3 p-3 border rounded-md bg-white hover:bg-gray-50"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {/* Drag Handle (6 dots) */}
                  <div className="cursor-grab active:cursor-grabbing grid grid-rows-2 grid-cols-3 gap-1">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    ))}
                  </div>
                  
                  <span className="font-medium text-gray-700 min-w-[30px]">{index + 1}.</span>
                  <span className="flex-1">{item}</span>
                </div>
              ))}
            </div>
          </div>
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
          disabled={!isAnswerValid(currentQuestion, answers[currentQuestion.id])}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}