import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Play, HelpCircle, CheckCircle, ChevronRight,
  ChevronLeft, Home, BookOpen, Trophy, Clock, Code2, GripVertical, Sparkles,
} from 'lucide-react';
import { cn } from '@/utils/utils';
import CodingPlayground from '@/components/learn/CodingPlayground';
import { MIXED_QUIZ_DATA, type DemoQuestion } from './demoCourseData';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_VIOLATIONS = 3;

const DEMO_COURSE = {
  name: "Machine Learning",
  modules: [
    {
      id: 'm1',
      name: 'Module 1: Supervised Learning',
      sections: [
        {
          id: 'm1s1',
          name: 'Section 1: Regression',
          items: [
            { id: 'm1s1-v1', type: 'video', name: 'Regression Introduction', videoId: 'aircAruvnKk' },
            { id: 'm1s1-q1', type: 'quiz', name: 'Quiz: Regression Intro' },
            { id: 'm1s1-v2', type: 'video', name: 'Regression Examples', videoId: 'vH_v6Y9U2A8' },
            { id: 'm1s1-q2', type: 'quiz', name: 'Quiz: Regression Examples' },
          ]
        },
        {
          id: 'm1s2',
          name: 'Section 2: Classification',
          items: [
            { id: 'm1s2-v1', type: 'video', name: 'Classification Introduction', videoId: '_kX76i9J4Lg' },
            { id: 'm1s2-q1', type: 'quiz', name: 'Quiz: Classification Intro' },
            { id: 'm1s2-v2', type: 'video', name: 'Classification Applications', videoId: 'r5V8h4V4f4A' },
            { id: 'm1s2-q2', type: 'quiz', name: 'Quiz: Classification Apps' },
          ]
        }
      ]
    },
    {
      id: 'm2',
      name: 'Module 2: Unsupervised Learning',
      sections: [
        {
          id: 'm2s1',
          name: 'Section 1: Clustering',
          items: [
            { id: 'm2s1-v1', type: 'video', name: 'Clustering Introduction', videoId: 'i_LwzRVP7bg' },
            { id: 'm2s1-q1', type: 'quiz', name: 'Quiz: Clustering Intro' },
            { id: 'm2s1-v2', type: 'video', name: 'Clustering Examples', videoId: '8_p8Y76_2sA' },
            { id: 'm2s1-q2', type: 'quiz', name: 'Quiz: Clustering Examples' },
          ]
        },
        {
          id: 'm2s2',
          name: 'Section 2: Dimensionality Reduction',
          items: [
            { id: 'm2s2-v1', type: 'video', name: 'PCA Introduction', videoId: 'FgakZw6K1QQ' },
            { id: 'm2s2-q1', type: 'quiz', name: 'Quiz: PCA Intro' },
            { id: 'm2s2-v2', type: 'video', name: 'PCA Applications', videoId: 'kw9R0nDbaHE' },
            { id: 'm2s2-q2', type: 'quiz', name: 'Quiz: PCA Apps' },
          ]
        }
      ]
    }
  ],
};

// Flat list of all items for easy navigation
const ALL_ITEMS = DEMO_COURSE.modules.flatMap(m => m.sections.flatMap(s => s.items));

// Specific quiz questions for each quiz item (legacy MCQ-only, kept for reference)
const QUIZ_DATA: Record<string, { id: string; question: string; options: string[]; correct: number; points: number; }[]> = {
  'm1s1-q1': [ // Quiz: Regression Intro
    {
      id: 'm1s1-q1-q1',
      question: 'What is the primary goal of regression analysis?',
      options: ['To group similar data points', 'To predict a continuous output variable', 'To classify data into categories', 'To reduce the dimensionality of data'],
      correct: 1,
      points: 10,
    },
    {
      id: 'm1s1-q1-q2',
      question: 'Which of the following is an example of a regression problem?',
      options: ['Predicting if an email is spam or not', 'Predicting the price of a house based on its features', 'Identifying different species of flowers', 'Grouping customers by their purchasing behavior'],
      correct: 1,
      points: 10,
    },
    {
      id: 'm1s1-q1-q3',
      question: 'In simple linear regression, what does the "slope" represent?',
      options: ['The value of the dependent variable when the independent variable is zero', 'The change in the dependent variable for a one-unit change in the independent variable', 'The amount of error in the prediction', 'The average value of the independent variable'],
      correct: 1,
      points: 10,
    },
  ],
  'm1s1-q2': [ // Quiz: Regression Examples
    {
      id: 'm1s1-q2-q1',
      question: 'Which regression model is suitable for predicting a person\'s age?',
      options: ['Logistic Regression', 'Linear Regression', 'Decision Tree Classifier', 'K-Means Clustering'],
      correct: 1,
      points: 10,
    },
    {
      id: 'm1s1-q2-q2',
      question: 'What is a common application of polynomial regression?',
      options: ['Predicting binary outcomes', 'Modeling non-linear relationships between variables', 'Clustering data points', 'Reducing the number of features'],
      correct: 1,
      points: 10,
    },
    {
      id: 'm1s1-q2-q3',
      question: 'When would you use Ridge or Lasso regression?',
      options: ['When dealing with categorical data', 'To prevent overfitting in linear models', 'For unsupervised learning tasks', 'To predict discrete values'],
      correct: 1,
      points: 10,
    },
  ],
  'm1s2-q1': [ // Quiz: Classification Intro
    {
      id: 'm1s2-q1-q1',
      question: 'What is the main objective of classification?',
      options: ['To predict a continuous numerical value', 'To assign data points to predefined categories or classes', 'To discover hidden patterns in unlabeled data', 'To reduce the number of features in a dataset'],
      correct: 1,
      points: 10,
    },
    {
      id: 'm1s2-q1-q2',
      question: 'Which of these is a binary classification problem?',
      options: ['Predicting house prices', 'Identifying handwritten digits (0-9)', 'Determining if a customer will churn or not', 'Forecasting stock market trends'],
      correct: 2,
      points: 10,
    },
    {
      id: 'm1s2-q1-q3',
      question: 'What is a "class label" in classification?',
      options: ['A numerical feature of the data', 'The predicted category for a data point', 'A measure of model accuracy', 'The input data itself'],
      correct: 1,
      points: 10,
    },
  ],
  'm1s2-q2': [ // Quiz: Classification Applications
    {
      id: 'm1s2-q2-q1',
      question: 'Which algorithm is commonly used for spam detection?',
      options: ['K-Means', 'Linear Regression', 'Support Vector Machine (SVM)', 'Principal Component Analysis (PCA)'],
      correct: 2,
      points: 10,
    },
    {
      id: 'm1s2-q2-q2',
      question: 'In medical diagnosis, classification models can be used to:',
      options: ['Predict patient recovery time', 'Identify the optimal drug dosage', 'Diagnose diseases based on symptoms', 'Segment medical images'],
      correct: 2,
      points: 10,
    },
    {
      id: 'm1s2-q2-q3',
      question: 'What is a typical application of multi-class classification?',
      options: ['Predicting a single numerical value', 'Categorizing news articles into topics', 'Detecting anomalies in network traffic', 'Forecasting weather patterns'],
      correct: 1,
      points: 10,
    },
  ],
  'm2s1-q1': [ // Quiz: Clustering Intro
    {
      id: 'm2s1-q1-q1',
      question: 'What is the primary goal of clustering?',
      options: ['To predict a target variable', 'To group similar data points together without prior labels', 'To classify data into known categories', 'To reduce the number of features'],
      correct: 1,
      points: 10,
    },
    {
      id: 'm2s1-q1-q2',
      question: 'Clustering is a form of:',
      options: ['Supervised Learning', 'Reinforcement Learning', 'Unsupervised Learning', 'Semi-supervised Learning'],
      correct: 2,
      points: 10,
    },
    {
      id: 'm2s1-q1-q3',
      question: 'What does "unlabeled data" mean in the context of clustering?',
      options: ['Data that is missing values', 'Data that has not been assigned to any specific category or class', 'Data that is too large to process', 'Data that is irrelevant to the problem'],
      correct: 1,
      points: 10,
    },
  ],
  'm2s1-q2': [ // Quiz: Clustering Examples
    {
      id: 'm2s1-q2-q1',
      question: 'Which algorithm is commonly used for customer segmentation?',
      options: ['Linear Regression', 'K-Means', 'Support Vector Machine (SVM)', 'Naive Bayes'],
      correct: 1,
      points: 10,
    },
    {
      id: 'm2s1-q2-q2',
      question: 'In image processing, clustering can be used for:',
      options: ['Object detection', 'Image classification', 'Image compression by color quantization', 'Generating new images'],
      correct: 2,
      points: 10,
    },
    {
      id: 'm2s1-q2-q3',
      question: 'What is a "centroid" in K-Means clustering?',
      options: ['An outlier data point', 'The center of a cluster', 'A boundary between two clusters', 'A data point that belongs to multiple clusters'],
      correct: 1,
      points: 10,
    },
  ],
  'm2s2-q1': [ // Quiz: PCA Intro
    {
      id: 'm2s2-q1-q1',
      question: 'What does PCA stand for?',
      options: ['Principal Component Analysis', 'Primary Classification Algorithm', 'Pattern Correlation Algorithm', 'Predictive Component Association'],
      correct: 0,
      points: 10,
    },
    {
      id: 'm2s2-q1-q2',
      question: 'What is the main purpose of PCA?',
      options: ['To increase the number of features', 'To classify data into categories', 'To reduce the dimensionality of a dataset while retaining most of its variance', 'To predict a continuous target variable'],
      correct: 2,
      points: 10,
    },
    {
      id: 'm2s2-q1-q3',
      question: 'PCA is a technique used in:',
      options: ['Supervised Learning', 'Unsupervised Learning', 'Reinforcement Learning', 'Both Supervised and Unsupervised Learning'],
      correct: 1,
      points: 10,
    },
  ],
  'm2s2-q2': [ // Quiz: PCA Applications
    {
      id: 'm2s2-q2-q1',
      question: 'In face recognition, PCA can be used for:',
      options: ['Generating new faces', 'Detecting emotions', 'Feature extraction and dimensionality reduction', 'Image enhancement'],
      correct: 2,
      points: 10,
    },
    {
      id: 'm2s2-q2-q2',
      question: 'What is a benefit of using PCA before training a machine learning model?',
      options: ['It always improves model accuracy', 'It can speed up training and reduce overfitting', 'It makes the model more complex', 'It converts all features to categorical data'],
      correct: 1,
      points: 10,
    },
    {
      id: 'm2s2-q2-q3',
      question: 'What are "principal components" in PCA?',
      options: ['The original features of the dataset', 'New uncorrelated variables that capture the most variance in the data', 'The output predictions of a model', 'Randomly selected features'],
      correct: 1,
      points: 10,
    },
  ],
};

// Use mixed AI-generated questions
const GET_QUIZ_QUESTIONS = (quizId: string): DemoQuestion[] =>
  MIXED_QUIZ_DATA[quizId] ?? [];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TestFullscreen() {
  const router = useRouter();

  // Fullscreen / violation state
  const [started, setStarted] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const violationRef = useRef(0);

  // Course state
  const [selectedItemId, setSelectedItemId] = useState(ALL_ITEMS[0].id);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({ m1: true });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ m1s1: true });

  const selectedItem = ALL_ITEMS.find(i => i.id === selectedItemId) || ALL_ITEMS[0];

  // Coding playground state
  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  // Pause/Resume the embedded course video while the playground is active
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const pauseVideo = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*'
    );
  }, []);
  
  const openPlayground = useCallback(() => {
    pauseVideo();
    setPlaygroundOpen(true);
  }, [pauseVideo]);

  useEffect(() => {
    if (playgroundOpen) {
      pauseVideo();
    }
  }, [playgroundOpen, pauseVideo]);

  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // answers: MCQ → number, MULTI_SELECT → number[], DRAG_DROP → string[], DROPDOWN → Record<string,string>
  const [answers, setAnswers] = useState<Record<string, number | number[] | string[] | Record<string, string>>>({});
  const [dragOrder, setDragOrder] = useState<Record<string, string[]>>({});
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const currentQuestions = GET_QUIZ_QUESTIONS(selectedItemId);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const markCompleted = (id: string) => {
    setCompletedItems(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const moveToNextItem = useCallback(() => {
    const currentIndex = ALL_ITEMS.findIndex(i => i.id === selectedItemId);
    if (currentIndex < ALL_ITEMS.length - 1) {
      const nextItem = ALL_ITEMS[currentIndex + 1];
      
      // Ensure sidebar is expanded for the next item
      const parentModule = DEMO_COURSE.modules.find(m => 
        m.sections.some(s => s.items.some(i => i.id === nextItem.id))
      );
      const parentSection = parentModule?.sections.find(s => 
        s.items.some(i => i.id === nextItem.id)
      );

      if (parentModule) setExpandedModules(p => ({ ...p, [parentModule.id]: true }));
      if (parentSection) setExpandedSections(p => ({ ...p, [parentSection.id]: true }));

      setSelectedItemId(nextItem.id);
      
      // Auto-start quiz if it's a quiz item
      if (nextItem.type === 'quiz') {
        resetQuiz();
        setQuizStarted(true);
      } else {
        resetQuiz();
      }
    } else {
      // Course completed
      router.navigate({ to: '/student' });
    }
  }, [selectedItemId, router]);

  const resetQuiz = () => {
    setQuizStarted(false);
    setQuizCompleted(false);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setDragOrder({});
    setDraggingIdx(null);
    setScore(0);
    setPassed(false);
    setTimeLeft(30);
  };

  const isAnswerGiven = (q: DemoQuestion): boolean => {
    const a = answers[q.id];
    if (q.type === 'MCQ') return typeof a === 'number';
    if (q.type === 'MULTI_SELECT') return Array.isArray(a) && (a as number[]).length > 0;
    if (q.type === 'DRAG_DROP') return true; // always has an order (initial or dragged)
    if (q.type === 'DROPDOWN') {
      const keys = Object.keys(q.dropdownOptions ?? {});
      const ans = a as Record<string, string> | undefined;
      return keys.length > 0 && keys.every(k => !!ans?.[k]);
    }
    return false;
  };

  const scoreQuestion = (q: DemoQuestion): number => {
    const a = answers[q.id];
    if (q.type === 'MCQ') return a === q.correct ? q.points : 0;
    if (q.type === 'MULTI_SELECT') {
      const sel = (a as number[] | undefined) ?? [];
      const correct = q.correctMany ?? [];
      const allCorrect = correct.every(c => sel.includes(c)) && sel.every(c => correct.includes(c));
      return allCorrect ? q.points : 0;
    }
    if (q.type === 'DRAG_DROP') {
      const order = (dragOrder[q.id] ?? q.items ?? []) as string[];
      const correct = q.items ?? [];
      return order.every((item, i) => item === correct[i]) ? q.points : 0;
    }
    if (q.type === 'DROPDOWN') {
      const ans = (a as Record<string, string> | undefined) ?? {};
      const correct = q.correctDropdown ?? {};
      return Object.keys(correct).every(k => ans[k] === correct[k]) ? q.points : 0;
    }
    return 0;
  };

  const handleQuizFinish = useCallback(() => {
    const total = currentQuestions.reduce((sum, q) => sum + scoreQuestion(q), 0);
    const maxScore = currentQuestions.reduce((sum, q) => sum + q.points, 0);
    const isPassed = total >= maxScore * 0.66;
    setScore(total);
    setPassed(isPassed);
    setQuizCompleted(true);
    if (isPassed) markCompleted(selectedItemId);
  }, [answers, dragOrder, currentQuestions, selectedItemId]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(p => p + 1);
      setTimeLeft(30);
    } else {
      handleQuizFinish();
    }
  }, [currentQuestionIndex, currentQuestions.length, handleQuizFinish]);

  const handleItemClick = (itemId: string) => {
    const item = ALL_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    const isCompleted = completedItems.includes(itemId);
    const isCurrent = itemId === selectedItemId;
    
    // Only current and completed items are clickable
    if (isCurrent || isCompleted) {
      setSelectedItemId(itemId);
      resetQuiz();
      if (item.type === 'quiz') setQuizStarted(true);
    }
  };

  const toggleModule = (id: string) => {
    setExpandedModules(p => ({ ...p, [id]: !p[id] }));
  };

  const toggleSection = (id: string) => {
    setExpandedSections(p => ({ ...p, [id]: !p[id] }));
  };

  const handleVideoNext = () => {
    markCompleted(selectedItemId);
    moveToNextItem();
  };

  const handleRewatch = () => {
    const currentIndex = ALL_ITEMS.findIndex(i => i.id === selectedItemId);
    if (currentIndex > 0) {
      const prevItem = ALL_ITEMS[currentIndex - 1];
      if (prevItem.type === 'video') {
        setSelectedItemId(prevItem.id);
        resetQuiz();
      }
    }
  };

  // ── Fullscreen helpers ──────────────────────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.();
  }, []);

  const handleViolation = useCallback(() => {
    violationRef.current += 1;
    const count = violationRef.current;
    setViolationCount(count);
    if (count >= MAX_VIOLATIONS) {
      if (document.fullscreenElement) document.exitFullscreen();
      router.navigate({ to: '/student' });
      return;
    }
    setShowWarning(true);
  }, [router]);

  useEffect(() => {
    if (!started) return;
    const onVisibility = () => { if (document.hidden) handleViolation(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [started, handleViolation]);

  useEffect(() => {
    if (!started) return;
    const onFsChange = () => { if (!document.fullscreenElement) handleViolation(); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [started, handleViolation]);

  useEffect(() => {
    return () => { if (document.fullscreenElement) document.exitFullscreen(); };
  }, []);

  // ── Quiz timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quizStarted || quizCompleted) return;
    if (timeLeft <= 0) {
      handleNextQuestion();
      return;
    }
    const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [quizStarted, quizCompleted, timeLeft, handleNextQuestion]);

  // ── Accept & enter course ───────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        {/* ⚠️ TEST PAGE NOTICE */}
        <div className="mb-6 w-full max-w-lg bg-yellow-100 border-2 border-yellow-400 rounded-xl p-4 text-center">
          <p className="text-yellow-800 font-bold text-lg">⚠️ THIS IS A TEST / DEMO PAGE</p>
          <p className="text-yellow-700 text-sm mt-1">
            This page is only for testing the fullscreen + tab-switch violation feature.
            It is <strong>NOT</strong> part of the actual ViBe platform.
          </p>
        </div>

        {/* Proctoring Declaration — same as original */}
        <div className="bg-card border rounded-2xl shadow-xl p-8 max-w-lg w-full space-y-6">
          <h1 className="text-lg font-extrabold">Declaration</h1>
          <ul className="text-base text-foreground list-disc pl-6 space-y-2">
            <li>I understand that my camera and microphone will be used during this course for proctoring.</li>
            <li>I agree that images from my webcam may be captured at various points if unusual activity is detected.</li>
            <li>I acknowledge that the microphone is used for monitoring purposes only, and no audio or video will be recorded or stored elsewhere.</li>
          </ul>
          <Button
            className="w-full"
            onClick={() => { setStarted(true); enterFullscreen(); }}
          >
            ACCEPT
          </Button>
        </div>
      </div>
    );
  }

  // ── Violation Warning Overlay ───────────────────────────────────────────────
  const ViolationOverlay = () => (
    showWarning ? (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
            Warning {violationCount}/{MAX_VIOLATIONS}
          </h2>
          <p className="text-base text-foreground">
            You left the course window.{' '}
            {MAX_VIOLATIONS - violationCount} warning
            {MAX_VIOLATIONS - violationCount > 1 ? 's' : ''} remaining before you are redirected to the dashboard.
          </p>
          <Button className="w-full" onClick={() => { setShowWarning(false); enterFullscreen(); }}>
            Return to Course
          </Button>
        </div>
      </div>
    ) : null
  );

  // ── Main course layout ──────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <ViolationOverlay />

      {/* ── CODING PLAYGROUND OVERLAY ── */}
      {playgroundOpen && (
        <CodingPlayground
          courseItemId={selectedItemId}
          onClose={() => setPlaygroundOpen(false)}
        />
      )}

      {/* ── FLOATING TRIGGER BUTTON ── */}
      <button
        onClick={openPlayground}
        title="Open Coding Playground"
        className={cn(
          'fixed bottom-6 right-6 z-[9997] flex items-center gap-2 rounded-full px-4 py-3',
          'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all',
          'text-sm font-semibold select-none',
          playgroundOpen && 'opacity-40 pointer-events-none'
        )}
      >
        <Code2 className="h-4 w-4" />
        <span>Coding Playground</span>
      </button>

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-72 flex-shrink-0 flex flex-col h-screen border-r border-border/40 bg-sidebar/50">
        {/* Logo */}
        <div className="p-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">ViBe</span>
            <span className="text-xs text-muted-foreground ml-1">Learning Platform</span>
          </div>

          {/* ⚠️ Demo badge */}
          <div className="mt-2 bg-yellow-100 border border-yellow-400 rounded px-2 py-1 text-center">
            <span className="text-yellow-700 text-xs font-bold">⚠️ DEMO / TEST PAGE</span>
          </div>
        </div>

        {/* Sidebar course navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <div className="space-y-4">
            {DEMO_COURSE.modules.map(module => {
              const isExpanded = expandedModules[module.id];
              return (
                <div key={module.id} className="space-y-1">
                  <button
                    onClick={() => toggleModule(module.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:bg-accent/10 uppercase tracking-wider"
                  >
                    <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                    {module.name}
                  </button>

                  {isExpanded && module.sections.map(section => {
                    const isSecExpanded = expandedSections[section.id];
                    return (
                      <div key={section.id} className="ml-3 space-y-1">
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="w-full flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent/10"
                        >
                          <ChevronRight className={cn("h-3 w-3 transition-transform", isSecExpanded && "rotate-90")} />
                          {section.name}
                        </button>

                        {isSecExpanded && section.items.map(item => {
                          const isCurrent = item.id === selectedItemId;
                          const isCompleted = completedItems.includes(item.id);
                          const isLocked = !isCurrent && !isCompleted;

                          return (
                            <button
                              key={item.id}
                              disabled={isLocked}
                              onClick={() => handleItemClick(item.id)}
                              className={cn(
                                "ml-6 w-[calc(100%-1.5rem)] flex items-center gap-2 px-3 py-2 rounded-md text-[11px] transition-all",
                                isCurrent ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent/5",
                                isLocked && "opacity-40 cursor-not-allowed"
                              )}
                            >
                              <div className={cn(
                                "p-1 rounded flex-shrink-0",
                                isCurrent ? "bg-primary text-primary-foreground" : "bg-accent/20"
                              )}>
                                {item.type === 'video' ? <Play className="h-2.5 w-2.5" /> : <HelpCircle className="h-2.5 w-2.5" />}
                              </div>
                              <span className="flex-1 text-left truncate">{item.name}</span>
                              <div className="flex-shrink-0">
                                {isCurrent ? (
                                  <Play className="h-3 w-3 animate-pulse" />
                                ) : isCompleted ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : (
                                  <span className="text-[10px]">🔒</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Camera preview */}
        <div className="px-3 pt-3 border-t border-border/40">
          <div className="w-full bg-black rounded-lg overflow-hidden">
            <div className="bg-green-600 text-white px-3 py-1 text-xs flex items-center gap-2">
              <span>☑️ All Clear</span>
            </div>
            <div className="flex items-center justify-center bg-gray-800" style={{ height: 100 }}>
              <div className="text-center text-gray-400 text-xs space-y-1">
                <div className="w-10 h-10 rounded-full bg-gray-600 mx-auto flex items-center justify-center">📷</div>
                <p>Camera Preview</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard button */}
        <div className="p-3 border-t border-border/40">
          <Button
            variant="ghost"
            className="w-full justify-start text-sm gap-2"
            onClick={() => router.navigate({ to: '/student' })}
          >
            <Home className="h-4 w-4" /> Dashboard
          </Button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-auto">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/20 bg-background/80 px-6">
          <div className="text-xl font-bold truncate">{selectedItem.name}</div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Violations: {violationCount}/{MAX_VIOLATIONS}
            </Badge>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">

          {/* ── VIDEO ITEM ── */}
          {selectedItem.type === 'video' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                <iframe
                  ref={iframeRef}
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${selectedItem.videoId}?rel=0&modestbranding=1&autoplay=1&enablejsapi=1`}
                  title={selectedItem.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleVideoNext}>
                  Next — Take Quiz <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── QUIZ ITEM ── */}
          {selectedItem.type === 'quiz' && (
            <div className="max-w-2xl mx-auto">

              {/* Quiz not started */}
              {!quizStarted && (
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Ready to Start Your Quiz?</CardTitle>
                    <CardDescription>Test your knowledge from the video.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="text-center p-4">
                        <div className="text-2xl font-bold text-primary">{currentQuestions.length}</div>
                        <div className="text-sm text-muted-foreground">Questions</div>
                      </Card>
                      <Card className="text-center p-4">
                        <div className="text-2xl font-bold text-primary">66%</div>
                        <div className="text-sm text-muted-foreground">Pass Score</div>
                      </Card>
                      <Card className="text-center p-4">
                        <div className="text-2xl font-bold text-primary">30s</div>
                        <div className="text-sm text-muted-foreground">Per Question</div>
                      </Card>
                    </div>
                    <Button className="w-full h-12 text-lg" onClick={() => setQuizStarted(true)}>
                      <Play className="mr-2 h-5 w-5" /> Start Quiz Now
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Quiz in progress */}
              {quizStarted && !quizCompleted && (() => {
                const q = currentQuestions[currentQuestionIndex];
                const typeLabel: Record<string, string> = {
                  MCQ: 'Single Select',
                  MULTI_SELECT: 'Multiple Select',
                  DRAG_DROP: 'Drag & Drop',
                  DROPDOWN: 'Fill in the Blanks',
                };
                const typeBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
                  MCQ: 'default',
                  MULTI_SELECT: 'secondary',
                  DRAG_DROP: 'outline',
                  DROPDOWN: 'destructive',
                };

                // Drag-and-drop helpers
                const currentOrder = dragOrder[q.id] ?? q.items ?? [];
                const moveDrag = (from: number, to: number) => {
                  const next = [...currentOrder];
                  const [item] = next.splice(from, 1);
                  next.splice(to, 0, item);
                  setDragOrder(prev => ({ ...prev, [q.id]: next }));
                };

                return (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <Badge variant="outline">
                          Question {currentQuestionIndex + 1} of {currentQuestions.length}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`font-mono text-lg px-3 py-1 ${timeLeft <= 10 ? 'bg-destructive text-destructive-foreground animate-pulse' : ''}`}
                        >
                          <Clock className="mr-1 h-4 w-4" />
                          {timeLeft}s
                        </Badge>
                      </div>
                      <Progress value={((currentQuestionIndex + 1) / currentQuestions.length) * 100} className="h-3" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center gap-2">
                        <Badge variant={typeBadgeVariant[q.type]}>
                          <Sparkles className="mr-1 h-3 w-3" />
                          {typeLabel[q.type]}
                        </Badge>
                        <Badge variant="outline">
                          <Trophy className="mr-1 h-3 w-3" />
                          {q.points} points
                        </Badge>
                      </div>

                      <h2 className="text-xl font-semibold">{q.question}</h2>

                      {/* ── MCQ ── */}
                      {q.type === 'MCQ' && q.options && (
                        <RadioGroup
                          value={(answers[q.id] as number | undefined)?.toString()}
                          onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: parseInt(v) }))}
                          className="space-y-3"
                        >
                          {q.options.map((opt, i) => (
                            <Label
                              key={i}
                              htmlFor={`mcq-${q.id}-${i}`}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors',
                                (answers[q.id] as number) === i && 'border-primary bg-primary/5'
                              )}
                            >
                              <RadioGroupItem value={i.toString()} id={`mcq-${q.id}-${i}`} />
                              <span>{opt}</span>
                            </Label>
                          ))}
                        </RadioGroup>
                      )}

                      {/* ── MULTI_SELECT ── */}
                      {q.type === 'MULTI_SELECT' && q.options && (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">Select all that apply:</p>
                          {q.options.map((opt, i) => {
                            const sel = (answers[q.id] as number[] | undefined) ?? [];
                            return (
                              <Label
                                key={i}
                                htmlFor={`ms-${q.id}-${i}`}
                                className={cn(
                                  'flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors',
                                  sel.includes(i) && 'border-primary bg-primary/5'
                                )}
                              >
                                <Checkbox
                                  id={`ms-${q.id}-${i}`}
                                  checked={sel.includes(i)}
                                  onCheckedChange={checked => {
                                    const next = checked ? [...sel, i] : sel.filter(x => x !== i);
                                    setAnswers(prev => ({ ...prev, [q.id]: next }));
                                  }}
                                />
                                <span>{opt}</span>
                              </Label>
                            );
                          })}
                        </div>
                      )}

                      {/* ── DRAG_DROP ── */}
                      {q.type === 'DRAG_DROP' && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Drag items into the correct order:</p>
                          {currentOrder.map((item, idx) => (
                            <div
                              key={item}
                              draggable
                              onDragStart={() => setDraggingIdx(idx)}
                              onDragOver={e => e.preventDefault()}
                              onDrop={() => {
                                if (draggingIdx !== null && draggingIdx !== idx) moveDrag(draggingIdx, idx);
                                setDraggingIdx(null);
                              }}
                              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 cursor-grab active:cursor-grabbing hover:bg-accent/30 transition-colors"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                              <Badge variant="outline" className="min-w-[28px] justify-center shrink-0">{idx + 1}</Badge>
                              <span className="flex-1 text-sm">{item}</span>
                              <div className="flex gap-1">
                                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveDrag(idx, Math.max(0, idx - 1))}>&#8593;</Button>
                                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveDrag(idx, Math.min(currentOrder.length - 1, idx + 1))}>&#8595;</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── DROPDOWN ── */}
                      {q.type === 'DROPDOWN' && q.sentence && (
                        <div className="rounded-lg border border-border p-4 text-sm leading-9">
                          <div className="flex flex-wrap items-center gap-1">
                            {q.sentence.split(/({{[^}]+}})/g).filter(Boolean).map((part, idx) => {
                              const match = part.match(/{{(.*?)}}/);
                              if (!match) return <span key={idx}>{part}</span>;
                              const key = match[1];
                              const opts = q.dropdownOptions?.[key] ?? [];
                              const ans = (answers[q.id] as Record<string, string> | undefined) ?? {};
                              return (
                                <select
                                  key={idx}
                                  value={ans[key] ?? ''}
                                  onChange={e => setAnswers(prev => ({
                                    ...prev,
                                    [q.id]: { ...(prev[q.id] as Record<string, string> ?? {}), [key]: e.target.value },
                                  }))}
                                  className="rounded-md border border-primary bg-background px-2 py-0.5 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                                >
                                  <option value="">Select…</option>
                                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <Separator />
                      <div className="flex justify-end">
                        <Button
                          onClick={handleNextQuestion}
                          disabled={!isAnswerGiven(q)}
                        >
                          {currentQuestionIndex === currentQuestions.length - 1 ? 'Finish' : 'Next'}
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Quiz result */}
              {quizCompleted && (
                <Card>
                  <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold">Quiz Completed!</CardTitle>
                    <CardDescription>Here are your results.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 text-center">
                    <div className="text-6xl font-bold text-primary">
                      {score}/{currentQuestions.reduce((s, q) => s + q.points, 0)}
                    </div>
                    <p className="text-xl">
                      You scored {Math.round((score / (currentQuestions.reduce((s, q) => s + q.points, 0))) * 100)}%
                    </p>

                    <Badge
                      variant={passed ? 'success' : 'destructive'}
                      className="text-lg px-4 py-2"
                    >
                      {passed ? '🎉 Passed!' : 'Attempt Unsuccessful'}
                    </Badge>

                    <div className="flex flex-wrap justify-center gap-3 pt-4">
                      {!passed && (
                        <Button variant="outline" onClick={handleRewatch}>
                          <ChevronLeft className="h-4 w-4 mr-2" /> Rewatch Video
                        </Button>
                      )}
                      {passed && (
                        <>
                          <Button onClick={moveToNextItem}>
                            Next Lesson <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                          <Button variant="outline" onClick={() => router.navigate({ to: '/student' })}>
                            <Home className="h-4 w-4 mr-2" /> Dashboard
                          </Button>
                        </>
                      )}
                    </div>

                    {!passed && (
                      <p className="text-sm text-destructive mt-4 animate-pulse">
                        Redirecting to video in a few seconds...
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
