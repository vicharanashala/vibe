import { useQuery } from "@tanstack/react-query"
import client from "@/lib/client"

export interface CurrentProgressPath {
  module: {
    id: string
    name: string
  }
  section: {
    id: string
    name: string
  }
  item: {
    id: string
    name: string
    type: string
  }
}

export const useStudentCurrentProgressPath = (
  userId?: string,
  courseId?: string,
  versionId?: string,
  enabled = false
) => {
  return useQuery({
    queryKey: [
      "student-current-progress-path",
      userId,
      courseId,
      versionId,
    ],
    enabled: !!userId && !!courseId && !!versionId && enabled,
    queryFn: async () => {
      const { data } =
        await api.users.getProgressCoursesCourseIdVersionsVersionIdCurrentPath(
          {
            params: {
              path: {
                courseId: courseId!,
                versionId: versionId!,
              },
              query: {
                userId: userId!,
              },
            },
          }
        )

      return data
    },
  })
}
