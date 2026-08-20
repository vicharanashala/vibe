import React, { useState, useEffect, useRef } from 'react';
import { Send, ThumbsUp, ThumbsDown, Loader } from 'lucide-react';
import MessageBubble from './MessageBubble';
import EscalationForm from './EscalationForm';
import useSupportChat from '@/hooks/useSupportChat';

interface ChatWindowProps {
  courseId?: string;
  courseVersionId?: string;
  cohortId?: string;
  onNewMessage?: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  text: string;
  timestamp: Date;
  faqId?: string;
  isFromFAQ?: boolean;
  confidence?: number;
  isEscalated?: boolean;
  source?: string;
  canRate?: boolean;
  questionId?: string;
}

export default function ChatWindow({
  courseId,
  courseVersionId,
  cohortId,
  onNewMessage,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ratedQuestionIds, setRatedQuestionIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage, rateResolution } = useSupportChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load chat history on mount
    const loadHistory = async () => {
      // TODO: Implement history loading from API
    };
    loadHistory();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    onNewMessage?.();

    try {
      const response = await sendMessage(
        input,
        courseId,
        courseVersionId,
        cohortId
      );

      const botMessage: Message = {
        id: `msg-${Date.now()}-bot`,
        type: 'bot',
        text: response.response,
        timestamp: new Date(),
        faqId: response.faqId,
        isFromFAQ: response.isFromFAQ,
        confidence: response.confidence,
        isEscalated: response.isEscalated,
        source: response.source,
        canRate: response.isFromFAQ,
        questionId: response.questionId,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
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

  const handleRate = async (
    questionId: string | undefined,
    rating: 'helpful' | 'not_helpful'
  ) => {
    if (!questionId || ratedQuestionIds.has(questionId)) return;

    try {
      await rateResolution(questionId, rating);
      setRatedQuestionIds((prev) => new Set([...prev, questionId]));
    } catch (error) {
      console.error('Failed to rate resolution:', error);
    }
  };

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='bg-blue-600 text-white px-4 py-3 rounded-t-lg'>
        <h3 className='font-semibold text-sm'>Support Assistant</h3>
        <p className='text-xs opacity-90'>Ask about technical issues</p>
      </div>

      {/* Messages Container */}
      <div className='flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50'>
        {messages.length === 0 && (
          <div className='h-full flex items-center justify-center text-center'>
            <div className='space-y-2'>
              <p className='text-sm text-gray-600'>
                👋 Welcome! Ask me anything about:
              </p>
              <ul className='text-xs text-gray-500 space-y-1'>
                <li>• Login & enrollment issues</li>
                <li>• Video playback problems</li>
                <li>• Proctoring requirements</li>
                <li>• Course navigation</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className='space-y-2'>
            <MessageBubble message={msg} />

            {msg.canRate && msg.questionId && !ratedQuestionIds.has(msg.questionId) && (
              <div className='flex gap-2 ml-8 mt-2'>
                <button
                  onClick={() => handleRate(msg.questionId, 'helpful')}
                  className='inline-flex items-center gap-1 text-xs bg-white border border-gray-300 rounded px-2 py-1 hover:bg-green-50 hover:border-green-400 text-gray-600'
                >
                  <ThumbsUp className='w-3 h-3' />
                  Helpful
                </button>
                <button
                  onClick={() => handleRate(msg.questionId, 'not_helpful')}
                  className='inline-flex items-center gap-1 text-xs bg-white border border-gray-300 rounded px-2 py-1 hover:bg-red-50 hover:border-red-400 text-gray-600'
                >
                  <ThumbsDown className='w-3 h-3' />
                  Not helpful
                </button>
              </div>
            )}

            {msg.isEscalated && msg.questionId && (
              <EscalationForm questionId={msg.questionId} page={window.location.pathname} />
            )}
          </div>
        ))}

        {loading && (
          <div className='flex gap-2'>
            <div className='w-8 h-8 rounded-lg bg-gray-300 flex items-center justify-center'>
              <Loader className='w-4 h-4 animate-spin text-gray-600' />
            </div>
            <div className='text-xs text-gray-500 self-center'>Searching for answer...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className='border-t border-gray-200 p-3 bg-white rounded-b-lg'
      >
        <div className='flex gap-2'>
          <input
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Type your question...'
            disabled={loading}
            className='flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
          />
          <button
            type='submit'
            disabled={loading || !input.trim()}
            className='px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          >
            <Send className='w-4 h-4' />
          </button>
        </div>
      </form>
    </div>
  );
}
