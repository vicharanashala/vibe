import React, { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { ISupportQuestion, FAQCategory } from '@/modules/supportChat/types';
import useAdminSupport from '@/hooks/useAdminSupport';

interface ResponsePanelProps {
  question: ISupportQuestion;
  onResponseSubmitted: () => void;
}

export default function ResponsePanel({ question, onResponseSubmitted }: ResponsePanelProps) {
  const [response, setResponse] = useState('');
  const [createFaq, setCreateFaq] = useState(false);
  const [faqCategory, setFaqCategory] = useState<FAQCategory>(FAQCategory.OTHER);
  const [faqTags, setFaqTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { respondToQuestion } = useAdminSupport();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!response.trim() || loading) return;

    try {
      setLoading(true);
      await respondToQuestion(question._id!.toString(), {
        response,
        createFaq,
        faqCategory: createFaq ? faqCategory : undefined,
        faqTags: createFaq ? faqTags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });

      setSubmitted(true);
      setTimeout(() => {
        setResponse('');
        setCreateFaq(false);
        setFaqCategory(FAQCategory.OTHER);
        setFaqTags('');
        setSubmitted(false);
        onResponseSubmitted();
      }, 1500);
    } catch (error) {
      console.error('Failed to submit response:', error);
      alert('Failed to submit response');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className='bg-green-50 border border-green-200 rounded-lg p-6 text-center'>
        <CheckCircle className='w-12 h-12 text-green-600 mx-auto mb-2' />
        <p className='text-green-900 font-medium'>Response submitted!</p>
        <p className='text-sm text-green-700 mt-1'>Learner has been notified</p>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-lg border border-gray-200 p-6 space-y-4'>
      <div>
        <p className='text-sm font-medium text-gray-700 mb-2'>Question</p>
        <div className='bg-gray-50 p-3 rounded text-sm text-gray-900 border border-gray-200'>
          {question.question}
        </div>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Your Response
          </label>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder='Type your response here...'
            disabled={loading}
            rows={6}
            className='w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
          />
          <p className='text-xs text-gray-500 mt-1'>{response.length}/5000</p>
        </div>

        <div className='border-t border-gray-200 pt-4 space-y-3'>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={createFaq}
              onChange={(e) => setCreateFaq(e.target.checked)}
              disabled={loading}
              className='w-4 h-4 rounded border-gray-300'
            />
            <span className='text-sm font-medium text-gray-700'>
              Add this response as a new FAQ
            </span>
          </label>

          {createFaq && (
            <div className='space-y-3 bg-blue-50 p-3 rounded border border-blue-200'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Category
                </label>
                <select
                  value={faqCategory}
                  onChange={(e) => setFaqCategory(e.target.value as FAQCategory)}
                  disabled={loading}
                  className='w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
                >
                  <option value={FAQCategory.LOGIN}>Login & Access</option>
                  <option value={FAQCategory.TECHNICAL}>Technical Issues</option>
                  <option value={FAQCategory.PROCTORING}>Proctoring</option>
                  <option value={FAQCategory.FEATURES}>Features</option>
                  <option value={FAQCategory.OTHER}>Other</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Tags (comma-separated)
                </label>
                <input
                  type='text'
                  value={faqTags}
                  onChange={(e) => setFaqTags(e.target.value)}
                  placeholder='e.g., video, playback, troubleshooting'
                  disabled={loading}
                  className='w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
                />
              </div>
            </div>
          )}
        </div>

        <button
          type='submit'
          disabled={loading || !response.trim()}
          className='w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
        >
          <Send className='w-4 h-4' />
          Submit Response
        </button>
      </form>
    </div>
  );
}
