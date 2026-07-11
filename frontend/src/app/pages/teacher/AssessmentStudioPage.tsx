import { useMemo, useState } from 'react';
import { Brain, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AssessmentQuestionComposer } from '@/components/assessment/AssessmentQuestionComposer';
import { AssessmentQuestionRenderer } from '@/components/assessment/AssessmentQuestionRenderer';
import type { AssessmentQuestion } from '@/types/assessment.types';
import { createAssessmentQuestion, generateAssessmentQuestionsFromTranscript, validateAssessmentQuestion } from '@/utils/assessmentQuestions';

export function AssessmentStudioPage() {
  const [transcript, setTranscript] = useState('The instructor emphasized that a strong feedback loop and consistent practice improve retention. They also highlighted that learners should revisit core concepts before attempting new material.');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(() => [createAssessmentQuestion('MCQ')]);

  const validationSummary = useMemo(() => questions.map(question => ({
    id: question.id,
    ...validateAssessmentQuestion(question),
  })), [questions]);

  const generateFromTranscript = () => {
    setQuestions(generateAssessmentQuestionsFromTranscript(transcript, 3));
  };

  const updateQuestion = (index: number, next: AssessmentQuestion) => {
    setQuestions(current => current.map((question, itemIndex) => (itemIndex === index ? next : question)));
  };

  const addQuestion = () => {
    setQuestions(current => [...current, createAssessmentQuestion('MCQ')]);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Assessment Studio</p>
          <h1 className="text-3xl font-semibold">Adaptive multi-modal assessment builder</h1>
        </div>
        <Button type="button" onClick={generateFromTranscript} className="gap-2">
          <Sparkles className="h-4 w-4" /> Generate from transcript
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" /> Transcript input
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Most recent watched video transcript</Label>
          <Textarea value={transcript} onChange={event => setTranscript(event.target.value)} rows={8} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Question authoring</Label>
            <Button type="button" variant="outline" onClick={addQuestion}>Add question</Button>
          </div>
          {questions.map((question, index) => (
            <AssessmentQuestionComposer key={question.id} value={question} onChange={next => updateQuestion(index, next)} />
          ))}
        </div>
        <div className="space-y-4">
          <Label className="text-base font-semibold">Preview</Label>
          {questions.map(question => (
            <div key={`${question.id}-preview`} className="space-y-2">
              <AssessmentQuestionRenderer question={question} />
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {JSON.stringify(question, null, 2)}
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Validation</p>
            <ul className="mt-2 space-y-1">
              {validationSummary.map(item => (
                <li key={item.id}>
                  {item.valid ? '✅ Valid' : `⚠️ ${Object.values(item.error ?? {}).flat().join(', ')}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssessmentStudioPage;
