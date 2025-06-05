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
    points?: string;

    // For Video
    URL?: string;
    startTime?: string;
    endTime?: string;

    // For Article or Blog
    tags?: string[];
    content?: string;
    estimatedReadTimeInMinutes?: string;

    // For Quiz
    questionBankRefs?: string[];
    passThreshold?: number;
    maxAttempts?: number;
    quizType?: 'DEADLINE' | 'NO_DEADLINE';
    releaseTime?: Date;
    questionVisibility?: number;
    deadline?: Date;
    approximateTimeToComplete?: string;
    allowPartialGrading?: boolean;
    allowHint?: boolean;
    showCorrectAnswersAfterSubmission?: boolean;
    showExplanationAfterSubmission?: boolean;
    showScoreAfterSubmission?: boolean;
    quizId?: string;
  };
}

interface ItemContainerProps {
  item: Item;
  doGesture: boolean;
}

const ItemContainer: React.FC<ItemContainerProps> = ({ item, doGesture}) => {
  const renderContent = () => {
    const itemType = item.type.toLowerCase();

    switch (itemType) {
      case 'video':
        return <Video
          URL={item.itemDetails?.URL ? item.itemDetails.URL : ''}
          startTime={item.itemDetails?.startTime ? item.itemDetails.startTime : ''}
          endTime={item.itemDetails?.endTime ? item.itemDetails.endTime : ''}
          points={item.itemDetails?.points ? item.itemDetails.points : ''}
          doGesture={doGesture}
        />;

      case 'quiz':
        return <Quiz
          questionBankRefs={item.itemDetails?.questionBankRefs || []}
          passThreshold={item.itemDetails?.passThreshold || 0}
          maxAttempts={item.itemDetails?.maxAttempts || 1}
          quizType={item.itemDetails?.quizType || ''}
          releaseTime={item.itemDetails?.releaseTime}
          questionVisibility={item.itemDetails?.questionVisibility || 0}
          deadline={item.itemDetails?.deadline}
          approximateTimeToComplete={item.itemDetails?.approximateTimeToComplete || ''}
          allowPartialGrading={item.itemDetails?.allowPartialGrading || false}
          allowHint={item.itemDetails?.allowHint || false}
          showCorrectAnswersAfterSubmission={item.itemDetails?.showCorrectAnswersAfterSubmission || false}
          showExplanationAfterSubmission={item.itemDetails?.showExplanationAfterSubmission || false}
          showScoreAfterSubmission={item.itemDetails?.showScoreAfterSubmission || false}
          quizId={item.itemId || ''}
          doGesture={doGesture}
        />;

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
