import { EjectionPolicyCard } from "./EjectionPolicyCard";
import { EjectionPolicy } from "@/types/ejection-policy.types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface EjectionPolicyListProps {
  policies: EjectionPolicy[];
  isLoading: boolean;
  onEdit: (policy: EjectionPolicy) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export const EjectionPolicyList = ({ 
  policies, 
  isLoading, 
  onEdit, 
  canEdit, 
  canDelete 
}: EjectionPolicyListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-1/3 mb-4" />
              <Skeleton className="h-4 w-2/3 mb-6" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No policies found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first ejection policy to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {policies.map((policy) => (
        <EjectionPolicyCard
          key={policy._id}
          policy={policy}
          onEdit={onEdit}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}
    </div>
  );
};