import { useGetAppealById } from "@/hooks/system-notification-hooks";
import { Button } from "@/components/ui/button";

export function AppealStatusBadge({
  appealId,
  onReview,
}: {
  appealId: string;
  onReview: () => void;
}) {
  const { data: appeal } = useGetAppealById(appealId, !!appealId);

  if (appeal?.status === "PENDING") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-6 px-2"
        onClick={(e) => {
          e.stopPropagation();
          onReview();
        }}
      >
        Review
      </Button>
    );
  }

  if (appeal?.status) {
    return (
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          appeal.status === "APPROVED"
            ? "bg-green-100 text-green-700"
            : appeal.status === "REJECTED"
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {appeal.status}
      </span>
    );
  }

  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
      Processed
    </span>
  );
}