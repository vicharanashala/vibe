'use client';

import { useState, useMemo } from 'react';
import { useSearch, Link } from '@tanstack/react-router';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, CheckCircle, Play, Flame, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useGetSchedule } from '@/hooks/spaced-repetition-hooks';
import { DEMO_STUDENT_ID, isDemoStudentEmail } from '@/lib/spaced-repetition-api';
import { toast } from 'sonner';

export default function ReviewPage() {
  const { user, token } = useAuthStore();
  // See RetentionDashboard for rationale. Demo email -> seeded DEMO_STUDENT_ID.
  const studentId =
    isDemoStudentEmail(user?.email) ? DEMO_STUDENT_ID : (user?.uid ?? '');
  
  // Grab courseId from URL if they clicked a specific course on the dashboard
  const search = useSearch({ strict: false });
  const targetCourseId = (search as any).courseId as string | undefined;

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

  // 2. Handle the 0-5 SM2 Score Submission
  const handleScoreSubmit = async (quality: number) => {
    setIsSubmitting(true);
    const currentCard = activeQueue[currentIndex];

    try {
      const response = await fetch(`http://localhost:3141/api/spaced-repetition/${studentId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}` // Top-level token from auth store
        },
        body: JSON.stringify({
          questionId: currentCard.question_id,
          quality: quality
        })
      });

      if (!response.ok) throw new Error('Failed to save review');

      // Move to next card or finish session
      if (currentIndex + 1 >= activeQueue.length) {
        setSessionState('complete');
        refetch(); // Update the global cache so the dashboard shows 0 due
      } else {
        setIsFlipped(false);
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      toast.error("Failed to save your answer. Please try again.");
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
        <Button size="lg" onClick={() => setSessionState('active')} className="w-full max-w-xs">
          <Play className="mr-2 h-4 w-4" fill="currentColor" /> Begin Session
        </Button>
      </Card>
    );
  }

  // --- STATE 3: ACTIVE (Flashcard UI) ---
  if (sessionState === 'active') {
    const currentCard = activeQueue[currentIndex];
    const isExamPrep = currentCard.exam_prep_mode;

    return (
      <div className="max-w-2xl mx-auto mt-8 space-y-6">
        <div className="flex justify-between items-center text-sm font-medium text-muted-foreground px-1">
          <span>Card {currentIndex + 1} of {activeQueue.length}</span>
          {isExamPrep && <span className="text-amber-600 flex items-center gap-1"><Flame className="h-4 w-4" /> Priority</span>}
        </div>

        <Card className={`min-h-[300px] flex flex-col transition-all duration-300 ${isExamPrep ? 'ring-2 ring-amber-400/50 shadow-amber-100' : 'shadow-md'}`}>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            {/* The "Front" of the card */}
            <h2 className="text-2xl font-medium mb-6">Question {currentCard.question_id}</h2>
            
            {/* Teacher Remediation Hint - Shows up if they have struggled before */}
            {currentCard.remediation_hint && (
              <div className="bg-blue-50 text-blue-800 border border-blue-200 rounded p-3 text-sm flex items-start gap-2 max-w-sm mb-6">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-left"><strong>Teacher Hint:</strong> {currentCard.remediation_hint}</span>
              </div>
            )}

            {/* The "Back" of the card */}
            {!isFlipped ? (
              <Button size="lg" variant="secondary" className="mt-8 w-48" onClick={() => setIsFlipped(true)}>
                Show Answer
              </Button>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex flex-col items-center">
                <div className="w-full max-w-md p-6 bg-muted/30 rounded-lg border text-muted-foreground mb-8">
                  [ The answer content would render here based on {currentCard.question_id} ]
                </div>
                
                <p className="font-medium text-sm mb-4">How well did you remember this?</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-lg">
                  <Button disabled={isSubmitting} variant="outline" className="border-rose-200 hover:bg-rose-50 hover:text-rose-700" onClick={() => handleScoreSubmit(1)}>
                    Again (1)
                  </Button>
                  <Button disabled={isSubmitting} variant="outline" className="border-amber-200 hover:bg-amber-50 hover:text-amber-700" onClick={() => handleScoreSubmit(3)}>
                    Hard (3)
                  </Button>
                  <Button disabled={isSubmitting} variant="outline" className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => handleScoreSubmit(4)}>
                    Good (4)
                  </Button>
                  <Button disabled={isSubmitting} variant="outline" className="border-blue-200 hover:bg-blue-50 hover:text-blue-700" onClick={() => handleScoreSubmit(5)}>
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
        <Link to="/student">Return to Dashboard</Link>
      </Button>
    </Card>
  );
}