import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader, Send } from 'lucide-react';
import useSupportChat from '@/hooks/useSupportChat';
import { FAQCategory } from '@/modules/supportChat/types';

interface EscalationFormProps {
  questionId: string;
  /** The page the learner was on, shown so they know it travels with the report. */
  page?: string;
  /** Replaces the default "a team member will review this" line, e.g. after a "Not helpful" rating. */
  notice?: string;
  onSubmitted?: () => void;
}

const CATEGORY_OPTIONS: Array<{ value: FAQCategory; label: string }> = [
  { value: FAQCategory.TECHNICAL, label: 'Something on the platform is broken' },
  { value: FAQCategory.LOGIN, label: 'Login or enrollment' },
  { value: FAQCategory.PROCTORING, label: 'Proctoring' },
  { value: FAQCategory.FEATURES, label: 'How a feature works' },
  { value: FAQCategory.OTHER, label: 'Something else' },
];

const MIN_DETAIL_LENGTH = 10;

/**
 * Shown when the assistant has no answer. The question row already exists at
 * this point — this collects the detail a one-line chat turn could not carry,
 * and hands it to the instructor/admin support queue.
 */
export default function EscalationForm({
  questionId,
  page,
  notice,
  onSubmitted,
}: EscalationFormProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FAQCategory>(FAQCategory.TECHNICAL);
  const [details, setDetails] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { submitEscalation } = useSupportChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (details.trim().length < MIN_DETAIL_LENGTH || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitEscalation(questionId, {
        category,
        details: details.trim(),
        contactEmail: contactEmail.trim() || undefined,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (submitError) {
      console.error('Failed to submit issue report:', submitError);
      setError("That didn't go through. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className='ml-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-400'>
        <CheckCircle2 className='mr-1 inline h-3 w-3' />
        Reported. The support team can see your issue and will get back to you.
      </div>
    );
  }

  if (!open) {
    return (
      <div className='ml-2 space-y-2 rounded-md border-l-2 border-primary bg-primary/10 p-2 text-xs text-foreground'>
        <p>
          <AlertCircle className='mr-1 inline h-3 w-3' />
          {notice ?? 'A support team member will review this shortly.'}
        </p>
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='rounded-md border border-primary/50 bg-card px-2 py-1 font-medium text-primary transition-colors hover:bg-primary/10'
        >
          Report a technical issue
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='ml-2 space-y-3 rounded-md border border-border bg-card p-3 text-card-foreground'
    >
      <div>
        <p className='text-xs font-semibold'>Report a technical issue</p>
        <p className='mt-0.5 text-[11px] text-muted-foreground'>
          {page ? `We'll include the page you're on (${page}).` : 'Tell us what went wrong.'}
        </p>
      </div>

      <div>
        <label
          htmlFor='escalation-category'
          className='mb-1 block text-[11px] font-medium text-muted-foreground'
        >
          What kind of issue is it?
        </label>
        <select
          id='escalation-category'
          value={category}
          onChange={(e) => setCategory(e.target.value as FAQCategory)}
          disabled={submitting}
          className='w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor='escalation-details'
          className='mb-1 block text-[11px] font-medium text-muted-foreground'
        >
          What happened?
        </label>
        <textarea
          id='escalation-details'
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder='e.g. The video freezes at 3:12 and the page stops responding.'
          disabled={submitting}
          rows={3}
          maxLength={2000}
          className='w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'
        />
      </div>

      <div>
        <label
          htmlFor='escalation-email'
          className='mb-1 block text-[11px] font-medium text-muted-foreground'
        >
          Contact email (optional)
        </label>
        <input
          id='escalation-email'
          type='email'
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder='Only if it differs from your account email'
          disabled={submitting}
          className='w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'
        />
      </div>

      {error && <p className='text-[11px] text-destructive'>{error}</p>}

      <div className='flex gap-2'>
        <button
          type='submit'
          disabled={submitting || details.trim().length < MIN_DETAIL_LENGTH}
          className='inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {submitting ? (
            <Loader className='h-3 w-3 animate-spin' />
          ) : (
            <Send className='h-3 w-3' />
          )}
          Submit report
        </button>
        <button
          type='button'
          onClick={() => setOpen(false)}
          disabled={submitting}
          className='rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted'
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
