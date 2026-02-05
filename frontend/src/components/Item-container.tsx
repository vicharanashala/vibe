import { forwardRef, useImperativeHandle, useRef } from 'react';
import Video from './video';
import Quiz from './quiz';
import Article from './article';
import ProjectItem from '../app/pages/teacher/components/ProjectItem';
import type { ArticleRef } from "@/types/article.types";
import type { QuizRef } from "@/types/quiz.types";
import type { ItemContainerProps, ItemContainerRef } from '@/types/item-container.types';
import FeedbackForm from '@/app/pages/student/components/FeedbackForm';
import { useSubmitFeedback } from '@/hooks/hooks';

export interface ISubmitFeedbackBody {
  details: Record<string, any>;
  courseId: string;
  courseVersionId: string;
  // isSkipped?: boolean;
}
const ItemContainer = forwardRef<ItemContainerRef, ItemContainerProps>(({ item, doGesture, onNext, onPrevVideo, isProgressUpdating,readyToDetect, attemptId, anomalies, setQuizPassed, setAttemptId, rewindVid, pauseVid, displayNextLesson,keyboardLockEnabled,setIsQuizSkipped, linearProgressionEnabled, seekForwardEnabled, courseId,versionId}, ref) => {
  const articleRef = useRef<ArticleRef>(null);
  const quizRef = useRef<QuizRef>(null);

  // ✅ Expose stop function to parent - handles both article and quiz
  useImperativeHandle(ref, () => ({
    stopCurrentItem: async () => {
      if (articleRef.current) {
        await articleRef.current.stopItem();
      } else if (quizRef.current) {
        await quizRef.current.stopItem();
      }
    }
  }));
  const submitFeedback = useSubmitFeedback(item._id.toString())
  
   const handleFeedbackSubmit = async (formData: any) => {

    
  };

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
          keyboardLockEnabled={keyboardLockEnabled}
          isProgressUpdating={isProgressUpdating}
          rewindVid={rewindVid || false}
          pauseVid={pauseVid || false}
          readyToDetect={readyToDetect}
          anomalies={anomalies}
          linearProgressionEnabled={linearProgressionEnabled}
          seekForwardEnabled={seekForwardEnabled}
          isCompleted={item.isCompleted || false}
        />;

      case 'quiz':
        return <Quiz
          ref={quizRef}
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
          allowSkip={item.details?.allowSkip || false}
          showCorrectAnswersAfterSubmission={item.details?.showCorrectAnswersAfterSubmission || false}
          showExplanationAfterSubmission={item.details?.showExplanationAfterSubmission || false}
          showScoreAfterSubmission={item.details?.showScoreAfterSubmission || false}
          quizId={item._id || ''}
          doGesture={doGesture}
          onNext={onNext}
          onPrevVideo={onPrevVideo}
          isProgressUpdating={isProgressUpdating}
          attemptId={attemptId}
          setAttemptId={setAttemptId}
          displayNextLesson={displayNextLesson}
          setQuizPassed={setQuizPassed}
          rewindVid={rewindVid}
          setIsQuizSkipped = {setIsQuizSkipped}
          linearProgressionEnabled={linearProgressionEnabled}
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

      case 'project':
        return <ProjectItem
          item={{
            _id: item._id,
            name: item.name,
            type: 'PROJECT',
            description: item.details?.description || item.description || ''
          }}
          onSave={() => {}} // Not used in student view
          onCancel={() => {}} // Not used in student view
          isInstructor={false}
          onNext={onNext}
          isProgressUpdating={isProgressUpdating}
        />;
      case 'feedback':
        return <FeedbackForm
        title={item.name}
        description={item.description}
        isOptional={item.isOptional}
        jsonSchema={item?.details?.jsonSchema}
        uiSchema={item?.details?.uiSchema}
        onSubmit={handleFeedbackSubmit}
        isSubmitting={isProgressUpdating}
        onNext={onNext}
        />

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