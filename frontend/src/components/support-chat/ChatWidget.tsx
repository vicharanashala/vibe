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
        <div className='w-96 h-96 bg-white rounded-lg shadow-2xl flex flex-col border border-gray-200'>
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
        className='relative w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center'
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
