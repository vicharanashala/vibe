import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

export interface SupportChatMessage {
  id: string;
  type: 'user' | 'bot';
  text: string;
  timestamp: Date;
  faqId?: string;
  isFromFAQ?: boolean;
  isAIGenerated?: boolean;
  confidence?: number;
  isEscalated?: boolean;
  source?: string;
  canRate?: boolean;
  questionId?: string;
}

interface MessageBubbleProps {
  message: SupportChatMessage;
}

/**
 * FAQ answers are written with numbered steps, "- " bullets and bare URLs on
 * their own lines. Rendering them as Markdown keeps that structure (instead of
 * one run-on paragraph) and turns URLs into links. Raw HTML is never rendered.
 */
const markdownComponents: Components = {
  p: ({ children }) => <p className='mb-2 last:mb-0'>{children}</p>,
  ol: ({ children }) => <ol className='mb-2 list-decimal space-y-1 pl-5 last:mb-0'>{children}</ol>,
  ul: ({ children }) => <ul className='mb-2 list-disc space-y-1 pl-5 last:mb-0'>{children}</ul>,
  li: ({ children }) => <li className='pl-0.5'>{children}</li>,
  strong: ({ children }) => <strong className='font-semibold'>{children}</strong>,
  code: ({ children }) => (
    <code className='rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]'>{children}</code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className='break-all font-medium text-primary underline underline-offset-2 hover:opacity-80'
    >
      {children}
    </a>
  ),
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm border border-border bg-card text-card-foreground'
        }`}
      >
        {isUser ? (
          <p className='whitespace-pre-wrap break-words'>{message.text}</p>
        ) : (
          <div className='break-words'>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.text}
            </ReactMarkdown>
          </div>
        )}

        <div className='mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs'>
          {!isUser && message.isFromFAQ && (
            <span className='inline-flex items-center gap-1 text-muted-foreground'>
              <CheckCircle className='h-3 w-3 text-green-600 dark:text-green-500' />
              From FAQ
            </span>
          )}

          {!isUser && message.isAIGenerated && (
            <span
              className='inline-flex items-center gap-1 text-muted-foreground'
              title='Written by AI using only the ViBe FAQs. It can make mistakes.'
            >
              <Sparkles className='h-3 w-3 text-primary' />
              AI answer
            </span>
          )}

          {!isUser && message.isEscalated && (
            <span className='inline-flex items-center gap-1 text-muted-foreground'>
              <AlertCircle className='h-3 w-3 text-primary' />
              Escalated to support
            </span>
          )}

          {!isUser && message.source && (
            <span className='italic text-muted-foreground/80'>{message.source}</span>
          )}

          {isUser && (
            <span className='opacity-70'>
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
