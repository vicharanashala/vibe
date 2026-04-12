import { Trophy, Medal, Award, Crown, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLeaderboard, useUserEnrollments } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Leaderboard() {
  const currentCourse = useCourseStore.getState().currentCourse;
  
  // Fetch user's enrolled courses
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useUserEnrollments(1, 1000);
  
  // State for selected course
  const [selectedCourseId, setSelectedCourseId] = useState(currentCourse?.courseId || "");
  const [selectedVersionId, setSelectedVersionId] = useState(currentCourse?.versionId || "");

  // Update selected course when enrollments load
  useEffect(() => {
    if (enrollmentsData?.enrollments && enrollmentsData.enrollments.length > 0 && !selectedCourseId) {
      const firstEnrollment = enrollmentsData.enrollments[0];
      setSelectedCourseId(firstEnrollment.courseId);
      setSelectedVersionId(firstEnrollment.courseVersionId);
    }
  }, [enrollmentsData, selectedCourseId]);

  const { data: leaderboardData, isLoading, error, refetch, isFetching } = useLeaderboard(
    selectedCourseId, 
    selectedVersionId, 
    !!selectedCourseId && !!selectedVersionId
  );

  // Handle course selection change
  const handleCourseChange = (value: string) => {
    const enrollment = enrollmentsData?.enrollments?.find(e => `${e.courseId}-${e.courseVersionId}` === value);
    if (enrollment) {
      setSelectedCourseId(enrollment.courseId);
      setSelectedVersionId(enrollment.courseVersionId);
    }
  };

  // Get selected course name
  const getCourseName = (enrollment: any) => {
    return enrollment?.course?.name || 'Untitled Course';
  };

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get rank badge colors
  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bgColor: "bg-gradient-to-br from-yellow-400 to-yellow-600",
          textColor: "text-yellow-900",
          icon: <Crown className="h-6 w-6" />,
          label: "Gold",
        };
      case 2:
        return {
          bgColor: "bg-gradient-to-br from-gray-300 to-gray-500",
          textColor: "text-gray-900",
          icon: <Medal className="h-6 w-6" />,
          label: "Silver",
        };
      case 3:
        return {
          bgColor: "bg-gradient-to-br from-orange-400 to-orange-700",
          textColor: "text-orange-900",
          icon: <Award className="h-6 w-6" />,
          label: "Bronze",
        };
      default:
        return {
          bgColor: "bg-muted",
          textColor: "text-muted-foreground",
          icon: null,
          label: null,
        };
    }
  };

  if (enrollmentsLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6" />
              Course Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!enrollmentsData?.enrollments || enrollmentsData.enrollments.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6" />
              Course Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              You are not enrolled in any courses yet
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trophy className="h-6 w-6" />
              Error Loading Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-600" />
                Course Leaderboard
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Students ranked by completion percentage and completion time
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Refreshing..." : "Refresh"}
              </Button>
            {/* Course Selector Dropdown */}
            {enrollmentsData?.enrollments && enrollmentsData.enrollments.length > 0 && (
              <Select value={`${selectedCourseId}-${selectedVersionId}`} onValueChange={handleCourseChange}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {enrollmentsData.enrollments.map((enrollment) => (
                    <SelectItem 
                      key={`${enrollment.courseId}-${enrollment.courseVersionId}`}
                      value={`${enrollment.courseId}-${enrollment.courseVersionId}`}
                    >
                      {getCourseName(enrollment)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        </CardHeader>
        <CardContent>
          {/* Show loading state while fetching leaderboard data */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          )}

          {/* Show error if leaderboard fetch fails */}
          {error && !isLoading && (
            <p className="text-muted-foreground text-center py-8">{error}</p>
          )}

          {/* Show empty state */}
          {!isLoading && !error && (!leaderboardData || leaderboardData.length === 0) && (
            <p className="text-muted-foreground text-center py-8">
              No students enrolled yet
            </p>
          )}

          {/* Show leaderboard data */}
          {!isLoading && !error && leaderboardData && leaderboardData.length > 0 && (
            <>
              {/* Top 3 Highlight Section */}
              {leaderboardData.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* Silver - 2nd Place */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-2",
                    getRankStyle(2).bgColor
                  )}
                >
                  {getRankStyle(2).icon}
                </div>
                <Avatar className="mb-2 h-16 w-16">
                  <AvatarFallback className="bg-gray-200 text-gray-700">
                    {getInitials(leaderboardData[1].userName)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-semibold text-center text-sm">
                  {leaderboardData[1].userName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leaderboardData[1].completionPercentage}%
                </p>
              </div>

              {/* Gold - 1st Place (larger) */}
              <div className="flex flex-col items-center -mt-4">
                <div
                  className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center mb-2",
                    getRankStyle(1).bgColor
                  )}
                >
                  {getRankStyle(1).icon}
                </div>
                <Avatar className="mb-2 h-20 w-20">
                  <AvatarFallback className="bg-yellow-200 text-yellow-800">
                    {getInitials(leaderboardData[0].userName)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-bold text-center">
                  {leaderboardData[0].userName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {leaderboardData[0].completionPercentage}%
                </p>
              </div>

              {/* Bronze - 3rd Place */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-2",
                    getRankStyle(3).bgColor
                  )}
                >
                  {getRankStyle(3).icon}
                </div>
                <Avatar className="mb-2 h-16 w-16">
                  <AvatarFallback className="bg-orange-200 text-orange-700">
                    {getInitials(leaderboardData[2].userName)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-semibold text-center text-sm">
                  {leaderboardData[2].userName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leaderboardData[2].completionPercentage}%
                </p>
              </div>
            </div>
          )}

              {/* Full Leaderboard List */}
              <div className="space-y-2">
                {leaderboardData.map((entry) => {
              const rankStyle = getRankStyle(entry.rank);
              return (
                <div
                  key={entry.userId}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg transition-colors",
                    entry.rank <= 3
                      ? "bg-muted/50 border-2"
                      : "bg-muted/20 hover:bg-muted/40",
                    entry.rank === 1 && "border-yellow-400",
                    entry.rank === 2 && "border-gray-400",
                    entry.rank === 3 && "border-orange-400"
                  )}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 text-center">
                    {entry.rank <= 3 ? (
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mx-auto", rankStyle.bgColor)}>
                        <span className={cn("font-bold", rankStyle.textColor)}>
                          {entry.rank}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-semibold text-muted-foreground">
                        {entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className={cn(
                        entry.rank === 1 && "bg-yellow-100 text-yellow-800",
                        entry.rank === 2 && "bg-gray-100 text-gray-700",
                        entry.rank === 3 && "bg-orange-100 text-orange-700",
                        entry.rank > 3 && "bg-muted"
                      )}
                    >
                      {getInitials(entry.userName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name and Stats */}
                  <div className="flex-1">
                    <p className="font-semibold">{entry.userName}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.completionPercentage === 100 ? (
                        <>
                          <span className="text-green-600 font-medium">
                            ✓ Completed
                          </span>
                          {entry.completedAt && (
                            <span className="ml-2">
                              on {new Date(entry.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </>
                      ) : (
                        `In Progress: ${entry.completionPercentage}%`
                      )}
                    </p>
                  </div>

                  {/* Completion Percentage Badge */}
                  <div
                    className={cn(
                      "px-4 py-2 rounded-full font-semibold",
                      entry.completionPercentage === 100
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    )}
                  >
                    {entry.completionPercentage}%
                  </div>
                </div>
                );
              })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
