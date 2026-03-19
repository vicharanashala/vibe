import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Plus, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EjectionPolicyModal } from "@/app/pages/teacher/components/ejection-policies/EjectionPolicyModal";
import { EjectionPolicyList } from "@/app/pages/teacher/components/ejection-policies/EjectionPolicyList";
import { useEjectionPolicies } from "@/hooks/ejection-policy-hooks";
import { useAuthStore } from "@/store/auth-store";
import { EjectionPolicy } from "@/types/ejection-policy.types";
import { useSearch } from "@tanstack/react-router";

type EjectionPolicySearchParams = {
  courseId?: string;
  courseVersionId?: string;
  cohortId?: string;
};

export default function EjectionPoliciesPage() {
  const { user } = useAuthStore();
  const searchParams = useSearch({ strict: false }) as EjectionPolicySearchParams;
  const courseIdFromUrl = searchParams.courseId;
  const courseVersionIdFromUrl = searchParams.courseVersionId;
  const cohortIdFromUrl = searchParams.cohortId;

  const hasCourseContext = !!courseIdFromUrl && !!courseVersionIdFromUrl && !!cohortIdFromUrl;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<EjectionPolicy | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const isActiveFilter = activeFilter === 'all' ? undefined : activeFilter === 'active';

  const {
    policies,
    isLoading,
    isAdmin,
  } = useEjectionPolicies(
    courseIdFromUrl,
    courseVersionIdFromUrl,
    cohortIdFromUrl,
    isActiveFilter,
    hasCourseContext,
  );

  const handleCreateClick = () => {
    setEditingPolicy(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (policy: EjectionPolicy) => {
    setEditingPolicy(policy);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPolicy(null);
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>
          <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg"></div>
                    <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                      <Shield className="h-6 w-6 text-primary-foreground" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-foreground">
                      Ejection Policies
                    </h1>
                    <p className="text-muted-foreground mt-1">
                      Manage automated ejection rules for students
                    </p>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <Button
                  onClick={handleCreateClick}
                  className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 h-12 px-8 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="relative flex items-center gap-2">
                    <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                    <span className="font-semibold">Create Policy</span>
                  </div>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-xl blur-sm"></div>
          <div className="relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-4">
            <div className="flex items-center justify-end gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Policies</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Context banner */}
        {hasCourseContext ? (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Showing policies for the selected cohort
            </p>
          </div>
        ) : (
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Ejection policies are cohort-specific. Navigate to a cohort to manage its policies.
            </p>
          </Card>
        )}

        {/* Policy list */}
        <EjectionPolicyList
          policies={policies}
          isLoading={isLoading}
          onEdit={handleEditClick}
          canEdit={isAdmin}
          canDelete={isAdmin}
        />

      </div>

      {/* Create/Edit Modal */}
      <EjectionPolicyModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editPolicy={editingPolicy}
        courseId={courseIdFromUrl}
        courseVersionId={courseVersionIdFromUrl}
        cohortId={cohortIdFromUrl}
        isAdmin={isAdmin}
      />
    </div>
  );
}