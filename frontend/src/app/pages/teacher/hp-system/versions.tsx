import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, ChevronRight, Sparkles, GraduationCap, FileText, Component } from "lucide-react";
import { useHpCourseVersions } from "@/hooks/hooks";

export default function HpSystemVersions() {
    const navigate = useNavigate();
    const { data: courses, isLoading: loading } = useHpCourseVersions();
    const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

    // Auto-expand first course when data loads
    useEffect(() => {
        if (courses.length > 0 && !expandedCourseId) {
            setExpandedCourseId(courses[0].courseId);
        }
    }, [courses]);

    const toggleExpand = (courseId: string) => {
        setExpandedCourseId(prev => prev === courseId ? null : courseId);
    };

    return (
        <div className="flex-1 md:p-6 p-3 bg-gradient-to-br from-background via-background to-muted/20">
            <div className="max-w-6xl mx-auto space-y-8 min-w-0">
                {/* Header Section with Beautiful Design matching All Courses */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>
                    <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl md:p-8 p-4">
                        <div className="lg:flex items-center justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg "></div>
                                        <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                                            <Component className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                    </div>
                                    <div>
                                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                                            HP System
                                        </h1>
                                        <div className="mt-1 flex items-center" style={{ minHeight: '1.5rem' }}>
                                            <span className="inline-flex items-center justify-center" style={{ width: '1.5rem' }}>
                                                <Sparkles className="h-4 w-4 text-primary" />
                                            </span>
                                            <span className="text-muted-foreground ml-2">Manage your course HP activities and cohorts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <Tabs defaultValue="courses" className="w-full animate-in fade-in duration-500">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6 p-1 bg-muted/50 border border-border/50 shadow-sm rounded-lg lg:ml-0 mx-auto">
                        <TabsTrigger value="dashboard" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                        </TabsTrigger>
                        <TabsTrigger value="courses" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <FileText className="h-4 w-4 mr-2" /> Courses
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <Card className="bg-card/95 backdrop-blur-sm border border-border/50 hover:bg-accent/5 transition-colors">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <LayoutDashboard className="h-5 w-5 text-primary" />
                                    HP Overview Dashboard
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64 flex flex-col justify-center items-center text-muted-foreground border-2 border-dashed border-border/60 rounded-xl bg-muted/10 gap-2">
                                    <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                                    <p className="font-medium text-lg">Dashboard coming soon.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="courses" className="space-y-6 focus-visible:outline-none">
                        {/* Courses List */}
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
                                            className="animate-in slide-in-from-bottom-4 duration-500 relative group"
                                            style={{ animationDelay: `${index * 100}ms` }}
                                        >
                                            <Card
                                                className={`relative bg-card/95 backdrop-blur-sm border border-border/50 overflow-hidden transition-all duration-500 min-w-0 hover:bg-accent/5`}
                                            >
                                                <CardHeader className="relative overflow-hidden p-0">
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                                                    <div
                                                        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 cursor-pointer"
                                                        onClick={() => toggleExpand(course.courseId)}
                                                    >
                                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                                            <div className={`transition-all duration-300 ${isExpanded ? "rotate-90" : ""}`}>
                                                                <div className="relative">
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-sm"></div>
                                                                    <div className="relative bg-gradient-to-r from-primary to-accent p-1.5 rounded-full">
                                                                        <ChevronRight className="h-4 w-4 text-primary-foreground" />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                                                                    <CardTitle className="text-lg md:text-xl font-bold text-foreground sm:line-clamp-2 break-words">
                                                                        {course.courseName}
                                                                    </CardTitle>
                                                                    <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary w-fit shrink-0">
                                                                        <FileText className="h-3 w-3 mr-1" />
                                                                        {course.versions?.length || 0} Version{(course.versions?.length !== 1) && 's'}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardHeader>

                                                {isExpanded && (
                                                    <CardContent className="p-0 border-t bg-card/50">
                                                        <div className="p-4 sm:p-6 space-y-4">
                                                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                                                                <div className="w-1 h-5 bg-gradient-to-b from-primary to-accent rounded-full"></div>
                                                                All Versions ({course.versions?.length || 0})
                                                            </h3>

                                                            {course.versions.length === 0 ? (
                                                                <div className="relative">
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-xl blur-sm"></div>
                                                                    <Card className="relative bg-card/95 backdrop-blur-sm border-dashed border-2 border-muted-foreground/30">
                                                                        <CardContent className="p-6 text-center">
                                                                            <div className="relative inline-block mb-3">
                                                                                <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-full blur-sm"></div>
                                                                                <div className="relative bg-muted/20 border border-muted-foreground/20 rounded-full p-3">
                                                                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-muted-foreground font-medium">No versions available</p>
                                                                        </CardContent>
                                                                    </Card>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-3">
                                                                    {course.versions.map((v, vIndex) => (
                                                                        <div
                                                                            key={v.courseVersionId}
                                                                            className="animate-in slide-in-from-left-4 duration-500 relative group/version cursor-pointer"
                                                                            style={{ animationDelay: `${vIndex * 100}ms` }}
                                                                            onClick={() => navigate({ to: `/teacher/hp-system/${v.courseVersionId}/cohorts` })}
                                                                        >
                                                                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover/version:opacity-100 transition-opacity duration-500"></div>
                                                                            <Card className="relative bg-card/95 backdrop-blur-sm border-l-4 border-l-primary/40 transition-all duration-300 min-w-0 hover:bg-accent/5 hover:border-l-primary">
                                                                                <CardContent className="p-4">
                                                                                    <div className="flex flex-col gap-4">
                                                                                        <div className="flex flex-col xl:flex-row lg:items-start lg:justify-between gap-4">
                                                                                            <div className="flex-1 min-w-0 space-y-2">
                                                                                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                                                        <h4 className="font-semibold text-foreground group-hover/version:text-primary transition-colors">{v.versionName}</h4>
                                                                                                        <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-xs">
                                                                                                            Version
                                                                                                        </Badge>
                                                                                                    </div>
                                                                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                                                        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                                                                                                            <GraduationCap className="h-3 w-3" />
                                                                                                            <span>{v.totalCohorts} Cohort{v.totalCohorts !== 1 ? 's' : ''}</span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex items-center justify-end gap-2 shrink-0 md:mt-0">
                                                                                                <Button variant="ghost" size="sm" className="h-8 text-primary group-hover/version:bg-primary/10">
                                                                                                    View Cohorts <ChevronRight className="ml-1 h-4 w-4" />
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </CardContent>
                                                                            </Card>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                )}
                                            </Card>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
