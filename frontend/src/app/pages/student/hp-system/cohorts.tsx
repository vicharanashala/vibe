import { useHpStudentCohorts } from "@/hooks/hooks";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export default function StudentCohorts() {
    const { data: cohorts, isLoading, error } = useHpStudentCohorts();
    const navigate = useNavigate();

    // The backend endpoint isn't wired yet so we use mock data from the hook
    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[50vh]">
            Loading your cohorts...
        </div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">
            Error: {error}
        </div>;
    }

    return (
        <div className="container mx-auto p-6 max-w-6xl space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">My Cohorts</h1>
                <p className="text-muted-foreground">
                    Select a cohort to view your activities, submissions, and current House Points (HP) standing.
                </p>
            </div>

            {(!cohorts || cohorts.length === 0) ? (
                <Card className="flex flex-col items-center justify-center p-12 mt-8 text-center border-dashed">
                    <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No Cohorts Found</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                        You don't seem to be enrolled in any active cohorts right now. If you believe this is an error, please contact your instructor.
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                    {cohorts.map((cohort, index) => (
                        <Card key={index} className="flex flex-col hover:border-primary/50 transition-colors">
                            <CardHeader>
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                        <CardTitle className="leading-tight">{cohort.courseName}</CardTitle>
                                        <CardDescription className="flex items-center gap-1.5 mt-1 font-medium text-foreground/70">
                                            {cohort.cohortName}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-grow">

                            </CardContent>

                            <CardFooter>
                                <Button
                                    className="w-full group"
                                    onClick={() => navigate({ to: `/student/hp-system/${cohort.courseVersionId}/${cohort.cohortName}/activities` })}
                                >
                                    View activities
                                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
