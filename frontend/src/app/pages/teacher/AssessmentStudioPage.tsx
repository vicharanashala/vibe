import { useState } from 'react';
import { Brain, Sparkles, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuizBuilder } from '@/components/assessment/QuizBuilder';
import type { AssessmentQuestion } from '@/types/assessment.types';
import { generateAssessmentQuestionsFromTranscript } from '@/utils/assessmentQuestions';
import { toast } from 'sonner';

export function AssessmentStudioPage() {
  const [transcript, setTranscript] = useState(
    'The instructor emphasized that a strong feedback loop and consistent practice improve retention. They also highlighted that learners should revisit core concepts before attempting new material.'
  );
  const [aiQuestions, setAiQuestions] = useState<AssessmentQuestion[]>([]);
  const [savedJSON, setSavedJSON] = useState<string>('');

  const generateFromTranscript = () => {
    const generated = generateAssessmentQuestionsFromTranscript(transcript, 4);
    setAiQuestions(generated);
    toast.success(`Generated ${generated.length} questions from transcript`);
  };

  const handleSave = (questions: AssessmentQuestion[]) => {
    setSavedJSON(JSON.stringify(questions, null, 2));
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Assessment Studio</p>
          <h1 className="text-3xl font-semibold">Quiz Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Build quizzes manually or generate from a video transcript</p>
        </div>
      </div>

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Quiz Builder
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Brain className="h-4 w-4" /> AI Generate
          </TabsTrigger>
        </TabsList>

        {/* ── Manual Builder tab ── */}
        <TabsContent value="builder" className="mt-4">
          <div className="h-[calc(100vh-260px)] min-h-[500px]">
            <QuizBuilder
              initialQuestions={aiQuestions.length > 0 ? aiQuestions : undefined}
              onSave={handleSave}
            />
          </div>
          {savedJSON && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saved JSON (ready for AI service)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="rounded-lg bg-muted p-3 text-xs overflow-auto max-h-64">{savedJSON}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── AI Generate tab ── */}
        <TabsContent value="ai" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" /> Transcript Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label>Paste the video transcript below</Label>
              <Textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                rows={8}
                placeholder="Paste transcript here…"
              />
              <Button type="button" onClick={generateFromTranscript} className="gap-2">
                <Sparkles className="h-4 w-4" /> Generate questions
              </Button>
              {aiQuestions.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  ✅ {aiQuestions.length} questions generated — switch to the <strong>Quiz Builder</strong> tab to edit and save them.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AssessmentStudioPage;
