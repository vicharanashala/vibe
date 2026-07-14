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
  cohortId?: string;
}
const ItemContainer = forwardRef<ItemContainerRef, ItemContainerProps>(({ item, nextItem, doGesture, onNext, onPrevVideo, isProgressUpdating, isNavigatingToPrev, readyToDetect, attemptId, anomalies, setQuizPassed, setAttemptId, rewindVid, pauseVid, displayNextLesson, keyboardLockEnabled, setIsQuizSkipped, linearProgressionEnabled, seekForwardEnabled, courseId, versionId, completedItemIdsRef, cohortId, cohortName, previousItem, pendingStudentQuestionContext, clearPendingStudentQuestionContext, focusMode }, ref) => {
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
    },
    getCurrentDetails: () => {
      if (quizRef.current?.getCurrentDetails) {
        return quizRef.current.getCurrentDetails();
      }
      return {};
    }
  }));
  // Defensive: item might be undefined or _id might be missing during race conditions.
  const safeItemId = ((): string => {
    try {
      if (!item) return '';
      const raw = (item as any)._id ?? (item as any).id ?? (item as any).itemId;
      if (raw == null) return '';
      return typeof raw === 'string' ? raw : (raw.toString ? raw.toString() : String(raw));
    } catch {
      return '';
    }
  })();
  const submitFeedback = useSubmitFeedback(safeItemId)

  const handleFeedbackSubmit = async (formData: any) => {


  };

  const renderContent = () => {
    if (!item) {
      // Defensive: don't crash if item hasn't loaded yet
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading item…</p>
        </div>
      );
    }
    const itemType = ((item as any)?.type || 'unknown').toString().toLowerCase();
    const itemKey = safeItemId || (item as any)?.name || 'unknown-item';
    switch (itemType) {
      case 'video':
        return <Video
          key={itemKey}
          URL={item.details?.URL ? item.details.URL : ''}
          startTime={item.details?.startTime ? item.details.startTime : ''}
          endTime={item.details?.endTime ? item.details.endTime : ''}
          points={item.details?.points ? item.details.points : ''}
          doGesture={doGesture}
          onNext={onNext}
          keyboardLockEnabled={keyboardLockEnabled}
          focusMode={focusMode}
          isProgressUpdating={isProgressUpdating}
          rewindVid={rewindVid || false}
          pauseVid={pauseVid || false}
          readyToDetect={readyToDetect}
          anomalies={anomalies}
          linearProgressionEnabled={linearProgressionEnabled}
          seekForwardEnabled={seekForwardEnabled}
          isCompleted={item.isCompleted || false}
          isAlreadyWatched = {item.isAlreadyWatched || false}
          completedItemIdsRef={completedItemIdsRef}
          nextItemId={nextItem?.itemId?.toString()}
          cohortId={cohortId}
          cohortName={cohortName}
        />;

      case 'quiz':
        return <Quiz
          key={itemKey}
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
          isNavigatingToPrev={isNavigatingToPrev}
          attemptId={attemptId}
          setAttemptId={setAttemptId}
          displayNextLesson={displayNextLesson}
          setQuizPassed={setQuizPassed}
          rewindVid={rewindVid}
          setIsQuizSkipped={setIsQuizSkipped}
          linearProgressionEnabled={linearProgressionEnabled}
          isAlreadyWatched={item.isAlreadyWatched || false}
          completedItemIdsRef={completedItemIdsRef}
          nextItemId={nextItem?.itemId?.toString()}
          pendingStudentQuestionContext={pendingStudentQuestionContext}
          clearPendingStudentQuestionContext={clearPendingStudentQuestionContext}
        />;

      case 'article':
      case 'blog':
        return <Article
          key={itemKey}
          ref={articleRef}
          content={item.details?.content || ''}
          estimatedReadTimeInMinutes={item.details?.estimatedReadTimeInMinutes || ''}
          tags={item.details?.tags || []}
          points={item.details?.points || ''}
          onNext={onNext}
          isProgressUpdating={isProgressUpdating}
          isAlreadyWatched={item.isAlreadyWatched || false}
          completedItemIdsRef={completedItemIdsRef}
        />;

      case 'project':
        return <ProjectItem
          key={itemKey}
          item={{
            _id: item._id,
            name: item.name,
            type: 'PROJECT',
            description: item.details?.description || item.description || ''
          }}
          onSave={() => { }} // Not used in student view
          onCancel={() => { }} // Not used in student view
          isInstructor={false}
          onNext={onNext}
          isProgressUpdating={isProgressUpdating}
        />;
      case 'feedback':
        return <FeedbackForm
          key={itemKey}
          title={item.name}
          description={item.description}
          isOptional={item.isOptional}
          jsonSchema={item?.details?.jsonSchema}
          uiSchema={item?.details?.uiSchema}
          onSubmit={handleFeedbackSubmit}
          isSubmitting={isProgressUpdating}
          onNext={onNext}
          isAlreadyWatched={item.isAlreadyWatched || false}
          completedItemIdsRef={completedItemIdsRef}
          previousItem = {previousItem}
        />;

      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Unsupported item type: {(item as any)?.type || 'unknown'}</p>
          </div>
        );
    }
  };

  // Outer wrapper: also guard against undefined item (e.g., race during navigation)
  const itemTypeOuter = ((item as any)?.type || 'unknown').toString().toLowerCase();
  const outerClass = `${itemTypeOuter === 'video' ? (focusMode ? 'fixed inset-0 z-40 bg-background h-screen' : 'h-[85vh]') : 'h-full'} w-full overflow-auto`;

  return (
    <div className={outerClass}>
      {renderContent()}
    </div>
  );
});

ItemContainer.displayName = 'ItemContainer';

export default ItemContainer;