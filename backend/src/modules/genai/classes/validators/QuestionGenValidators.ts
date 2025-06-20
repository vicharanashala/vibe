// TypeScript interfaces
interface GlobalQuestionSpec {
  SOL?: number;
  SML?: number;
  OTL?: number;
  NAT?: number;
  DES?: number;
}

interface TranscriptSegment {
  end_time: string;
  transcript_lines: string[];
}

interface CleanedSegment {
  end_time: string;
  transcript_lines: string;
}

interface QuestionSchema {
  type: string;
  properties: Record<string, any>;
  required: string[];
}

interface GeneratedQuestion {
  segmentId?: string;
  questionType?: string;
  question: {
    text: string;
    type: string;
    isParameterized: boolean;
    parameters?: any[];
    hint?: string;
    timeLimitSeconds: number;
    points: number;
  };
  solution: any;
}
export {
  QuestionSchema,
  GlobalQuestionSpec, 
  TranscriptSegment,
  CleanedSegment,
  GeneratedQuestion,
};
