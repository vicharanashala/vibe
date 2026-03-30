import { useParams } from "@tanstack/react-router";
import { StudentActivitiesPage } from "./components/StudentActivitiesPage";

export default function StudentActivities() {
    const { courseVersionId, cohortName } = useParams({ strict: false });

    return (
        <StudentActivitiesPage 
            courseVersionId={courseVersionId as string}
            cohortName={cohortName as string}
        />
    );
}
