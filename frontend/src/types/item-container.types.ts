import type { questionBankRef } from './quiz.types';
import type { PendingStudentQuestionContext } from './student-question.types';

export interface Item {
  _id: string;
  name: string;
  description?: string;
  type: string;
  order?: string;
  isCompleted?: boolean;
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
    allowSkip?: boolean;
    showCorrectAnswersAfterSubmission?: boolean;
    showExplanationAfterSubmission?: boolean;
    showScoreAfterSubmission?: boolean;
    quizId?: string;

    // For Project
    title?: string;
    description?: string;
  };
  isAlreadyWatched?: boolean;
}

export interface ItemContainerProps {

  item: Item;
  doGesture: boolean;
  onNext: () => void;
  onPrevVideo?: () => void;
  isProgressUpdating: boolean;
  isNavigatingToPrev?: boolean;
  attemptId?: string;
  setAttemptId?: (attemptId: string) => void;
  rewindVid?: boolean;
  pauseVid?: boolean;
  displayNextLesson?: boolean;
  setQuizPassed?: (passed: number) => void; // Function to update quizPassed
  anomalies?: string[];
  readyToDetect: boolean;
  keyboardLockEnabled?: boolean;
  setIsQuizSkipped: React.Dispatch<React.SetStateAction<boolean>>;
  linearProgressionEnabled: boolean;
  seekForwardEnabled: boolean;
  courseId: string;
  versionId: string;
  completedItemIdsRef: React.RefObject<Set<string>>;
  nextItem: {
    itemId?: string | null;
    type?: string | null;
    needsLoading?: boolean;
  } | null;
  cohortId?: string;
  cohortName?: string;
  crowdsourcedQuestionSubmissionEnabled?: boolean;
  pendingStudentQuestionContext?: PendingStudentQuestionContext | null;
  clearPendingStudentQuestionContext?: () => void;
}

export interface ItemContainerRef {
  stopCurrentItem: () => Promise<void>;
  getCurrentDetails?: () => { questionId?: string };
}

export type ItemMeta = {
  itemId: string,
  courseId: string,
  courseVersionId: string,
}
