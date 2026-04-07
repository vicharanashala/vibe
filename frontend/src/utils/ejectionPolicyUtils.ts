
import { queryClient } from "@/lib/client";
import { fetchClient } from "@/lib/openapi";

export async function hasActivePolicies(
  courseId: string,
  courseVersionId: string,
  cohortId: string
): Promise<boolean> {
  try {
    const data: any = await queryClient.fetchQuery({
      queryKey: [
        "get",
        "/ejection-policies/courses/{courseId}/versions/{courseVersionId}/cohorts/{cohortId}/active",
        courseId,
        courseVersionId,
        cohortId,
      ],
      queryFn: async () => {
        const res = await fetchClient.GET(
          "/ejection-policies/courses/{courseId}/versions/{courseVersionId}/cohorts/{cohortId}/active",
          {
            params: {
              path: { courseId, courseVersionId, cohortId },
            },
          }
        );
        return res.data;
      },
    });

    return (data?.policies || []).length > 0;
  } catch {
    return false;
  }
}