import React from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReviewForm } from './ReviewForm';

/**
 * Route wrapper for `/student/peer-review/review/:assignmentId`.
 *
 * Pulls the `assignmentId` path param and hands it to <ReviewForm>.
 * The dashboard already opens <ReviewForm> inline, so this page is
 * only used for deep-links (e.g. from a notification email).
 */
export function ReviewPage() {
  const { assignmentId } = useParams({ strict: false }) as {
    assignmentId?: string;
  };
  const navigate = useNavigate();

  if (!assignmentId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No assignment id in the URL.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/student/peer-review' as any })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to dashboard
        </Button>
      </div>
      <ReviewForm
        assignmentId={assignmentId}
        onClose={() => navigate({ to: '/student/peer-review' as any })}
      />
    </div>
  );
}

export default ReviewPage;