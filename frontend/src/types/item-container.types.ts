import type { questionBankRef } from './quiz.types';

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
    allowSkip?: boolean;
    showCorrectAnswersAfterSubmission?: boolean;
    showExplanationAfterSubmission?: boolean;
    showScoreAfterSubmission?: boolean;
    quizId?: string;

    // For Project
    title?: string;
    description?: string;
  };
}

export interface ItemContainerProps {

  item: Item;
  nextItem: Item;
  doGesture: boolean;
  onNext: () => void;
  onPrevVideo?: () => void;
  isProgressUpdating: boolean;
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
  courseId:string;
  versionId:string
}

export interface ItemContainerRef {
  stopCurrentItem: () => Promise<void>;
}

export type ItemMeta = {
  itemId: string,
  courseId: string,
  courseVersionId: string,
}
