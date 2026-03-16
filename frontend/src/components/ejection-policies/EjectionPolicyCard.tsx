import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit3, Trash2, Power, Shield, AlertTriangle } from "lucide-react";
import { EjectionPolicy } from "@/types/ejection-policy.types";
import { useTogglePolicyStatus, useDeleteEjectionPolicy } from "@/hooks/ejection-policy-hooks";
import { toast } from "sonner";
import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal";

interface EjectionPolicyCardProps {
  policy: EjectionPolicy;
  onEdit: (policy: EjectionPolicy) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export const EjectionPolicyCard = ({ policy, onEdit, canEdit, canDelete }: EjectionPolicyCardProps) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const toggleStatus = useTogglePolicyStatus();
  const deletePolicy = useDeleteEjectionPolicy();

  const handleToggle = async () => {
    try {
      await toggleStatus.mutateAsync({
        params: { path: { policyId: policy._id } }
      });
      toast.success(`Policy ${policy.isActive ? 'deactivated' : 'activated'} successfully`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to toggle policy status');
    }
  };

  const handleDelete = async () => {
    try {
      await deletePolicy.mutateAsync({
        params: { path: { policyId: policy._id } }
      });
      toast.success('Policy deleted successfully');
      setShowDeleteModal(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete policy');
    }
  };

  const getTriggerSummary = () => {
    const triggers = [];
    if (policy.triggers.inactivity?.enabled) {
      triggers.push(`Inactivity (${policy.triggers.inactivity.thresholdDays} days)`);
    }
    if (policy.triggers.missedDeadlines?.enabled) {
      triggers.push(`Missed Deadlines (${policy.triggers.missedDeadlines.consecutiveMisses})`);
    }
    if (policy.triggers.policyViolations?.enabled) {
      triggers.push(`Violations (${policy.triggers.policyViolations.thresholdCount})`);
    }
    return triggers.length > 0 ? triggers.join(', ') : 'No triggers configured';
  };

  return (
    <>
      <Card className="border border-border/50 hover:border-primary/30 transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="text-lg font-semibold truncate">{policy.name}</h3>
                <Badge variant={policy.isActive ? "default" : "secondary"}>
                  {policy.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="outline" className={
                  policy.scope === 'platform' 
                    ? 'bg-purple-50 text-purple-700 border-purple-200' 
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }>
                  <Shield className="h-3 w-3 mr-1" />
                  {policy.scope === 'platform' ? 'Platform-wide' : 'Course-specific'}
                </Badge>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Priority: {policy.priority}
                </Badge>
              </div>
              {policy.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{policy.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    disabled={toggleStatus.isPending}
                  >
                    <Power className="h-3 w-3 mr-1" />
                    {policy.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(policy)}
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Triggers</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{getTriggerSummary()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Warning:</span>
                <span className="ml-2 font-medium">{policy.actions?.sendWarning ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Appeals:</span>
                <span className="ml-2 font-medium">
                  {policy.actions?.allowAppeal ? `${policy.actions?.appealDeadlineDays} days` : 'Not allowed'}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              Last updated: {new Date(policy.updatedAt).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Policy"
        description="Are you sure you want to delete this ejection policy? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={deletePolicy.isPending}
        loadingText="Deleting..."
      />
    </>
  );
};