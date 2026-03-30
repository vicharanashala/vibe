import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivitiesTab } from "./activities/ActivitiesTab";
import { OverviewTab } from "./overview/OverviewTab";

interface StudentActivitiesPageProps {
    courseVersionId: string;
    cohortName: string;
}

export function StudentActivitiesPage({ courseVersionId, cohortName }: StudentActivitiesPageProps) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("activities"); // Activities tab is default as requested

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/student/hp-system/cohorts' })}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">Cohort Activities</h1>
                    <p className="text-muted-foreground">
                        {decodeURIComponent(cohortName)}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6 p-1 bg-muted/50 border border-border/50 shadow-sm rounded-lg mx-auto lg:ml-0">
                    <TabsTrigger
                        value="activities"
                        className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        Activities
                    </TabsTrigger>
                    <TabsTrigger
                        value="overview"
                        className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                        Overview
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activities" className="mt-6 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
                    <ActivitiesTab 
                        courseVersionId={courseVersionId}
                        cohortName={cohortName}
                    />
                </TabsContent>

                <TabsContent value="overview" className="mt-6 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
                    <OverviewTab 
                        courseVersionId={courseVersionId}
                        cohortName={cohortName}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
