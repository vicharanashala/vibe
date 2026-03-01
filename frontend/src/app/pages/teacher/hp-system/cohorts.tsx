import React, { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HpSystemCohorts() {
    const { courseVersionId } = useParams({ strict: false });
    const navigate = useNavigate();

    // TODO: Fetch from actual API
    const cohorts = [
        {
            cohortName: "Cohort A",
            courseVersionId: courseVersionId as string,
            stats: {
                totalStudents: 120,
                publishedActivities: 12,
                totalHpDistributed: 8500,
            }
        },
        {
            cohortName: "Cohort B",
            courseVersionId: courseVersionId as string,
            stats: {
                totalStudents: 95,
                publishedActivities: 10,
                totalHpDistributed: 6200,
            }
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate({ to: "/teacher/hp-system" })}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Cohorts for Version {courseVersionId}</h2>
                    <p className="text-muted-foreground">Select a cohort to manage its activities.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cohorts.map((c) => (
                    <Card key={c.cohortName} className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate({ to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(c.cohortName)}/activities` })}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {c.cohortName}
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                                <div className="flex justify-between">
                                    <span>Students:</span>
                                    <span className="font-medium text-foreground">{c.stats.totalStudents}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Published Activities:</span>
                                    <span className="font-medium text-foreground">{c.stats.publishedActivities}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>HP Distributed:</span>
                                    <span className="font-medium text-foreground">{c.stats.totalHpDistributed}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
