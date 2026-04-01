import { PendingRegistrationNotification } from "@/types/notification.types";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useCourseStore } from "@/store/course-store";

type RegistrationNotificationDropdownProps = {
  pendingRegistrations: PendingRegistrationNotification[];
  setPendingRegistrations: React.Dispatch<React.SetStateAction<PendingRegistrationNotification[]>>;
  onClose?: () => void; // Add onClose callback
};

const RegistrationNotificationDropdown = ({ pendingRegistrations, setPendingRegistrations, onClose }: RegistrationNotificationDropdownProps) => {
  console.log("📬 RegistrationNotificationDropdown props:", { pendingRegistrations, setPendingRegistrations });

  const isLoading = false; // Since data is already fetched by parent
  const navigate = useNavigate();
  const { setCurrentCourse } = useCourseStore()

  const handleApprove = (registration: PendingRegistrationNotification) => {
    // Set current course for navigation
    setCurrentCourse({
      courseId: registration.courseId,
      versionId: registration.versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
    })

    // Navigate to registration requests page
    navigate({
      to: "/teacher/courses/registration-requests" as any,
    })

    // Remove this registration from the list
    setPendingRegistrations((prev) => prev.filter((r) => r._id !== registration._id));

    // Close dropdown
    onClose?.();
  };

  return (
    <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-black rounded-lg shadow-lg border border-orange-100 dark:border-zinc-700 z-50">
      <ul className="divide-y divide-gray-200 dark:divide-zinc-600 max-h-48 overflow-auto p-1">
        {isLoading ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            Loading...
          </li>
        ) : pendingRegistrations.length === 0 ? (
          <li className="text-sm text-gray-500 dark:text-gray-300 px-2 py-2">
            No Pending Registrations
          </li>
        ) : (
          pendingRegistrations.map((registration: PendingRegistrationNotification, idx: number) => (
            <li key={idx} className="p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                    {registration.detail?.Email}
                  </p>
                  <p className="text-sm font-bold text-primary dark:text-primary truncate">
                    {registration.courseName}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApprove(registration)}
                  className="text-xs h-6 px-2 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 flex-shrink-0"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Approve
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
      <div className="p-2 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-primary hover:text-primary hover:bg-primary/5"
          onClick={() => {
            navigate({ to: '/teacher/notifications' as any });
            onClose?.();
          }}
        >
          View All Notifications
        </Button>
      </div>
    </div>
  );
};

export default RegistrationNotificationDropdown;
