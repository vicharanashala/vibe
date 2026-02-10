// Create a new component: EnrollmentDetailsDialog.tsx
import { useState } from "react";
import { useUserEnrollmentsDetails } from "@/hooks/hooks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "../ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock } from "lucide-react";
import { formatDateTime } from "@/utils/utils";


interface EnrollmentDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  enrollment: any; // Use your proper type
}

export function EnrollmentDetailsDialog({ 
  isOpen, 
  onOpenChange, 
  enrollment 
}: EnrollmentDetailsDialogProps) {
  // Hook is only called when this component is mounted
  const { 
    data: enrollmentDetails, 
    isLoading, 
    error 
  } = useUserEnrollmentsDetails(1, 100, true, "", "STUDENT");

  // Extract data from enrollment prop (same as your CourseCard)
  const contentCounts = enrollment.contentCounts as { 
    totalItems?: number; 
    videos?: number; 
    quizzes?: number; 
    articles?: number; 
    project?: number; 
    totalQuizScore?: number; 
    totalQuizMaxScore?: number; 
    completedVideos?: number; 
    completedQuizzes?: number; 
    completedArticles?: number; 
    completedProjects?: number;
  } || {};
  
  const totalLessons = contentCounts.totalItems || 0;
  const completedLessons = enrollment.completedItems as number || 0;
  const isCompleted = (typeof enrollment.percentCompleted === 'number' && enrollment.percentCompleted >= 100) || false;
  const totalQuizScore = contentCounts.totalQuizScore as number || 0;
  const totalQuizMaxScore = contentCounts.totalQuizMaxScore as number || 0;
  const videoCount: number = contentCounts.videos || 0;
  const quizCount: number = contentCounts.quizzes || 0;
  const articleCount: number = contentCounts.articles || 0;
  const projectCount: number = contentCounts.project || 0;
  const completedVideos: number = contentCounts.completedVideos || 0;
  const completedQuizzes: number = contentCounts.completedQuizzes || 0;
  const completedArticles: number = contentCounts.completedArticles || 0;
  const completedProjects: number = contentCounts.completedProjects || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">View Details</Button>
              </DialogTrigger>
              <DialogContent className="w-full max-[425px]:w-[95vw] max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 max-h-full flex flex-col">
                <DialogHeader className="mb-3 text-left">
                  <DialogTitle>Course Details</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 pr-4 -mr-4 max-h-[700px] overflow-y-auto">
                  <div className="space-y-6 py-2">
                    <div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Course Name</p>
                          <p>{enrollment?.course?.name || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Version</p>
                          <p>{enrollment?.courseVersion?.name || 'N/A'}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">Description</p>
                          <p className="text-sm">{enrollment?.course?.description || 'No description available'}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">Version Description</p>
                          <p className="text-sm">{enrollment?.courseVersion?.description || 'No version description available'}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold">Content Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Contents</p>
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
                          <p className="text-sm font-medium text-muted-foreground">Project</p>
                          <p className="text-xl font-semibold">{projectCount}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Quiz Scores</p>
                          <p className="text-xl font-semibold">{totalQuizScore} / {totalQuizMaxScore}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

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
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold">Enrollment Details</h3>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Enrolled On</p>
                          <p>{enrollment?.enrollmentDate ? formatDateTime(enrollment.enrollmentDate as string) : 'N/A'}</p>
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
                </ScrollArea>
              </DialogContent>
            </Dialog>
  );
}