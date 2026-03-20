import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivitiesTab } from "./components/activities/ActivitiesTab";
import { OverviewTab } from "./components/overview/OverviewTab";

export default function StudentActivities() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("activities"); // Activities tab is default as requested

    if (!courseVersionId || !cohortName) {
        return (
            <div className="p-8 text-center text-red-500">
                Error: Missing course version ID or cohort name
            </div>
        );
    }

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
                        {decodeURIComponent(cohortName as string)}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px] h-11 bg-muted/40 backdrop-blur-sm border border-border/50 p-1 rounded-xl overflow-hidden mb-6">
                    <TabsTrigger
                        value="activities"
                        className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                        Activities
                    </TabsTrigger>
                    <TabsTrigger
                        value="overview"
                        className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                        Overview
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activities" className="mt-4 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
                    <ActivitiesTab 
                        courseVersionId={courseVersionId as string}
                        cohortName={cohortName as string}
                    />
                </TabsContent>

                <TabsContent value="overview" className="mt-4 space-y-4 animate-in fade-in-50 duration-300 slide-in-from-left-2">
                    <OverviewTab 
                        courseVersionId={courseVersionId as string}
                        cohortName={cohortName as string}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
