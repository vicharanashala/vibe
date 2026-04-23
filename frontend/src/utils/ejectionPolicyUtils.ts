
import { queryClient } from "@/lib/client";
import { fetchClient } from "@/lib/openapi";

const ACTIVE_POLICY_PATH =
  "/ejection-policies/courses/{courseId}/versions/{courseVersionId}/cohorts/{cohortId}/active";

export async function hasActivePolicies(
  courseId: string,
  courseVersionId: string,
  cohortId: string
): Promise<boolean> {
  try {
    const data: any = await queryClient.fetchQuery({
      queryKey: [
        "get",
        ACTIVE_POLICY_PATH,
        courseId,
        courseVersionId,
        cohortId,
      ],
      queryFn: async () => {
        const res = await (fetchClient.GET as any)(
          ACTIVE_POLICY_PATH,
          {
            params: {
              path: { courseId, courseVersionId, cohortId },
            },
          }
        );
        return res.data??{policies:[]};
      },
    });

    return (data?.policies || []).length > 0;
  } catch {
    return false;
  }
}