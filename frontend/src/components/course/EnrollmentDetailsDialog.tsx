// Create a new component: EnrollmentDetailsDialog.tsx
import { useUserEnrollmentsDetails, useCourseVersionById } from "@/hooks/hooks";
import { bufferToHex } from '@/utils/helpers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock } from "lucide-react";

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'N/A';
  }
};


interface EnrollmentDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  enrollment: any;
}

export function EnrollmentDetailsDialog({
  isOpen,
  onOpenChange,
  enrollment
}: EnrollmentDetailsDialogProps) {

  const normalizeId = (value: any): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    try {
      return bufferToHex(value);
    } catch {
      return value?.toString?.();
    }
  };

  const courseVersionId = bufferToHex(enrollment.courseVersionId);
  const cohortId = enrollment?.cohortId
    ? bufferToHex(enrollment.cohortId)
    : undefined;
  const enrollmentId = normalizeId(enrollment?._id);
  // Hook is only called when this component is mounted
  const {
    data: enrollmentDetails,
    isLoading
  } = useUserEnrollmentsDetails(true, "", "STUDENT", courseVersionId, cohortId);
  const { data: versionDetails } = useCourseVersionById(
    courseVersionId,
    true,
    cohortId,
  );


  const matchedEnrollment = enrollmentDetails?.enrollments?.find((entry: any) => {
    const entryId = normalizeId(entry?._id);
    const entryCohortId = normalizeId(entry?.cohortId);

    if (enrollmentId && entryId === enrollmentId) {
      return true;
    }

    if (cohortId) {
      return entryCohortId === cohortId;
    }

    return !entryCohortId;
  });

  const enroll1 = matchedEnrollment || enrollment;
  // Extract data from enrollment prop
  const contentCounts = enroll1?.contentCounts || {};
  const itemCounts = contentCounts.itemCounts || {};

  // Get values with fallbacks
  const totalLessons = Number(contentCounts.totalItems ?? contentCounts.total ?? 0);
  const completedLessons = Number(
    enroll1?.completedItemsCount ?? enroll1?.completedItems ?? 0,
  );
  const isCompleted = (enroll1?.percentCompleted >= 100) || false;

  const totalQuizScore = Number(
    contentCounts.totalQuizScore ?? enroll1?.totalQuizScore ?? 0,
  );
  const totalQuizMaxScore = Number(
    contentCounts.totalQuizMaxScore ?? enroll1?.totalQuizMaxScore ?? 0,
  );

  const videoCount = Number(
    contentCounts.videos ?? itemCounts.VIDEO ?? itemCounts.video ?? itemCounts.videos ?? 0,
  );
  const quizCount = Number(
    contentCounts.quizzes ?? itemCounts.QUIZ ?? itemCounts.quiz ?? itemCounts.quizzes ?? 0,
  );
  const articleCount = Number(
    contentCounts.articles ?? itemCounts.BLOG ?? itemCounts.blog ?? itemCounts.articles ?? 0,
  );
  const projectCount = Number(
    contentCounts.project ?? contentCounts.projects ?? itemCounts.PROJECT ?? itemCounts.project ?? itemCounts.projects ?? 0,
  );

  const completedVideos = contentCounts.completedVideos || 0;
  const completedQuizzes = contentCounts.completedQuizzes || 0;
  const completedArticles = contentCounts.completedArticles || 0;
  const completedProjects = contentCounts.completedProjects || 0;

  // Debug: Check if contentCounts is empty
  // Version name — use the already-fetched hook data
const versionName = versionDetails?.version || 'N/A';
const versionDescription = versionDetails?.description || 'No version description available';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-[425px]:w-[95vw] max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 max-h-full flex flex-col">
        <DialogHeader className="mb-3 text-left">
          <DialogTitle>Course Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex flex-col p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-6 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-6 w-full" /></div>
            </div>
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4 -mr-4 max-h-[700px] overflow-y-auto">
          <div className="space-y-6 py-2">
            {/* Course Information */}
            <div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Course Name</p>
                  <p>{enroll1?.course?.name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Version</p>
                  <p>{versionName}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Assigned Timeslot</p>
                  <p className="text-sm">
                    {(() => {
                      const timeSlot = Array.isArray(enroll1?.assignedTimeSlot) 
                        ? enroll1.assignedTimeSlot[0] 
                        : enroll1?.assignedTimeSlot;
                      
                      return timeSlot 
                        ? `${timeSlot.from} - ${timeSlot.to} (IST)`
                        : 'You can access course anytime';
                    })()}
                  </p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">{enroll1?.course?.description || 'No description available'}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Version Description</p>
                  <p className="text-sm">{versionDescription}</p>
                </div>
              </div>

              <Separator />

              {/* Content Summary */}
              <div>
                <h3 className="text-lg font-semibold">Content Summary</h3>

                {/* Show warning if contentCounts is empty */}
                {Object.keys(contentCounts).length === 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                    <p className="text-sm text-blue-800">
                      Course content details will be available after enrollment.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                    <p className="text-xl font-semibold">{totalLessons}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Videos</p>
                    <p className="text-xl font-semibold">{videoCount}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Quizzes</p>
                    <p className="text-xl font-semibold">{quizCount}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Articles</p>
                    <p className="text-xl font-semibold">{articleCount}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Projects</p>
                    <p className="text-xl font-semibold">{projectCount}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Quiz Scores</p>
                    <p className="text-xl font-semibold">{totalQuizScore} / {totalQuizMaxScore}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Completion Details */}
              <div>
                <h3 className="text-lg font-semibold">Completion Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Total Completed</p>
                    <p className="text-xl font-semibold">{completedLessons} / {totalLessons}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Videos Watched</p>
                    <p className="text-xl font-semibold">{completedVideos} / {videoCount}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Quizzes Completed</p>
                    <p className="text-xl font-semibold">{completedQuizzes} / {quizCount}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Articles Read</p>
                    <p className="text-xl font-semibold">{completedArticles} / {articleCount}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Projects Done</p>
                    <p className="text-xl font-semibold">{completedProjects} / {projectCount}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Progress</p>
                    <p className="text-xl font-semibold">{enroll1?.percentCompleted?.toFixed(2) || 0}%</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Enrollment Details */}
              <div>
                <h3 className="text-lg font-semibold">Enrollment Details</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Enrolled On</p>
                    <p>{enroll1?.enrollmentDate ? formatDate(enroll1.enrollmentDate) : 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <div className="flex items-center gap-1">
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Completed</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <span>In Progress</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}