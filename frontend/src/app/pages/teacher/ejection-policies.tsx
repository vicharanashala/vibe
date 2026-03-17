import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Plus, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EjectionPolicyModal } from "@/app/pages/teacher/components/ejection-policies/EjectionPolicyModal";
import { EjectionPolicyList } from "@/app/pages/teacher/components/ejection-policies/EjectionPolicyList";
import { useEjectionPolicies } from "@/hooks/ejection-policy-hooks";
import { useAuthStore } from "@/store/auth-store";
import { PolicyScope, EjectionPolicy } from "@/types/ejection-policy.types";
import { useSearch } from "@tanstack/react-router";

export default function EjectionPoliciesPage() {
  const { user } = useAuthStore();
  const searchParams = useSearch({ strict: false });
  const courseIdFromUrl = searchParams.courseId as string | undefined;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<EjectionPolicy | null>(null);
  const [activeTab, setActiveTab] = useState<'platform' | 'course'>(
    courseIdFromUrl ? 'course' : 'platform'
  );
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');



  // Fetch policies based on active tab and filters
  const isActiveFilter = activeFilter === 'all' ? undefined : activeFilter === 'active';
  
  const {
  policies: platformPolicies,
  isLoading: platformLoading,
  isAdmin: platformIsAdmin
} = useEjectionPolicies(
  PolicyScope.PLATFORM,
  undefined,
  isActiveFilter
);
console.log('platformIsAdmin', platformIsAdmin);


const {
  policies: coursePolicies,
  isLoading: courseLoading,
  isAdmin: courseIsAdmin
} = useEjectionPolicies(
  PolicyScope.COURSE,
  courseIdFromUrl,
  isActiveFilter,
  !!courseIdFromUrl

);
console.log('courseIsAdmin', courseIsAdmin);

  // Check if user is admin
  const isAdmin = platformIsAdmin;

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
{isAdmin &&(
              <Button
                onClick={handleCreateClick}
                disabled={!isAdmin && activeTab === 'platform'}
                className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] hover:bg-[length:100%_auto] shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 h-12 px-8 group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <div className="relative flex items-center gap-2">
                  <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                  <span className="font-semibold">Create Policy</span>
                </div>
              </Button>)}
            </div>
          </div>
        </div>

        {/* Filters and Tabs */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-muted/20 to-muted/10 rounded-xl blur-sm"></div>
          <div className="relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'platform' | 'course')} className="w-full md:w-auto">
             <TabsList
  className={`grid w-full md:w-[400px] ${
    courseIdFromUrl ? "grid-cols-2" : "grid-cols-1"
  } h-11 bg-muted/40 backdrop-blur-sm border border-border/50 p-1 rounded-xl`}
>
                  <TabsTrigger
                    value="platform"
                    className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Platform Policies
                  </TabsTrigger>
                  {courseIdFromUrl && (
                  <TabsTrigger
                    value="course"
                    className="rounded-lg text-sm font-semibold text-muted-foreground transition-all duration-200 data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    Course Policies
                  </TabsTrigger>)}
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
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
        </div>

        {/* Policy Lists */}
        <Tabs value={activeTab} className="space-y-6">
          <TabsContent value="platform" className="mt-0">
            {!isAdmin && (
              <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 p-4 mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Platform-wide policies apply to all courses. 
                </p>
              </Card>
            )}
            
            <EjectionPolicyList
              policies={platformPolicies}
              isLoading={platformLoading}
              onEdit={handleEditClick}
              canEdit={platformIsAdmin}
              canDelete={platformIsAdmin}
            />
          </TabsContent>

          <TabsContent value="course" className="mt-0">
            {courseIdFromUrl ? (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Showing policies for the selected course
                </p>
              </div>
            ) : (
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-4 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Course policies are shown when viewing from a specific course page.
                  Go to a course to create course-specific policies.
                </p>
              </Card>
            )}

            <EjectionPolicyList
              policies={coursePolicies}
              isLoading={courseLoading}
              onEdit={handleEditClick}
              canEdit={true}
              canDelete={true}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Modal */}
      <EjectionPolicyModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editPolicy={editingPolicy}
        defaultScope={activeTab === 'platform' ? PolicyScope.PLATFORM : PolicyScope.COURSE}
        courseId={courseIdFromUrl}
        isAdmin={isAdmin}
      />
    </div>
  );
}