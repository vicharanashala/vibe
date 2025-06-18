import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnnouncementBannerProps {
  badge?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const AnnouncementBanner = ({ 
  badge = "New", 
  title, 
  description, 
  actionText = "View details", 
  onAction, 
  className 
}: AnnouncementBannerProps) => {
  return (
    <div className={`bg-accent/20 border border-accent/30 rounded-lg p-4 mb-2 ${className || ''}`}>
      <div className="flex items-start">
        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded mr-3">
          {badge}
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-muted-foreground text-sm">
            {description}
          </p>
        </div>
        {onAction && (
          <Button variant="ghost" className="inline-flex items-center text-sm font-medium" onClick={onAction}>
            {actionText} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
