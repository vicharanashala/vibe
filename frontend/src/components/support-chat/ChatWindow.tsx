import React, { useState, useEffect, useRef } from 'react';
import { Send, ThumbsUp, ThumbsDown, Loader } from 'lucide-react';
import MessageBubble, { type SupportChatMessage } from './MessageBubble';
import EscalationForm from './EscalationForm';
import useSupportChat from '@/hooks/useSupportChat';

interface ChatWindowProps {
  courseId?: string;
  courseVersionId?: string;
  cohortId?: string;
  onNewMessage?: () => void;
}

/**
 * One-tap starters for the most common issues. Each sends a question worded
 * like its FAQ, so it is answered from the FAQ bank directly.
 */
const QUICK_TOPICS: Array<{ label: string; question: string }> = [
  { label: 'Login & enrollment', question: 'How do I log in to ViBe?' },
  { label: 'Video stuck or repeating', question: 'Why are videos stuck or repeating?' },
  {
    label: 'Camera & proctoring',
    question: "Is the ViBe consent form compulsory? What if I don't want to grant camera access?",
  },
  {
    label: 'Progress not 100%',
    question: 'I have completed all videos and quizzes, but my progress is still showing less than 100%. What should I do?',
  },
];

export default function ChatWindow({
  courseId,
  courseVersionId,
  cohortId,
  onNewMessage,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ratedQuestionIds, setRatedQuestionIds] = useState<Set<string>>(new Set());
  // Answers the learner marked "Not helpful": they get the issue-report form.
  const [reportQuestionIds, setReportQuestionIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage, rateResolution } = useSupportChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Also on reportQuestionIds, so the issue form that "Not helpful" opens is
  // scrolled into view instead of appearing below the fold.
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, reportQuestionIds]);

  const sendQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    const userMessage: SupportChatMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      text: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    onNewMessage?.();

    try {
      const response = await sendMessage(question, courseId, courseVersionId, cohortId);

      const botMessage: SupportChatMessage = {
        id: `msg-${Date.now()}-bot`,
        type: 'bot',
        text: response.response,
        timestamp: new Date(),
        faqId: response.faqId,
        isFromFAQ: response.isFromFAQ,
        isAIGenerated: response.isAIGenerated,
        confidence: response.confidence,
        isEscalated: response.isEscalated,
        source: response.source,
        canRate: response.isFromFAQ || Boolean(response.isAIGenerated),
        questionId: response.questionId,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Support chat request failed:', error);
      const errorMessage: SupportChatMessage = {
        id: `msg-${Date.now()}-error`,
        type: 'bot',
        text: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  const handleRate = async (
    questionId: string | undefined,
    rating: 'helpful' | 'not_helpful'
  ) => {
    if (!questionId || ratedQuestionIds.has(questionId)) return;

    try {
      await rateResolution(questionId, rating);
      setRatedQuestionIds((prev) => new Set([...prev, questionId]));
      if (rating === 'not_helpful') {
        setReportQuestionIds((prev) => new Set([...prev, questionId]));
      }
    } catch (error) {
      console.error('Failed to rate resolution:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-rate-error`,
          type: 'bot',
          text: "Sorry, I couldn't save your feedback. Please try again.",
          timestamp: new Date(),
        },
      ]);
    }
  };

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='rounded-t-xl bg-primary px-4 py-3 text-primary-foreground'>
        <h3 className='text-sm font-semibold'>Support Assistant</h3>
        <p className='text-xs opacity-80'>Answers from ViBe's FAQs, with AI help</p>
      </div>

      {/* Messages Container */}
      <div className='flex-1 space-y-3 overflow-y-auto bg-background p-4'>
        {messages.length === 0 && (
          <div className='flex h-full flex-col items-center justify-center gap-4 text-center'>
            <div className='space-y-1'>
              <p className='text-sm font-medium text-foreground'>👋 Hi! How can I help?</p>
              <p className='text-xs text-muted-foreground'>
                Pick a common issue or type your own question, in English or Hinglish.
              </p>
            </div>
            <div className='flex flex-wrap justify-center gap-2'>
              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic.label}
                  type='button'
                  onClick={() => void sendQuestion(topic.question)}
                  className='rounded-full border border-border bg-card px-3 py-1.5 text-xs text-card-foreground transition-colors hover:border-primary hover:text-primary'
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className='space-y-2'>
            <MessageBubble message={msg} />

            {msg.canRate && msg.questionId && !ratedQuestionIds.has(msg.questionId) && (
              <div className='ml-2 flex gap-2'>
                <button
                  onClick={() => handleRate(msg.questionId, 'helpful')}
                  className='inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-green-500 hover:text-green-600'
                >
                  <ThumbsUp className='h-3 w-3' />
                  Helpful
                </button>
                <button
                  onClick={() => handleRate(msg.questionId, 'not_helpful')}
                  className='inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive'
                >
                  <ThumbsDown className='h-3 w-3' />
                  Not helpful
                </button>
              </div>
            )}

            {msg.questionId && (msg.isEscalated || reportQuestionIds.has(msg.questionId)) && (
              <EscalationForm
                questionId={msg.questionId}
                page={window.location.pathname}
                notice={
                  msg.isEscalated
                    ? undefined
                    : "Sorry that didn't help. Tell the support team what's going on."
                }
              />
            )}
          </div>
        ))}

        {loading && (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Loader className='h-4 w-4 animate-spin text-primary' />
            Looking for an answer…
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className='rounded-b-xl border-t border-border bg-card p-3'
      >
        <div className='flex gap-2'>
          <input
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Type your question...'
            disabled={loading}
            maxLength={1000}
            className='flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'
          />
          <button
            type='submit'
            disabled={loading || !input.trim()}
            aria-label='Send question'
            className='rounded-md bg-primary px-3 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
          >
            <Send className='h-4 w-4' />
          </button>
        </div>
      </form>
    </div>
  );
}
