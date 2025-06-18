import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  variant?: 'default' | 'error';
  className?: string;
}

export const EmptyState = ({ 
  icon, 
  title, 
  description, 
  actionText, 
  onAction, 
  variant = 'default',
  className 
}: EmptyStateProps) => {
  const cardClassName = variant === 'error' 
    ? "border border-destructive/20 bg-destructive/5"
    : "border border-border";

  const defaultIcon = variant === 'error' 
    ? <BookOpen className="h-12 w-12 text-destructive mx-auto mb-4" />
    : <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />;

  const titleClassName = variant === 'error' 
    ? "text-lg font-medium mb-2 text-destructive"
    : "text-lg font-medium mb-2";

  return (
    <Card className={`${cardClassName} ${className || ''}`}>
      <CardContent className="p-6 text-center">
        {icon || defaultIcon}
        <h3 className={titleClassName}>{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>
        {onAction && actionText && (
          <Button 
            onClick={onAction}
            variant={variant === 'error' ? 'outline' : 'default'}
          >
            {actionText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
