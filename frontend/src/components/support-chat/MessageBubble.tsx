import { CheckCircle, AlertCircle } from 'lucide-react';

interface MessageBubbleProps {
  message: {
    type: 'user' | 'bot';
    text: string;
    timestamp: Date;
    isFromFAQ?: boolean;
    confidence?: number;
    isEscalated?: boolean;
    source?: string;
  };
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
        }`}
      >
        <p className='text-sm break-words'>{message.text}</p>

        <div className='flex items-center gap-1 mt-1 text-xs'>
          {!isUser && message.isFromFAQ && (
            <div className='flex items-center gap-1'>
              <CheckCircle className='w-3 h-3 text-green-600' />
              <span className='text-gray-500'>From FAQ</span>
            </div>
          )}

          {!isUser && message.isEscalated && (
            <div className='flex items-center gap-1'>
              <AlertCircle className='w-3 h-3 text-blue-600' />
              <span className='text-gray-500'>Escalated to support</span>
            </div>
          )}

          {!isUser && message.source && (
            <span className='text-gray-400 text-xs italic'>{message.source}</span>
          )}

          {isUser && (
            <span className='text-gray-300 text-xs'>
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
