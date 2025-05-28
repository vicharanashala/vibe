import React from 'react';
import Video from './video';
import Quiz from './quiz';
import Article from './article';
import { useUpdateCourseProgress } from '../lib/api/hooks';

export interface Item {
  name: string;
  itemtype: 'video' | 'quiz' | 'article';
  content: string;
}

interface ItemContainerProps {
  item: Item;
  userId: string;
  courseId: string;
  courseVersionId: string;
}

const ItemContainer: React.FC<ItemContainerProps> = ({ item, userId, courseId, courseVersionId }) => {
  const updateProgress = useUpdateCourseProgress();

  const handleNext = () => {
    updateProgress.mutate({
      params: {
        path: {
          userId,
          courseId,
          courseVersionId
        }
      }
    });
  };

  const renderContent = () => {
    switch (item.itemtype) {
      case 'video':
        return <Video youtubeUrl={item.content} />;
      case 'quiz':
        return <Quiz content={item.content} />;
      case 'article':
        return <Article content={item.content} />;
      default:
        return <div>Unsupported item type</div>;
    }
  };

  return (
    <div className="item-container">
      <h2 className="item-title">{item.name}</h2>
      <div className="item-content">
        {renderContent()}
      </div>
      <button 
        className="next-button" 
        onClick={handleNext}
        disabled={updateProgress.isPending}
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          backgroundColor: '#FFA500',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          zIndex: 1000
        }}
      >
        {updateProgress.isPending ? 'Loading...' : 'Next'}
      </button>
    </div>
  );
};

export default ItemContainer;
