import { components } from "./schema";

export interface itemref {
  order?: string;
  type?: string;
  _id?: string;
}

export interface CourseCardProps {
  enrollment: {
    courseId: string | { buffer: { data: number[] } };
    courseVersionId: string | { buffer: { data: number[] } };
    percentCompleted?: number;
    contentCounts?: {
      totalItems?: number;
      videos?: number;
      quizzes?: number;
      articles?: number;
      totalQuizScore?: number;
      totalQuizMaxScore?: number;
      completedVideos?: number;
      completedQuizzes?: number;
      completedArticles?: number;
      completedProjects?: number;
    };
    completedItems?: number;
    course?: {
      name: string;
      description: string;
      instructors?: Array<{ name: string }>;
    };
    courseVersion?: {
      name: string;
      description: string;
    };
    enrollmentDate?: string;
    moduleNumber?:string;
    sectionNumber?:string;
    itemType?:string;
  };
  isLoading: boolean;
  index: number;
  variant?: 'dashboard' | 'courses';
  className?: string;
  completion?: CoursePctCompletion[];
  setCompletion?: (completion: CoursePctCompletion[]) => void;
}

export interface CourseSectionProps {
  title: string;
  enrollments: Array<Record<string, unknown>>;
  isLoading: boolean;
  error?: string | null;
  totalEnrollments?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
  onRetry?: () => void;
  variant?: 'dashboard' | 'courses';
  skeletonCount?: number;
  emptyStateConfig?: {
    title: string;
    description: string;
    actionText?: string;
    onAction?: () => void;
  };
  completion?: CoursePctCompletion[];
  setCompletion?: (completion: CoursePctCompletion[]) => void;
  className?: string;
}

export interface CourseInfo {
  courseId: string;
  versionId: string | null;
  moduleId: string | null;
  sectionId: string | null;
  itemId: string | null;
  watchItemId: string | null;
  questionId?: string | null;
}

export interface CourseState {
  currentCourse: CourseInfo | null;
  setCurrentCourse: (courseInfo: CourseInfo) => void;
  setWatchItemId: (watchItemId: string) => void;
  setQuestionId: (questionId: string) => void;
  clearCurrentCourse: () => void;
}

export type RawEnrollment = {
  _id: string
  courseId: { buffer: { data: number[] } }
  courseVersionId: { buffer: { data: number[] } }
  course?: components['schemas']['CourseDataResponse'] & { versionDetails?: components['schemas']['CourseVersionDataResponse'][] };
}

export interface EnrolledUser {
  id: string
  name: string
  email: string
  avatar?: string
  enrolledDate: string
  unenrolledAt?: string
  progress: number
  completedItemsCount?: number
  isDeleted?: boolean
}

export interface ResetProgressData {
  user: EnrolledUser
  scope: "course" | "module" | "section" | "item"
  module?: string
  section?: string
  item?: string
}

export interface CoursePctCompletion {
  courseVersionId: string
  percentage: number
  totalItems: number
  completedItems: number
}