import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, FileText, Sparkles, Component } from "lucide-react";
import OverviewTab from "./components/OverviewTab";
import CourseTab from "./components/CoursesTab";

export default function HpSystemPage() {
    return (
        <div className="flex-1 md:p-6 p-3 bg-gradient-to-br from-background via-background to-muted/20">
            <div className="max-w-6xl mx-auto space-y-8 min-w-0">

                {/* Header */}
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>

                    <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl md:p-8 p-4">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg"></div>
                                <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                                    <Component className="h-6 w-6 text-primary-foreground" />
                                </div>
                            </div>

                            <div>
                                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                                    HP System
                                </h1>

                                <div className="mt-1 flex items-center">
                                    <Sparkles className="h-4 w-4 text-primary mr-2" />
                                    <span className="text-muted-foreground">
                                        Manage your course HP activities and cohorts
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="courses" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6 p-1 bg-muted/50 border border-border/50 shadow-sm rounded-lg mx-auto lg:ml-0">
                        <TabsTrigger value="dashboard" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            Overview
                        </TabsTrigger>

                        <TabsTrigger value="courses" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Courses
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard">
                        <OverviewTab />
                    </TabsContent>

                    <TabsContent value="courses">
                        <CourseTab />
                    </TabsContent>
                </Tabs>

            </div>
        </div>
    );
}