import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader, Send } from 'lucide-react';
import useSupportChat from '@/hooks/useSupportChat';
import { FAQCategory } from '@/modules/supportChat/types';

interface EscalationFormProps {
  questionId: string;
  /** The page the learner was on, shown so they know it travels with the report. */
  page?: string;
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
      <div className='ml-8 rounded border border-green-200 bg-green-50 p-3 text-xs text-green-800'>
        <CheckCircle2 className='mr-1 inline h-3 w-3' />
        Reported. The support team can see your issue and will get back to you.
      </div>
    );
  }

  if (!open) {
    return (
      <div className='ml-8 space-y-2 rounded border-l-2 border-blue-400 bg-blue-50 p-2 text-xs text-blue-700'>
        <p>
          <AlertCircle className='mr-1 inline h-3 w-3' />
          A support team member will review this shortly.
        </p>
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='rounded border border-blue-300 bg-white px-2 py-1 font-medium text-blue-700 transition-colors hover:bg-blue-100'
        >
          Report a technical issue
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='ml-8 space-y-3 rounded border border-gray-200 bg-white p-3'
    >
      <div>
        <p className='text-xs font-semibold text-gray-800'>Report a technical issue</p>
        <p className='mt-0.5 text-[11px] text-gray-500'>
          {page ? `We'll include the page you're on (${page}).` : 'Tell us what went wrong.'}
        </p>
      </div>

      <div>
        <label
          htmlFor='escalation-category'
          className='mb-1 block text-[11px] font-medium text-gray-700'
        >
          What kind of issue is it?
        </label>
        <select
          id='escalation-category'
          value={category}
          onChange={(e) => setCategory(e.target.value as FAQCategory)}
          disabled={submitting}
          className='w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
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
          className='mb-1 block text-[11px] font-medium text-gray-700'
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
          className='w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
        />
      </div>

      <div>
        <label
          htmlFor='escalation-email'
          className='mb-1 block text-[11px] font-medium text-gray-700'
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
          className='w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
        />
      </div>

      {error && <p className='text-[11px] text-red-600'>{error}</p>}

      <div className='flex gap-2'>
        <button
          type='submit'
          disabled={submitting || details.trim().length < MIN_DETAIL_LENGTH}
          className='inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
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
          className='rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50'
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
