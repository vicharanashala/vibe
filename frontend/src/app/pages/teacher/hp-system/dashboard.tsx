import React from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivitiesTab } from "./components/ActivitiesTab";

export default function HpSystemDashboard() {
    const { courseVersionId, cohortName } = useParams({ strict: false });
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate({ to: `/teacher/hp-system/${courseVersionId}/cohorts` })}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{decodeURIComponent(cohortName || '')} Dashboard</h2>
                    <p className="text-muted-foreground">Manage activities and HP for this cohort.</p>
                </div>
            </div>

            <Tabs defaultValue="activities" className="w-full">
                <TabsList>
                    <TabsTrigger value="activities">Activities</TabsTrigger>
                    <TabsTrigger value="students" disabled>Students</TabsTrigger>
                </TabsList>
                <TabsContent value="activities" className="mt-6">
                    <ActivitiesTab courseVersionId={courseVersionId || ""} cohortName={cohortName || ""} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
