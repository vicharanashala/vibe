import type { questionBankRef } from './quiz.types';
import type { PendingStudentQuestionContext } from './student-question.types';
import type { VideoSource } from './media.types';

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
    /**
     * Where the video comes from. Absent means YOUTUBE — every item created
     * before uploads existed has no source. Read it via resolveVideoSource.
     */
    source?: VideoSource;
    /** The uploaded video this item plays. Set only when source is GCS. */
    assetId?: string;

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

    // For Reflection
    prompt?: string;
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
  /** Increment to pause the video without showing the anomaly overlay (focused learn UI). */
  pauseSignal?: number;
  /** Sustained away-pause (cursor left page); auto-resumes on return if it was playing. */
  awayPaused?: boolean;
  displayNextLesson?: boolean;
  setQuizPassed?: (passed: number) => void; // Function to update quizPassed
  anomalies?: string[];
  readyToDetect: boolean;
  keyboardLockEnabled?: boolean;
  focusMode?: boolean;
  setIsQuizSkipped: React.Dispatch<React.SetStateAction<boolean>>;
  linearProgressionEnabled: boolean;
  seekForwardEnabled: boolean;
  isLensEnabled?: boolean;
  courseId: string;
  versionId: string;
  completedItemIdsRef: React.RefObject<Set<string>>;
  nextItem: {itemId:string};
  cohortId?: string;
  cohortname?: string;
  previousItem?: object;
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
