import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatWindow from './ChatWindow';

interface ChatWidgetProps {
  courseId?: string;
  courseVersionId?: string;
  cohortId?: string;
}

export default function ChatWidget({
  courseId,
  courseVersionId,
  cohortId,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNewMessage = () => {
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  return (
    <div
      ref={containerRef}
      className='fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3'
    >
      {isOpen && (
        <div className='flex h-[32rem] max-h-[calc(100vh-6rem)] w-96 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-card shadow-2xl'>
          <ChatWindow
            courseId={courseId}
            courseVersionId={courseVersionId}
            cohortId={cohortId}
            onNewMessage={handleNewMessage}
          />
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className='relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90'
        aria-label='Open support chat'
        title='Support Chat'
      >
        {isOpen ? (
          <X className='w-6 h-6' />
        ) : (
          <>
            <MessageCircle className='w-6 h-6' />
            {unreadCount > 0 && (
              <span className='absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center'>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
