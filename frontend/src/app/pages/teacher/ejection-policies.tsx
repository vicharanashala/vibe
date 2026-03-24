import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Plus, Filter, Loader2, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EjectionPolicyModal } from "@/app/pages/teacher/components/ejection-policies/EjectionPolicyModal";
import { EjectionPolicyList } from "@/app/pages/teacher/components/ejection-policies/EjectionPolicyList";
import { EjectionStudentList } from "@/app/pages/teacher/components/ejection-policies/EjectionStudentList";
import EjectionHistoryTab from "@/app/pages/teacher/components/ejection-policies/EjectionHistoryTab";
import { useEjectionPolicies } from "@/hooks/ejection-policy-hooks";
import { useCourseVersionCohorts } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { EjectionPolicy } from "@/types/ejection-policy.types";

export default function EjectionPoliciesPage() {
  const { currentCourse } = useCourseStore();
  const courseId = currentCourse?.courseId;
  const versionId = currentCourse?.versionId;

  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"policies" | "students" | "history">("policies");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<EjectionPolicy | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  // Fetch cohorts for this course version
  const {
    data: cohortsData,
    isLoading: cohortsLoading,
  } = useCourseVersionCohorts(
    courseId,
    versionId ?? "",
    1,
    100,
    "",
    "name",
    "asc",
  );

  const cohorts: any[] = cohortsData?.cohorts ?? [];
  const selectedCohort = cohorts.find((c: any) => c.id === selectedCohortId);

  const isActiveFilter =
    activeFilter === "all" ? undefined : activeFilter === "active";

  const hasCourseContext = !!courseId && !!versionId && !!selectedCohortId;
  const hasMinimumContext = !!courseId && !!versionId;

  // Separate call just to resolve isAdmin — fires as soon as course+version available
  const { isAdmin } = useEjectionPolicies(
    courseId,
    versionId ?? undefined,
    undefined,
    undefined,
    hasMinimumContext,
  );

  // Policy list — only fires once cohort is selected
  const {
    policies,
    isLoading: policiesLoading,
  } = useEjectionPolicies(
    courseId,
    versionId ?? undefined,
    selectedCohortId ?? undefined,
    isActiveFilter,
    hasCourseContext,
  );

  // Unfiltered policies to check if any policy exists for the cohort
  const {
    policies: allPoliciesForCohort,
  } = useEjectionPolicies(
    courseId,
    versionId ?? undefined,
    selectedCohortId ?? undefined,
    undefined,
    hasCourseContext,
  );

  const hasExistingPolicy = allPoliciesForCohort.length > 0;

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

  // No course context in store
  if (!courseId || !versionId) {
    return (
      <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-6xl mx-auto">
          <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 p-8 text-center">
            <Shield className="h-10 w-10 text-yellow-600 mx-auto mb-3" />
            <p className="text-yellow-800 dark:text-yellow-200 font-medium">
              No course selected
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Navigate to a course version and click "Ejection Policies" to manage policies.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl" />
          <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg" />
                  <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                    <Shield className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Ejection Policies
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Manage ejection rules and student status
                  </p>
                </div>
              </div>

              {/* Create button — only on policies tab, only admins, only when cohort selected, and only if no policy exists */}
              {isAdmin && selectedCohortId && activeTab === "policies" && !hasExistingPolicy && (
                <Button
                  onClick={handleCreateClick}
                  className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 h-12 px-8 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <div className="relative flex items-center gap-2">
                    <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                    <span className="font-semibold">Create Policy</span>
                  </div>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Cohort selector */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-xl blur-sm" />
          <div className="relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              {cohortsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading cohorts...
                </div>
              ) : cohorts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No cohorts found. Create cohorts first via "Configure Cohorts".
                </p>
              ) : (
                <Select
                  value={selectedCohortId ?? ""}
                  onValueChange={(val) => {
                    setSelectedCohortId(val);
                    setActiveTab("policies");
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select a cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((cohort: any) => (
                      <SelectItem key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* No cohort selected placeholder */}
        {!selectedCohortId ? (
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-8 text-center">
            <p className="text-blue-800 dark:text-blue-200 font-medium">
              Select a cohort above to view or manage its ejection policies and students.
            </p>
          </Card>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "policies" | "students" | "history")}
          >
            {/* Tab bar + filter */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList className="h-11 bg-muted/40 backdrop-blur-sm border border-border/50 p-1 rounded-xl">
                <TabsTrigger
                  value="policies"
                  className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm px-6"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Policies
                </TabsTrigger>
                <TabsTrigger
                  value="students"
                  className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm px-6"
                >
                  Students
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm px-6"
                >
                  History
                </TabsTrigger>
              </TabsList>

              {/* Filter — only on policies tab */}
              {activeTab === "policies" && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={activeFilter}
                    onValueChange={(v) => setActiveFilter(v as any)}
                  >
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
              )}
            </div>

            {/* Policies tab */}
            <TabsContent value="policies" className="mt-4">
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Showing policies for cohort:{" "}
                  <strong>{selectedCohort?.name}</strong>
                </p>
              </div>
              <EjectionPolicyList
                policies={policies}
                isLoading={policiesLoading}
                onEdit={handleEditClick}
                canEdit={isAdmin}
                canDelete={isAdmin}
              />
            </TabsContent>

            {/* Students tab */}
            <TabsContent value="students" className="mt-4">
              <EjectionStudentList
                courseId={courseId}
                courseVersionId={versionId}
                cohortId={selectedCohortId}
                cohortName={selectedCohort?.name ?? ""}
              />
            </TabsContent>

            {/* History tab */}
            <TabsContent value="history" className="mt-4">
              <EjectionHistoryTab
                courseId={courseId}
                versionId={versionId}
                cohortId={selectedCohortId as string}
                onBack={() => setActiveTab("policies")}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Create/Edit Modal */}
      <EjectionPolicyModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editPolicy={editingPolicy}
        courseId={courseId}
        courseVersionId={versionId ?? undefined}
        cohortId={selectedCohortId ?? undefined}
        isAdmin={isAdmin}
      />
    </div>
  );
}