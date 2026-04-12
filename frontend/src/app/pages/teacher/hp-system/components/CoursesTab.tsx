import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, GraduationCap, FileText } from "lucide-react";
import { useHpCourseVersions } from "@/hooks/hooks";

export default function CourseTab() {
    const navigate = useNavigate();
    const { data: courses = [], isLoading: loading } = useHpCourseVersions();
    const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

    
    const toggleExpand = (courseId: string) => {
        setExpandedCourseId((prev) => (prev === courseId ? null : courseId));
    };

    return (
        <div className="space-y-6">
            {loading ? (
                <div className="w-full h-32 flex items-center justify-center text-muted-foreground border rounded-md">
                    Loading course data...
                </div>
            ) : courses.length === 0 ? (
                <div className="w-full h-32 flex items-center justify-center text-muted-foreground border rounded-md">
                    No courses found.
                </div>
            ) : (
                courses.map((course, index) => {
                    const isExpanded = expandedCourseId === course.courseId;

                    return (
                        <div
                            key={course.courseId}
                            className="animate-in slide-in-from-bottom-4 duration-500"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <Card className="bg-card/95 backdrop-blur-sm border border-border/50 overflow-hidden hover:bg-accent/5 transition-all">
                                <CardHeader
                                    className="cursor-pointer p-6"
                                    onClick={() => toggleExpand(course.courseId)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`transition-all ${isExpanded ? "rotate-90" : ""}`}>
                                            <ChevronRight className="h-5 w-5 text-primary" />
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <CardTitle className="text-lg font-bold">
                                                    {course.courseName}
                                                </CardTitle>

                                                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">
                                                    <FileText className="h-3 w-3 mr-1" />
                                                    {course.versions?.length || 0} Version
                                                    {course.versions?.length !== 1 && "s"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="border-t bg-card/50 p-6">
                                        <h3 className="text-lg font-semibold mb-4">
                                            All Versions ({course.versions?.length || 0})
                                        </h3>

                                        {course.versions.length === 0 ? (
                                            <div className="text-center text-muted-foreground">
                                                No versions available
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {course.versions.map((v) => (
                                                    <Card
                                                        key={v.courseVersionId}
                                                        className="border-l-4 border-l-primary/40 hover:border-l-primary cursor-pointer transition-all"
                                                        onClick={() =>
                                                            navigate({
                                                                to: `/teacher/hp-system/${v.courseVersionId}/cohorts`,
                                                            })
                                                        }
                                                    >
                                                        <CardContent className="p-4 flex justify-between items-center">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-semibold">{v.versionName}</h4>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        Version
                                                                    </Badge>
                                                                </div>

                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                                    <GraduationCap className="h-3 w-3" />
                                                                    {v.totalCohorts} Cohort
                                                                    {v.totalCohorts !== 1 && "s"}
                                                                </div>
                                                            </div>

                                                            <Button variant="ghost" size="sm">
                                                                View Cohorts
                                                                <ChevronRight className="ml-1 h-4 w-4" />
                                                            </Button>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                )}
                            </Card>
                        </div>
                    );
                })
            )}
        </div>
    );
}