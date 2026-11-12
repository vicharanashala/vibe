'use client';

import { useState, useMemo } from 'react';
import { useSearch, Link, useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, CheckCircle, Play, Flame, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useGetSchedule } from '@/hooks/spaced-repetition-hooks';
import {
  DEMO_STUDENT_ID,
  isDemoStudentEmail,
  submitReview,
} from '@/lib/spaced-repetition-api';
import { RecallQuality } from '@/types/spaced-repetition.types';
import { toast } from 'sonner';

interface QuestionDetail {
  id: string;
  body: string;
  type: string;
  options?: string[];
  answer: string;
  explanation?: string;
  hint?: string;
}

const QUESTION_CATALOG: Record<string, QuestionDetail> = {
  'mock-question-1': {
    id: 'mock-question-1',
    body: 'Which of the following are linear data structures?',
    type: 'SELECT MANY',
    options: ['Array', 'Linked List', 'Binary Tree', 'Stack'],
    answer: 'Array, Linked List, and Stack',
    explanation: 'Linear data structures arrange elements sequentially where each element has at most one predecessor and one successor. A Binary Tree is hierarchical (non-linear).',
    hint: 'Linear means each element has at most one predecessor and one successor.',
  },
  'mock-question-2': {
    id: 'mock-question-2',
    body: 'What is the worst-case time complexity of binary search on a sorted array?',
    type: 'SELECT ONE',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    answer: 'O(log n)',
    explanation: 'Binary search repeatedly divides the search interval in half. In the worst case, it takes logarithmic time O(log n).',
    hint: 'Divide-and-conquer halves the search space each step.',
  },
  'mock-question-3': {
    id: 'mock-question-3',
    body: 'How many bits are in a byte?',
    type: 'NUMERIC ANSWER',
    options: [],
    answer: '8 bits',
    explanation: 'Standard computing architecture defines 1 byte as exactly 8 bits. A half-byte (4 bits) is called a nibble.',
    hint: 'A nibble is half of this.',
  },
  'mock-question-4': {
    id: 'mock-question-4',
    body: 'Which layer of the OSI model is responsible for routing packets?',
    type: 'SELECT ONE',
    options: ['Application', 'Transport', 'Network', 'Data Link'],
    answer: 'Network Layer (Layer 3)',
    explanation: 'The Network layer handles logical addressing and packet forwarding across intermediate networks.',
    hint: 'It sits between Transport and Data Link.',
  },
  'mock-question-cross-1': {
    id: 'mock-question-cross-1',
    body: 'In a relational database, what does a foreign key constraint enforce?',
    type: 'SELECT ONE',
    options: [
      'Uniqueness within a column',
      'Referential integrity across tables',
      'NULL is always allowed',
      'Cascading triggers fire automatically',
    ],
    answer: 'Referential integrity across tables',
    explanation: 'A foreign key creates a relationship ensuring that a value in one table corresponds to a valid primary key in another referenced table.',
    hint: 'It links rows across tables.',
  },
  'mock-question-cross-2': {
    id: 'mock-question-cross-2',
    body: 'What does ACID stand for in database transactions?',
    type: 'SELECT MANY',
    options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
    answer: 'Atomicity, Consistency, Isolation, Durability',
    explanation: 'ACID properties guarantee that database transactions are processed reliably even in the event of hardware or system failures.',
    hint: 'Atomicity, Consistency, Isolation, Durability.',
  },
};

function getQuestionDetails(questionId: string) {
  if (QUESTION_CATALOG[questionId]) {
    return QUESTION_CATALOG[questionId];
  }
  return {
    id: questionId,
    body: `Core Topic Review: ${questionId}`,
    type: 'CONCEPT REVIEW',
    options: [],
    answer: `Review and recall core concepts for ${questionId}.`,
    explanation: 'Reinforce the definition, primary application, and edge cases of this topic.',
    hint: undefined,
  };
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  // See RetentionDashboard for rationale. Demo email -> seeded DEMO_STUDENT_ID.
  const studentId =
    isDemoStudentEmail(user?.email) ? DEMO_STUDENT_ID : (user?.uid ?? '');
  
  // Grab courseId from URL if they clicked a specific course on the dashboard
  const search = useSearch({ strict: false });
  const targetCourseId = (search as Record<string, unknown>).courseId as string | undefined;

  const { data: schedule, isLoading, refetch } = useGetSchedule(studentId);
  
  const [sessionState, setSessionState] = useState<'lobby' | 'active' | 'complete'>('lobby');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Build the targeted, sorted queue
  const activeQueue = useMemo(() => {
    if (!schedule) return [];
    
    let dueItems = schedule.filter(item => new Date(item.next_review_at).getTime() < Date.now());

    if (targetCourseId) {
      dueItems = dueItems.filter(item => item.course_id === targetCourseId);
    }

    // Sort: Exam Prep items FIRST, then chronological
    return dueItems.sort((a, b) => {
      if (a.exam_prep_mode && !b.exam_prep_mode) return -1;
      if (!a.exam_prep_mode && b.exam_prep_mode) return 1;
      return new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime();
    });
  }, [schedule, targetCourseId]);

  // 2. Handle the SM-2 Score Submission via Spaced Repetition API
  const handleScoreSubmit = async (quality: RecallQuality) => {
    setIsSubmitting(true);
    const currentCard = activeQueue[currentIndex];

    try {
      await submitReview(studentId, currentCard.question_id, quality);

      // Move to next card or finish session
      if (currentIndex + 1 >= activeQueue.length) {
        setSessionState('complete');
        refetch(); // Invalidate schedule query so dashboard reflects 0 due
      } else {
        setIsFlipped(false);
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Failed to save your answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading your deck...</div>;

  // --- STATE 1: CAUGHT UP (Empty State) ---
  if (activeQueue.length === 0 && sessionState !== 'complete') {
    return (
      <Card className="max-w-md mx-auto mt-12 text-center py-12 border-emerald-100 bg-emerald-50/30">
        <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
        <CardTitle className="mb-2">You're all caught up!</CardTitle>
        <p className="text-muted-foreground mb-6">No cards are due for review right now.</p>
        <Button asChild>
          <Link to="/student">Back to Dashboard</Link>
        </Button>
      </Card>
    );
  }

  // --- STATE 2: LOBBY (Pre-flight check) ---
  if (sessionState === 'lobby') {
    const hasExamPrep = activeQueue.some(item => item.exam_prep_mode);
    
    return (
      <Card className="max-w-md mx-auto mt-12 text-center py-10 shadow-md">
        <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
        <CardTitle className="text-2xl mb-2">Ready to focus?</CardTitle>
        <div className="text-muted-foreground mb-8 space-y-2">
          <p>You have <strong className="text-foreground">{activeQueue.length}</strong> cards due for review.</p>
          {targetCourseId && <p className="text-sm">Targeting specific course.</p>}
          
          {hasExamPrep && (
            <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-xs font-medium mt-2">
              <Flame className="h-3.5 w-3.5" />
              Exam Prep Mode active for this deck
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 px-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate({ to: '/student/review/dashboard' });
              }
            }}
            className="w-full sm:w-auto min-w-[120px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => setSessionState('active')}
            className="w-full sm:w-auto min-w-[160px]"
          >
            <Play className="mr-2 h-4 w-4" fill="currentColor" /> Begin Session
          </Button>
        </div>
      </Card>
    );
  }

  // --- STATE 3: ACTIVE (Flashcard UI) ---
  if (sessionState === 'active') {
    const currentCard = activeQueue[currentIndex];
    const isExamPrep = currentCard.exam_prep_mode;
    const qDetails = getQuestionDetails(currentCard.question_id);
    const hintText = currentCard.remediation_hint || qDetails.hint;

    return (
      <div className="max-w-2xl mx-auto mt-8 space-y-6">
        <div className="flex justify-between items-center text-sm font-medium text-muted-foreground px-1">
          <span>Card {currentIndex + 1} of {activeQueue.length}</span>
          {isExamPrep && <span className="text-amber-600 flex items-center gap-1 font-semibold"><Flame className="h-4 w-4" /> Priority</span>}
        </div>

        <Card className={`min-h-[360px] flex flex-col transition-all duration-300 ${isExamPrep ? 'ring-2 ring-amber-400/50 shadow-amber-100' : 'shadow-md'}`}>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            {/* The "Front" of the card */}
            <div className="w-full max-w-lg flex flex-col items-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-primary/80 mb-2">
                {qDetails.type}
              </span>
              <h2 className="text-xl md:text-2xl font-semibold mb-6 text-foreground text-center">
                {qDetails.body}
              </h2>

              {qDetails.options && qDetails.options.length > 0 && (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                  {qDetails.options.map((opt, i) => (
                    <div
                      key={i}
                      className="border rounded-md px-3.5 py-2.5 bg-background text-sm text-left font-medium text-muted-foreground shadow-sm flex items-center gap-2"
                    >
                      <span className="text-xs font-bold text-primary/70 bg-primary/10 rounded px-1.5 py-0.5">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Blue Hint Box - ALWAYS displayed for all questions */}
              <div className="bg-blue-50/90 text-blue-900 border border-blue-200/80 rounded-lg p-3 text-sm flex items-start gap-2.5 max-w-lg w-full mb-6 text-left shadow-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
                <div className="flex-1">
                  {currentCard.remediation_hint ? (
                    <span><strong>Teacher Hint:</strong> {currentCard.remediation_hint}</span>
                  ) : hintText ? (
                    <span><strong>Hint:</strong> {hintText}</span>
                  ) : (
                    <span className="text-blue-700/80 italic">No hints have been enabled for this question.</span>
                  )}
                </div>
              </div>
            </div>

            {/* The "Back" of the card */}
            {!isFlipped ? (
              <Button size="lg" variant="secondary" className="mt-4 w-48 shadow-sm font-medium" onClick={() => setIsFlipped(true)}>
                Show Answer
              </Button>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex flex-col items-center">
                <div className="w-full max-w-lg p-5 bg-emerald-50/50 rounded-lg border border-emerald-200 text-left mb-6 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600" /> Correct Answer
                  </div>
                  <div className="text-base font-semibold text-emerald-950 mb-2">
                    {qDetails.answer}
                  </div>
                  {qDetails.explanation && (
                    <p className="text-xs text-emerald-800/90 leading-relaxed">
                      {qDetails.explanation}
                    </p>
                  )}
                </div>

                <p className="font-medium text-sm mb-4 text-muted-foreground">How well did you remember this?</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-lg">
                  <Button disabled={isSubmitting} variant="outline" className="border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-medium" onClick={() => handleScoreSubmit('missed')}>
                    Again (1)
                  </Button>
                  <Button disabled={isSubmitting} variant="outline" className="border-amber-200 hover:bg-amber-50 hover:text-amber-700 font-medium" onClick={() => handleScoreSubmit('unsure')}>
                    Hard (3)
                  </Button>
                  <Button disabled={isSubmitting} variant="outline" className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 font-medium" onClick={() => handleScoreSubmit('got_it')}>
                    Good (4)
                  </Button>
                  <Button disabled={isSubmitting} variant="outline" className="border-blue-200 hover:bg-blue-50 hover:text-blue-700 font-medium" onClick={() => handleScoreSubmit('got_it')}>
                    Easy (5)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- STATE 4: COMPLETE ---
  return (
    <Card className="max-w-md mx-auto mt-12 text-center py-12 border-emerald-100 bg-emerald-50/30">
      <CardTitle className="mb-2 text-emerald-700 text-2xl">Session Complete!</CardTitle>
      <p className="text-emerald-600/80 mb-8">Great job crushing those reviews.</p>
      <Button asChild size="lg">
        <Link to="/student/review/dashboard">Return to Dashboard</Link>
      </Button>
    </Card>
  );
}
