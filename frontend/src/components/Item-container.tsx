import React from 'react';
import Video from './video';
import Quiz from './quiz';
import Article from './article';

export interface Item {
  itemId: string;
  name: string;
  description?: string;
  type: string;
  order?: string;
  itemDetails?: {
    URL?: string;
    startTime?: string;
    endTime?: string;
    points?: string;
    tags?: string[];
    content?: string;
    estimatedReadTimeInMinutes?: string;
  };
  quizDetails?: any;
  blogDetails?: {
    content?: string;
  };
}

interface ItemContainerProps {
  item: Item;
}

const ItemContainer: React.FC<ItemContainerProps> = ({ item }) => {
  const renderContent = () => {
    const itemType = item.type.toLowerCase();

    switch (itemType) {
      case 'video':
        return <Video 
          URL={item.itemDetails?.URL ? item.itemDetails.URL : ''}
          startTime={item.itemDetails?.startTime? item.itemDetails.startTime : ''}
          endTime={item.itemDetails?.endTime? item.itemDetails.endTime : ''}
          points={item.itemDetails?.points? item.itemDetails.points : ''}
        />;

      case 'quiz':
        const quizContent = item.quizDetails ? JSON.stringify(item.quizDetails) : '';
        return <Quiz content={quizContent} />;

      case 'article':
      case 'blog':
        return <Article 
          content={item.blogDetails?.content || item.itemDetails?.content || ''}
          estimatedReadTimeInMinutes={item.itemDetails?.estimatedReadTimeInMinutes || ''}
          tags={item.itemDetails?.tags || []}
          points={item.itemDetails?.points || ''}
        />;

      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Unsupported item type: {item.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full overflow-auto">
      {renderContent()}
    </div>
  );
};

export default ItemContainer;
