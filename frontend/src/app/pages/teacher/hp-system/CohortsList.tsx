import { useParams, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHpCohorts } from "@/hooks/hooks";

export default function HpSystemCohorts() {
    const { courseVersionId } = useParams({ strict: false });
    const navigate = useNavigate();

    const { data: cohorts, isLoading, error } = useHpCohorts(courseVersionId as string);

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

            {isLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading cohorts...
                </div>
            )}

            {error && (
                <div className="text-red-500 py-4">Error: {error}</div>
            )}

            {!isLoading && !error && cohorts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    No cohorts found for this version.
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cohorts.map((c) => (
                    <Card
                        key={c.cohortName}
                        className="relative group overflow-hidden cursor-pointer hover:border-primary transition-all hover:shadow-lg"
                        onClick={() =>
                            navigate({
                                to: `/teacher/hp-system/${courseVersionId}/cohort/${encodeURIComponent(
                                    c.cohortName
                                )}/activities`,
                            })
                        }
                    >

                        {/* Overlay */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-95 transition-all duration-200 bg-black/30 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                            <div className="flex items-center gap-2 text-white">
                                <Users className="h-4 w-4" />
                                Manage Cohort
                            </div>
                        </div>

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


