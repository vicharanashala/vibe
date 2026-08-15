import React, { useEffect, useState } from 'react';
import { CheckCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRespondToQuestion, useResolveQuestion } from '@/hooks/useAdminSupport';
import {
  FAQCategory,
  ISupportQuestion,
  SupportQuestionStatus,
} from '@/modules/supportChat/types';
import { StatusBadge } from './QuestionsTable';

interface ResponsePanelProps {
  question: ISupportQuestion;
  onResponseSubmitted: () => void;
}

const CATEGORY_LABELS: Record<FAQCategory, string> = {
  [FAQCategory.LOGIN]: 'Login & access',
  [FAQCategory.TECHNICAL]: 'Technical issue',
  [FAQCategory.PROCTORING]: 'Proctoring',
  [FAQCategory.FEATURES]: 'Features',
  [FAQCategory.OTHER]: 'Other',
};

export default function ResponsePanel({ question, onResponseSubmitted }: ResponsePanelProps) {
  const [response, setResponse] = useState('');
  const [createFaq, setCreateFaq] = useState(false);
  const [faqCategory, setFaqCategory] = useState<FAQCategory>(FAQCategory.OTHER);
  const [faqTags, setFaqTags] = useState('');

  const respondMutation = useRespondToQuestion();
  const resolveMutation = useResolveQuestion();
  const busy = respondMutation.isPending || resolveMutation.isPending;

  // Switching questions must not carry a half-typed answer across to the next
  // learner's ticket.
  useEffect(() => {
    setResponse('');
    setCreateFaq(false);
    setFaqTags('');
    setFaqCategory(question.escalation?.category ?? FAQCategory.OTHER);
  }, [question._id, question.escalation?.category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!response.trim() || busy) return;

    try {
      await respondMutation.mutateAsync({
        questionId: question._id!,
        request: {
          response,
          createFaq,
          faqCategory: createFaq ? faqCategory : undefined,
          faqTags: createFaq
            ? faqTags.split(',').map((t) => t.trim()).filter(Boolean)
            : undefined,
        },
      });

      toast.success('Response sent to the learner');
      onResponseSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit response');
    }
  };

  const handleResolve = async () => {
    try {
      await resolveMutation.mutateAsync(question._id!);
      toast.success('Marked as resolved');
      onResponseSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve question');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Respond</CardTitle>
        <StatusBadge status={question.status} />
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Question</p>
          <div className="rounded-md border bg-muted/50 p-3 text-sm">{question.question}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Asked {new Date(question.createdAt).toLocaleString()}
          </p>
        </div>

        {question.escalation && (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-medium">
              Reported issue — {CATEGORY_LABELS[question.escalation.category]}
            </p>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {question.escalation.details}
            </p>
            {question.escalation.contactEmail && (
              <p className="text-xs text-muted-foreground">
                Contact: {question.escalation.contactEmail}
              </p>
            )}
          </div>
        )}

        {question.adminResponse && (
          <div className="rounded-md border p-3 text-sm">
            <p className="mb-1 font-medium">Previous response</p>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {question.adminResponse.response}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-response">Your response</Label>
            <Textarea
              id="support-response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Answer the learner..."
              disabled={busy}
              rows={6}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">{response.length}/5000</p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-faq"
                checked={createFaq}
                onCheckedChange={(checked) => setCreateFaq(checked === true)}
                disabled={busy}
              />
              <Label htmlFor="create-faq" className="cursor-pointer text-sm font-medium">
                Add this answer to the FAQ bank
              </Label>
            </div>

            {createFaq && (
              <div className="space-y-3 rounded-md border bg-muted/40 p-3">
                <div className="space-y-2">
                  <Label htmlFor="faq-category">Category</Label>
                  <Select
                    value={faqCategory}
                    onValueChange={(value) => setFaqCategory(value as FAQCategory)}
                    disabled={busy}
                  >
                    <SelectTrigger id="faq-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(FAQCategory).map((category) => (
                        <SelectItem key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="faq-tags">Tags (comma-separated)</Label>
                  <Input
                    id="faq-tags"
                    value={faqTags}
                    onChange={(e) => setFaqTags(e.target.value)}
                    placeholder="video, playback, troubleshooting"
                    disabled={busy}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={busy || !response.trim()} className="flex-1">
              <Send className="mr-2 h-4 w-4" />
              Send response
            </Button>
            {question.status !== SupportQuestionStatus.RESOLVED && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResolve}
                disabled={busy}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark resolved
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
