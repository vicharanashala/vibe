import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Eye, User, CheckCircle, XCircle, Share2, Check, Copy, Share, RefreshCw, ListChecks, Hash, Calendar, Settings, FileText, Search, X, FilterIcon, Lock, Unlock, Layers, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourseStore } from "@/store/course-store";
import { toast } from "sonner";
import { useBulkUpdateRegistrationStatus, useGetCourseRegistrationRequests, useUpdateRegistrationStatus, useGetRegistrationStatus, useToggleRegistrationStatus, useAutoApprovalSettings, useCourseVersionById } from "@/hooks/hooks";
import { Pagination } from "@/components/ui/Pagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ConfirmationModal from "./components/confirmation-modal";
import { FormBuilder } from "./components/course-registration-modal";
import AutoApprovalModal from "./components/auto-approval-modal";
import CourseBackButton from "./CourseBackButton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface Registration {
  _id: string;
  detail: Record<string, any>;
  status: RegistrationStatus;
  createdAt: string;
}


export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";


export default function CourseRegistrationRequests() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<RegistrationStatus>('ALL');
  const [sortOrder, setSortOrder] = useState<'older' | 'latest'>('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  // for confirmation modal
  const [isSingleApproveOpen, setIsSingleApproveOpen] = useState(false);
  const [isBulkApproveOpen, setIsBulkApproveOpen] = useState(false);
  const [isSingleRejectOpen, setIsSingleRejectOpen] = useState(false);
  const [singleRegistrationId, setSingleRegistrationId] = useState<string | null>(null);
  const [singleCohort,setSingleCohort] = useState<string | null>(null);
  const [isUnsavedChanges, setIsUnsavedChanges] = useState(false);
  const [isRefresh, setIsRefresh] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isAutoApprovalModalOpen, setIsAutoApprovalModalOpen] = useState(false);
  const { currentCourse } = useCourseStore()
  const versionId = currentCourse?.versionId
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [hasAnyRegistrations, setHasAnyRegistrations] = useState(true);
  const shouldFetch = !initialFetchDone || hasAnyRegistrations;
  const [cohort, setCohort] = useState<string | null>(null);
  const { data: courseVersion, isLoading: versionLoading } = useCourseVersionById(versionId || "")


  const PAGE_LIMIT = 15;

  const params = useMemo(() => ({
    status: filterStatus,
    search: searchTerm,
    sort: sortOrder,
    page: currentPage,
    limit: PAGE_LIMIT,
  }), [filterStatus, searchTerm, sortOrder, currentPage]);

 const { data: registrationsData, isLoading, refetch: registrationsRefetch,} = useGetCourseRegistrationRequests(versionId as string, params, shouldFetch);
// console.log("registrationsData---", registrationsData);
  const { data: statusData, refetch: statusRefetch } = useGetRegistrationStatus(versionId as string);
  const { mutateAsync: toggleStatus, isPending: isTogglingStatus } = useToggleRegistrationStatus(versionId as string);
  const { settings: autoApprovalSettings, isLoading: isLoadingAutoApproval, refetch: autoApprovalRefetch } = useAutoApprovalSettings(versionId as string);

  const { mutateAsync: updateStatus, isPending: isUpdatingStatus } = useUpdateRegistrationStatus();
  const { mutateAsync: updateBulkStatus, isPending: isUpdatingBulkStatus } = useBulkUpdateRegistrationStatus();
  const registrations = registrationsData?.registrations || []

  useEffect(() => {
    if (!isAutoApprovalModalOpen) {
      autoApprovalRefetch();
    }
  }, [isAutoApprovalModalOpen, autoApprovalRefetch]);

  const FRONTEND_URL = window.location.origin;
  const registrationUrl = `${FRONTEND_URL}/student/course-registration/${versionId}`;
  const registrationUrlWithCohort = `${FRONTEND_URL}/student/course-registration/${versionId}/${cohort}`;

  const registrationMessage = `🎓 Course Registration - ViBe Platform

Hello,

Register for the course using the link below:

${registrationUrl}`;

  const registrationMessageWithCohort = `🎓 Course Registration - ViBe Platform

Hello,

Register for the course using the link below:

${registrationUrlWithCohort}`;

useEffect(() => {
  const t = setTimeout(() => {
    setSearchTerm(searchInput);
  }, 1000);

  return () => clearTimeout(t);
  }, [searchInput]);

useEffect(() => {
  if (!isLoading && registrationsData && !initialFetchDone) {
    setInitialFetchDone(true);

    const total = registrationsData.totalDocuments ?? 0;
    setHasAnyRegistrations(total > 0);
  }
  }, [isLoading, registrationsData, initialFetchDone]);

  useEffect(() => {
    if (statusData?.isActive !== undefined) {
      setIsActive(statusData.isActive);
    }
  }, [statusData]);


  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, id] : prev.filter(item => item !== id),
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(registrations.filter((reg)=> reg.status=="PENDING" )
      .map(r => r._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkApprove = async () => {
    if (isUpdatingBulkStatus || isUpdatingStatus) return;

    if (!selectedIds || selectedIds.length === 0) {
      toast.error("Please select at least one registration to approve.");
      setTimeout(()=>{
        setIsBulkApproveOpen(false);
      },1000)
      return;
    }

    try {
      await updateBulkStatus(selectedIds);

      toast.success(
        `${selectedIds.length} registration${selectedIds.length > 1 ? 's' : ''} approved successfully`
      );

      setSelectedIds([]);
      registrationsRefetch();
      setIsBulkApproveOpen(false);
    } catch (error: any) {
      toast.error(
        error?.message ||
        'Failed to approve registrations. Please try again.'
      );
    }
  };


  const handleApprove = async (registrationId: string | null, cohort: string) => {
    if (isUpdatingBulkStatus || isUpdatingStatus || !registrationId) return;
    try {
      // console.log("-----in handleapprove----", cohort);
      await updateStatus(registrationId, 'APPROVED', cohort);
      toast.success('Registration approved successfully');
      registrationsRefetch();
      setIsSingleApproveOpen(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve registration. Please try again.');
    } 
  }

  const handleReject = async (registrationId: string | null, cohort: string) => {
    if (isUpdatingBulkStatus || isUpdatingStatus || !registrationId) return;
    try {
      await updateStatus(registrationId, 'REJECTED', cohort);
      toast.success('Registration rejected successfully');
      registrationsRefetch();
      setIsSingleRejectOpen(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to rejected registration. Please try again.');
    }
  }

  const copyRegistrationUrl = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback if failed
      const textArea = document.createElement('textarea');
      textArea.value = registrationUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

    const copyRegistrationUrlWithCohort = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrlWithCohort);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback if failed
      const textArea = document.createElement('textarea');
      textArea.value = registrationUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleRegistration = async () => {
    if (isTogglingStatus) return;

    try {
      const newStatus = !isActive;
      await toggleStatus({
        isActive: newStatus,
      });
      setIsActive(newStatus);
      toast.success(newStatus ? 'Course registration activated successfully' : 'Course registration deactivated successfully');
      statusRefetch();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to toggle registration status. Please try again.');
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleNavigateToRequests = (currentFieldsLength: number, existingFieldsLength: number) => {
    if(currentFieldsLength > existingFieldsLength){
      setIsUnsavedChanges(true);
      return;
    }
    setShowFormBuilder(false);
    setIsUnsavedChanges(false)
  }

  const pendingRegistrations = registrations.filter(
  (item) => item.status === "PENDING"
);


  if (showFormBuilder) {
    return (
      <>
        <FormBuilder versionId={versionId!} handleNavigateToRequests={handleNavigateToRequests}/>
        <ConfirmationModal
          isOpen={isUnsavedChanges}
          onClose={() => setIsUnsavedChanges(false)}
          onConfirm={() => {
            setShowFormBuilder(false);
            setIsUnsavedChanges(false);
          }}
          title="Unsaved Changes"
          description="You have unsaved changes. Are you sure you want to leave without saving? Any unsaved changes will be lost."
          confirmText="Leave"
          cancelText="Stay"
          isDestructive={true} 
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ConfirmationModal
        isOpen={isSingleApproveOpen}
        onClose={() => {
          setIsSingleApproveOpen(false);
          setSingleRegistrationId(null);
          setSingleCohort(null);
        }}
        onConfirm={() => handleApprove(singleRegistrationId, singleCohort)}
        title="Approve Registration"
        description="Are you sure you want to approve this registration? This action cannot be undone."
        confirmText="Approve"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={isUpdatingStatus}
        loadingText={"Approving..."}
      />
    
      <ConfirmationModal
        isOpen={isSingleRejectOpen}
        onClose={() => setIsSingleRejectOpen(false)}
        onConfirm={() => handleReject(singleRegistrationId, singleCohort)}
        title="Reject Registration"
        description="Are you sure you want to reject this registration? This action cannot be undone."
        confirmText="Reject"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isUpdatingStatus}
        loadingText={"Rejecting..."}
      />
      <ConfirmationModal
        isOpen={isBulkApproveOpen}
        onClose={() => setIsBulkApproveOpen(false)}
        onConfirm={() => handleBulkApprove()}
        title="Approve Selected Registrations"
        description={`Are you sure you want to approve ${selectedIds.length} selected registration${selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText={`Approve ${selectedIds.length} Registration${selectedIds.length > 1 ? 's' : ''}`}
        cancelText="Cancel"
        isDestructive={false}
        isLoading={isUpdatingBulkStatus}
        loadingText={"Approving..."}
      />
   

      <div className="container mx-auto py-4 space-y-8">
         <CourseBackButton />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Course Registration Requests
            </h1>
            <p className="text-muted-foreground">
              Review and manage all pending course registration requests.
            </p>
          </div>
          {/* <div className="flex flex-wrap items-center gap-2">
          

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Get Registration URL
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-primary" />
                    Student Registration URL
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                    Share this URL with students to allow them to view available course versions and submit registration requests.
                  </p>
                </DialogHeader>

                <div className="space-y-4 mt-6">
                  <div className="relative">
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Registration URL
                    </label>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-lg">
                      <code className="flex-1 text-sm font-mono text-foreground break-all">
                        {registrationUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyRegistrationUrl}
                        className="h-8 w-8 p-0 flex-shrink-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {copied && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <Check className="h-4 w-4" />
                      URL copied to clipboard successfully!
                    </div>
                  )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-6">

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (navigator.share) {
                          navigator
                            .share({
                              title: "Course Registration - Vibe Platform",
                              text: registrationMessage,
                              // url: registrationUrl,
                            })
                            .catch((err) => console.error("Error sharing:", err));
                        } else {
                          toast.error("Web Share API not supported. Please copy the URL manually.");
                        }
                      }}
                      className="flex items-center gap-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <Share className="h-4 w-4" />
                      <span>Share Link</span>
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              onClick={() => setIsBulkApproveOpen(true)}
              disabled={isUpdatingBulkStatus || isUpdatingStatus}
              variant="outline"
              className={`
                hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-700 transition-colors
              `}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {(!selectedIds || selectedIds.length === 0)
                ? "Approve All"
                : `Approve Selected (${selectedIds.length})`}
            </Button>

      
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowFormBuilder(true)}
            >
              <FileText  className="h-4 w-4" />
              Build Form
            </Button>

            <Button
              variant="outline"
              onClick={() =>{
                setIsRefresh(true)
                setTimeout(()=> {
                  setIsRefresh(false);
                },2000)
                registrationsRefetch()}}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${(isLoading || isRefresh) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div> */}
          <RegistrationActions
            registrationUrl={registrationUrl}
            registrationMessage={registrationMessage}
            copyRegistrationUrl={copyRegistrationUrl}
            registrationUrlWithCohort={registrationUrlWithCohort}
            registrationMessageWithCohort={registrationMessageWithCohort}
            copyRegistrationUrlWithCohort={copyRegistrationUrlWithCohort}
            copied={copied}
            selectedIds={selectedIds}
            isUpdatingBulkStatus={isUpdatingBulkStatus}
            isUpdatingStatus={isUpdatingStatus}
            isLoading={isLoading}
            registrationsRefetch={registrationsRefetch}
            setIsBulkApproveOpen={setIsBulkApproveOpen}
            setShowFormBuilder={setShowFormBuilder}
            isActive={isActive}
            handleToggleRegistration={handleToggleRegistration}
            isTogglingStatus={isTogglingStatus}
            courseVersion={courseVersion}
            cohort={cohort}
            setCohort={setCohort}
            setIsAutoApprovalModalOpen={setIsAutoApprovalModalOpen}
          />
        </div>
          <AutoApprovalModal
            isOpen={isAutoApprovalModalOpen}
            onOpenChange={setIsAutoApprovalModalOpen}
            versionId={versionId!}
            currentSettings={autoApprovalSettings}
            courseVersion={courseVersion}
          />
        {/* <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Search size={20} />
            </span>

            <Input
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-10" 
            />

            {searchTerm && (
              <Button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform bg-transparent hover:bg-transparent -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </Button>
            )}
          </div>

         <Select
            value={filterStatus}
            onValueChange={(value) => {
              setFilterStatus(value as RegistrationStatus);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilterIcon className="w-4 h-4 text-gray-500" />
                <SelectValue placeholder="Filter by status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortOrder}
            onValueChange={(value) => {
              setSortOrder(value as "older" | "latest");
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 6h18M3 12h18M3 18h18"
                  />
                </svg>

                <SelectValue placeholder="Sort by date" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="older">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div> */}
        <RegistrationFilters
          searchTerm={searchInput}
          setSearchTerm={setSearchInput}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          setCurrentPage={setCurrentPage}
        />

        {/* Table */}
        <Card className="border-0 shadow-lg overflow-hidden min-h-[50vh]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    <TableHead className="w-[40px] pl-6">
                      <Checkbox
                        checked={
                            pendingRegistrations.length > 0 &&
                            selectedIds.length === pendingRegistrations.length
                          }
                          disabled={pendingRegistrations.length === 0}
                          onCheckedChange={(checked) =>
                            handleSelectAll(checked === true)
                       }
                        
                      />
                    </TableHead>

                    <TableHead className="font-bold text-foreground w-[60px]">
                      <span className="inline-flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground w-[200px]">
                      <span className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Name
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground w-[250px]">
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Registered At
                      </span>
                    </TableHead>
                    
                    {courseVersion?.cohortDetails?.length > 0 &&
                    <TableHead className="font-bold text-foreground w-[250px]">
                      <span className="inline-flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        Cohort Name
                      </span>
                    </TableHead>}

                    <TableHead className="font-bold text-foreground w-[150px]">
                      <span className="inline-flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-muted-foreground" />
                        Status
                      </span>
                    </TableHead>

                    <TableHead className="font-bold text-foreground pr-6 w-[250px]">
                      <span className="inline-flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        Actions
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(isLoading || isRefresh) ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-muted-foreground">
                            Loading registrations...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : registrations?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <Users className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <p className="text-foreground text-xl font-semibold mb-2">
                          No Registrations Found
                        </p>
                        <p className="text-muted-foreground">
                          There are no course registration requests yet.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrations?.map((reg: Registration, index: number) => (
                      <TableRow
                        key={reg._id}
                        className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                      >

                        <TableCell className="pl-6 py-4">
                          <Checkbox
                            checked={selectedIds.includes(reg._id)}
                            disabled={reg.status !== "PENDING"}
                            onCheckedChange={checked =>
                              handleSelectRow(reg._id, checked === true)
                            }
                          />
                        </TableCell>

                        <TableCell className="py-4">
                          {index + 1 + (currentPage - 1) * PAGE_LIMIT}
                        </TableCell>

                        <TableCell className="py-4 font-medium">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-md group-hover:border-primary/40 transition-colors duration-200">
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg">
                                {(() => {
                                  const detail = reg.detail || {};
                                  const key = Object.keys(detail).find(k => k.toLowerCase().includes("name"));
                                  const value = key ? detail[key] : null;

                                  if (typeof value === "string" && value.trim()) {
                                    return value
                                      .split(" ")
                                      .map((part) => part[0]?.toUpperCase())
                                      .join("");
                                  }

                                  return "?";
                                })()}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate text-base md:text-lg">
                                {(() => {
                                  const detail = reg.detail || {};
                                  const key = Object.keys(detail).find(k => k.toLowerCase().includes("name"));
                                  return key ? detail[key] : "Unknown User";
                                })()}
                              </p>

                              {reg.detail.email || reg.detail.Email && (
                                <p className="text-xs md:text-sm text-muted-foreground truncate mt-1">
                                  {reg.detail.email || reg.detail.Email}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      
                        <TableCell className="py-4">
                          {reg.createdAt ? (
                            <div className="flex flex-col">
                              <span>
                                {new Date(reg.createdAt).toLocaleDateString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                })}
                              </span>

                              <span className="text-xs text-gray-500">
                                {new Date(reg.createdAt).toLocaleTimeString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        {courseVersion?.cohorts?.length > 0 &&
                        <TableCell className="py-4">
                            {reg.cohortName}
                        </TableCell>}


                        <TableCell className="py-4">
                          <Badge
                            variant={
                              reg.status === "APPROVED"
                                ? "default"
                                : reg.status === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {reg.status.charAt(0).toUpperCase() + reg.status.slice(1).toLowerCase()}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-4 pr-6">
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRegistration(reg)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>

                            {reg.status === "PENDING" && (
                              <>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setSingleRegistrationId(reg._id);
                                    setSingleCohort(reg.cohortId)
                                    setIsSingleApproveOpen(true);
                                  }}
                                  className="bg-green-500 dark:bg-green-300 hover:dark:bg-green-500 hover:bg-green-700 text-white dark:text-black"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>

                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setSingleRegistrationId(reg._id);
                                    setIsSingleRejectOpen(true);
                                  }
                                  }
                                  className="bg-red-500 dark:bg-red-300 hover:dark:bg-red-500 hover:bg-red-700 text-white dark:text-black"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {registrationsData?.totalDocuments > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={registrationsData?.totalPages}
            totalDocuments={registrationsData?.totalDocuments}
            onPageChange={handlePageChange}
          />
        )}

        {selectedRegistration && (
          // <Dialog
          //   open={!!selectedRegistration}
          //   onOpenChange={() => setSelectedRegistration(null)}
          // >
          //   <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto py-8">
          //     <DialogHeader className="pb-4">
          //       <DialogTitle className="flex items-center gap-2 text-xl">
          //         <User className="h-5 w-5 text-primary" />
          //         Registration Details
          //       </DialogTitle>
          //     </DialogHeader>

          //     <div className="space-y-4"> 
          //       <Card>
          //         <CardContent className="p-6"> 
          //           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          //             {Object.entries(selectedRegistration.detail).map(([key, value]) => (
          //               <div key={key}> 
          //                 <span className="font-medium capitalize">{key}:</span>{' '}
          //                 {value as string}
          //               </div>
          //             ))}
          //           </div>
          //           <Separator className="my-4" />
          //           <p className="text-sm text-muted-foreground">
          //             Registered on:{' '}
          //             {new Date(
          //               selectedRegistration.createdAt,
          //             ).toLocaleDateString('en-US', {
          //               month: 'short',
          //               day: 'numeric',
          //               year: 'numeric',
          //             })}
          //           </p>
          //         </CardContent>
          //       </Card>
          //     </div>
          //   </DialogContent>
          // </Dialog>
          <RegistrationDetailsDialog
            registration={selectedRegistration}
            onClose={() => setSelectedRegistration(null)}
          />
        )}
      </div>

    </div>
  );
}


interface RegistrationDetailsDialogProps {
  registration: Registration | null;
  onClose: () => void;
}

const formatKey = (key: string) => {
  return key
    .replace(/([A-Z])/g, " $1") 
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (str) => str.toUpperCase());
};

export function RegistrationDetailsDialog({
  registration,
  onClose,
}: RegistrationDetailsDialogProps) {
  if (!registration) return null;

  return (
    <Dialog open={!!registration} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto py-8">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-primary" />
            Registration Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {Object.entries(registration.detail).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {formatKey(key)}
                    </span>
                    {typeof value === "boolean" ? (
                          <Checkbox checked={value} disabled />
                        ) : (
                          <span className="font-medium break-words">
                            {String(value)}
                          </span>
                        )
                    }
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <p className="text-sm text-muted-foreground">
                Registered on:{" "}
                {new Date(registration.createdAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RegistrationActionsProps {
  registrationUrl: string;
  registrationUrlWithCohort: string;
  registrationMessage: string;
  registrationMessageWithCohort: string;
  copyRegistrationUrl: () => void;
  copyRegistrationUrlWithCohort:()=>void;
  copied: boolean;
  selectedIds: string[] | undefined;
  isUpdatingBulkStatus: boolean;
  isUpdatingStatus: boolean;
  isLoading: boolean;
  registrationsRefetch: () => void;
  setIsBulkApproveOpen: (val: boolean) => void;
  setShowFormBuilder: (val: boolean) => void;
  isActive: boolean;
  handleToggleRegistration: () => void;
  isTogglingStatus: boolean;
  courseVersion: any;
  cohort: string;
  setCohort : React.Dispatch<React.SetStateAction<string>>;
  setIsAutoApprovalModalOpen: (val: boolean) => void;
}

export const RegistrationActions = ({
  registrationUrl,
  registrationUrlWithCohort,
  registrationMessage,
  registrationMessageWithCohort,
  copyRegistrationUrl,
  copyRegistrationUrlWithCohort,
  copied,
  selectedIds,
  isUpdatingBulkStatus,
  isUpdatingStatus,
  isLoading,
  registrationsRefetch,
  setIsBulkApproveOpen,
  setShowFormBuilder,
  isActive,
  handleToggleRegistration,
  isTogglingStatus,
  courseVersion,
  cohort,
  setCohort,
  setIsAutoApprovalModalOpen,
}: RegistrationActionsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefresh, setIsRefresh] = useState(false);

  return (
    <div className="flex items-center gap-2 justify-end">
      {/* Refresh stays visible */}
      <Button
        variant="outline"
        onClick={() => {
          setIsRefresh(true);
          setTimeout(() => setIsRefresh(false), 2000);
          registrationsRefetch();
        }}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${(isLoading || isRefresh) ? "animate-spin" : ""}`} />
        Refresh
      </Button>

      {/* ⋮ Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">

          <DropdownMenuItem onSelect={() => setIsOpen(true)}>
            <Share2 className="h-4 w-4 mr-2" />
            Get Registration URL
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => setIsBulkApproveOpen(true)}
            disabled={!selectedIds || selectedIds.length === 0}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {(!selectedIds || selectedIds.length === 0)
              ? "Approve Selected"
              : `Approve Selected (${selectedIds.length})`}
          </DropdownMenuItem>

          {!(courseVersion?.cohortDetails?.length > 0) && (
            <DropdownMenuItem
              onSelect={handleToggleRegistration}
              disabled={isTogglingStatus}
            >
              {isTogglingStatus ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isActive ? (
                <Lock className="h-4 w-4 mr-2" />
              ) : (
                <Unlock className="h-4 w-4 mr-2" />
              )}
              {isActive ? "Pause registrations" : "Resume registrations"}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onSelect={() => setShowFormBuilder(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Build Form
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setIsAutoApprovalModalOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configure Auto Approval
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>

      {/* Registration URL Dialog — controlled via state */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-w-sm max-[425px]:w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-3">
              <Share2 className="h-5 w-5 text-primary" />
              <div className="xl:text-lg lg:text-sm text-base">Student Registration URL</div>
            </DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2 text-start">
              Share this URL with students to allow them to view available course versions and submit registration requests.
            </p>
          </DialogHeader>

          {courseVersion?.cohorts?.length > 0 && (
            <DropdownMenu>
              <span className="mr-4">Cohort Name:</span>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="mt-2 px-3 py-2 text-sm w-[30%]">
                  {cohort ? courseVersion.cohortDetails.find(c => c.id === cohort)?.name : "Select Cohort"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup
                  value={cohort ?? ""}
                  onValueChange={(value) => setCohort(value)}
                >
                  {courseVersion?.cohortDetails?.map((cohort) => (
                    <DropdownMenuRadioItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {(!courseVersion?.cohortDetails?.length || cohort) && (
            <div className="space-y-4 mt-6">
              <div className="relative">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Registration URL
                </label>
                <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-lg">
                  <code className="flex-1 text-sm font-mono text-foreground break-all">
                    {courseVersion?.cohortDetails?.length > 0 ? registrationUrlWithCohort : registrationUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={courseVersion?.cohortDetails?.length > 0 ? copyRegistrationUrlWithCohort : copyRegistrationUrl}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {copied && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <Check className="h-4 w-4" />
                  URL copied to clipboard successfully!
                </div>
              )}
            </div>
          )}

          {(!courseVersion?.cohortDetails?.length || cohort) && (
            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: "Course Registration - Vibe Platform",
                        text: courseVersion?.cohortDetails?.length > 0 ? registrationMessageWithCohort : registrationMessage,
                      }).catch((err) => console.error("Error sharing:", err));
                    } else {
                      toast.error("Web Share API not supported. Please copy the URL manually.");
                    }
                  }}
                  className="flex items-center gap-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <Share className="h-4 w-4" />
                  <span>Share Link</span>
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RegistrationFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  filterStatus: RegistrationStatus;
  setFilterStatus: (val: RegistrationStatus) => void;
  sortOrder: "older" | "latest";
  setSortOrder: (val: "older" | "latest") => void;
  setCurrentPage: (page: number) => void;
}

export function RegistrationFilters({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  sortOrder,
  setSortOrder,
  setCurrentPage,
}: RegistrationFiltersProps) {
  return (
    <div className="flex flex-col lg:flex-row md:items-center gap-4 mb-4">
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <Search size={20} />
        </span>

        <Input
          placeholder="Search by name or email…"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-10"
        />

        {searchTerm && (
          <Button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 transform bg-transparent hover:bg-transparent -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </Button>
        )}
      </div>
      <div className="flex gap-4">
      <Select
        value={filterStatus}
        onValueChange={(value: RegistrationStatus) => {
          setFilterStatus(value);
          setCurrentPage(1);
        }}
      >
        <SelectTrigger className="w-[180px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-gray-500" />
            <SelectValue placeholder="Filter by status" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="APPROVED">Approved</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={sortOrder}
        onValueChange={(value) => {
          setSortOrder(value as "older" | "latest");
          setCurrentPage(1);
        }}
      >
        <SelectTrigger className="w-[180px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 6h18M3 12h18M3 18h18"
              />
            </svg>

            <SelectValue placeholder="Sort by date" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="latest">Latest</SelectItem>
          <SelectItem value="older">Oldest</SelectItem>
        </SelectContent>
      </Select>
      </div>
    </div>
  );
}