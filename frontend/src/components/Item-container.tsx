import { forwardRef, useImperativeHandle, useRef } from 'react';
import Video from './video';
import Quiz, { questionBankRef } from './quiz';
import Article, { ArticleRef } from './article';

export interface Item {
  _id: string;
  name: string;
  description?: string;
  type: string;
  order?: string;
  details?: {
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
    questionBankRefs?: questionBankRef[];
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
  onNext: () => void;
  isProgressUpdating: boolean;
  attemptId?: string;
  setAttemptId?: (attemptId: string) => void;
}

export interface ItemContainerRef {
  stopCurrentItem: () => void;
}

const ItemContainer = forwardRef<ItemContainerRef, ItemContainerProps>(({ item, doGesture, onNext, isProgressUpdating, attemptId, setAttemptId}, ref) => {
  const articleRef = useRef<ArticleRef>(null);

  // ✅ Expose stop function to parent
  useImperativeHandle(ref, () => ({
    stopCurrentItem: () => {
      if (articleRef.current) {
        articleRef.current.stopItem();
      }
    }
  }));

  const renderContent = () => {
    const itemType = item.type.toLowerCase();

    switch (itemType) {
      case 'video':
        return <Video
          URL={item.details?.URL ? item.details.URL : ''}
          startTime={item.details?.startTime ? item.details.startTime : ''}
          endTime={item.details?.endTime ? item.details.endTime : ''}
          points={item.details?.points ? item.details.points : ''}
          doGesture={doGesture}
          onNext={onNext}
          isProgressUpdating={isProgressUpdating}
        />;

      case 'quiz':
        return <Quiz
          questionBankRefs={item.details?.questionBankRefs || []}
          passThreshold={item.details?.passThreshold || 0}
          maxAttempts={item.details?.maxAttempts || 1}
          quizType={item.details?.quizType || ''}
          releaseTime={item.details?.releaseTime}
          questionVisibility={item.details?.questionVisibility || 0}
          deadline={item.details?.deadline}
          approximateTimeToComplete={item.details?.approximateTimeToComplete || ''}
          allowPartialGrading={item.details?.allowPartialGrading || false}
          allowHint={item.details?.allowHint || false}
          showCorrectAnswersAfterSubmission={item.details?.showCorrectAnswersAfterSubmission || false}
          showExplanationAfterSubmission={item.details?.showExplanationAfterSubmission || false}
          showScoreAfterSubmission={item.details?.showScoreAfterSubmission || false}
          quizId={item._id || ''}
          doGesture={doGesture}
          onNext={onNext}
          isProgressUpdating={isProgressUpdating}
          attemptId={attemptId}
          setAttemptId={setAttemptId}
        />;

      case 'article':
      case 'blog':
        return <Article
          ref={articleRef}
          content={item.details?.content || ''}
          estimatedReadTimeInMinutes={item.details?.estimatedReadTimeInMinutes || ''}
          tags={item.details?.tags || []}
          points={item.details?.points || ''}
          onNext={onNext}
          isProgressUpdating={isProgressUpdating}
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
});

ItemContainer.displayName = 'ItemContainer';

export default ItemContainer;