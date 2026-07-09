import { forwardRef, useImperativeHandle, useRef } from 'react';
import Video from './video';
import Quiz from './quiz';
import Article from './article';
import ProjectItem from '../app/pages/teacher/components/ProjectItem';
import type { ArticleRef } from "@/types/article.types";
import type { QuizRef } from "@/types/quiz.types";
import type { ItemContainerProps, ItemContainerRef } from '@/types/item-container.types';
import FeedbackForm from '@/app/pages/student/components/FeedbackForm';
import { useSubmitFeedback, useGetPeerReviewAssessment } from '@/hooks/hooks';
import { PeerReviewSubmissionForm } from '@/app/pages/student/peer-review/PeerReviewSubmissionForm';

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
  const submitFeedback = useSubmitFeedback(item._id.toString())

  const handleFeedbackSubmit = async (formData: any) => {


  };

  const renderContent = () => {
    const itemType = item.type.toLowerCase();
    switch (itemType) {
      case 'video':
        return <Video
          key={item._id.toString()}
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
          key={item._id.toString()}
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
          key={item._id.toString()}
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
          key={item._id.toString()}
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
          key={item._id.toString()}
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

      case 'peer_review_assessment': {
        // Student-side rendering of a peer-review assessment item. The Item
        // record itself only carries a slim details blob (assessmentId,
        // rubric summary, deadlines) — the full assessment doc (rubric,
        // instructor attachments, cohort) lives in `peer_review_assessments`
        // and is fetched on demand via useGetPeerReviewAssessment. We
        // forward both courseId/versionId/itemId so the form's submission
        // POST has everything it needs.
        const assessmentId = (item as any)?.details?.assessmentId as
          | string
          | undefined;
        const submissionDeadlineStr = (item as any)?.details
          ?.submissionDeadline as string | undefined;
        return (
          <PeerReviewItemBody
            key={item._id.toString()}
            courseId={courseId}
            versionId={versionId}
            itemId={item._id.toString()}
            assessmentId={assessmentId}
            submissionDeadlineStr={submissionDeadlineStr}
            onNext={onNext}
          />
        );
      }

      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Unsupported item type: {item.type}</p>
          </div>
        );
    }
  };

  return (
    <div className={`${item.type.toLowerCase()==="video" ? (focusMode ? "fixed inset-0 z-40 bg-background h-screen" : "h-[85vh]") : "h-full" } w-full overflow-auto`}>
      {renderContent()}
    </div>
  );
});

ItemContainer.displayName = 'ItemContainer';

/**
 * Body for the `peer_review_assessment` case. Keeps the JSX out of the
 * giant renderContent switch so the switch stays readable. Loads the
 * full assessment doc, then renders PeerReviewSubmissionForm with
 * everything the form needs.
 */
function PeerReviewItemBody({
  courseId,
  versionId,
  itemId,
  assessmentId,
  submissionDeadlineStr,
  onNext,
}: {
  courseId: string;
  versionId: string;
  itemId: string;
  assessmentId?: string;
  submissionDeadlineStr?: string;
  onNext?: () => void;
}) {
  const { data: assessment, isLoading, error } = useGetPeerReviewAssessment(assessmentId);

  if (!assessmentId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        This peer-review assessment has not been linked to an item yet.
        Please contact your teacher.
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading peer-review assessment…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        Failed to load peer-review assessment: {error}
      </div>
    );
  }
  return (
    <PeerReviewSubmissionForm
      courseId={courseId}
      versionId={versionId}
      itemId={itemId}
      assessment={assessment}
      submissionDeadline={
        submissionDeadlineStr ? new Date(submissionDeadlineStr) : undefined
      }
    />
  );
}

export default ItemContainer;