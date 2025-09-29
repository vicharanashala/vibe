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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Eye, User, CheckCircle, XCircle, Share2, Check, Copy, ExternalLink, Share, RefreshCw, Settings, ListChecks, Mail, Hash, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourseStore } from "@/store/course-store";
import { toast } from "sonner";
import { RegistrationRequestQuery, useBulkUpdateRegistrationStatus, useGetCourseRegistrationRequests, useUpdateRegistrationFields, useUpdateRegistrationStatus } from "@/hooks/hooks";
import { Pagination } from "@/components/ui/Pagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ConfirmationModal from "./components/confirmation-modal";
import { RegistrationSettingsDialog } from "./components/course-registration-modal";


interface RegistrationDetail {
  name: string;
  email: string;
  mobile: string;
  gender: string;
  city: string;
  state: string;
  category: string;
  university: string;
}

export interface Registration {
  _id: string;
  detail: RegistrationDetail;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}


export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";


export default function CourseRegistrationRequests() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<RegistrationStatus>('ALL');
  const [sortOrder, setSortOrder] = useState<'older' | 'latest'>('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  // for confirmation modal
  const [isSingleApproveOpen, setIsSingleApproveOpen] = useState(false);
  const [isBulkApproveOpen, setIsBulkApproveOpen] = useState(false);
  const [isSingleRejectOpen, setIsSingleRejectOpen] = useState(false);
  const [singleRegistrationId, setSingleRegistrationId] = useState<string | null>(null);

  const { currentCourse } = useCourseStore()
  const versionId = currentCourse?.versionId

  const PAGE_LIMIT = 15;

  const params = useMemo(() => ({
    filter: filterStatus,
    search: searchTerm,
    sort: sortOrder,
    page: currentPage,
    limit: PAGE_LIMIT,
  }), [filterStatus, searchTerm, sortOrder, currentPage]);
  const { data: registrationsData, isLoading, refetch: registrationsRefetch } = useGetCourseRegistrationRequests(versionId as string, params);
  const { mutateAsync: updateStatus, isPending: isUpdatingStatus } = useUpdateRegistrationStatus();
  const { mutateAsync: updateBulkStatus, isPending: isUpdatingBulkStatus } = useBulkUpdateRegistrationStatus();
  const { mutateAsync: updateFields, isPending:isUpdatingFields } = useUpdateRegistrationFields()
  const registrations = registrationsData?.registrations || []

  const FRONTEND_URL = window.location.origin;
  const registrationUrl = `${FRONTEND_URL}/student/course-registration/${versionId}`;

  const registrationMessage = `🎓 Course Registration - ViBe Platform

Hello,

Register for the course using the link below:

${registrationUrl}`;


  useEffect(() => {
    registrationsRefetch();
  }, [params, registrationsRefetch]);

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, id] : prev.filter(item => item !== id),
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(registrations.map(r => r._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkApprove = async () => {
    if (isUpdatingBulkStatus || isUpdatingStatus) return;

    const idsToApprove = selectedIds && selectedIds.length > 0 ? selectedIds : [];

    try {
      await updateBulkStatus(idsToApprove);

      const successMessage =
        idsToApprove.length > 0
          ? 'Selected registrations approved successfully'
          : 'All registrations approved successfully';

      toast.success(successMessage);

      if (idsToApprove.length > 0) setSelectedIds([]);

      registrationsRefetch();
    } catch (error: any) {
      toast.error(
        error?.message ||
        'Failed to approve registrations. Please try again.'
      );
    }
  };


  const handleApprove = async (registrationId: string | null) => {
    if (isUpdatingBulkStatus || isUpdatingStatus || !registrationId) return;
    try {
      await updateStatus(registrationId, 'APPROVED');
      toast.success('Registration approved successfully');
      registrationsRefetch();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve registration. Please try again.');
    }
  }

  const handleReject = async (registrationId: string | null) => {
    if (isUpdatingBulkStatus || isUpdatingStatus || !registrationId) return;
    try {
      await updateStatus(registrationId, 'REJECTED');
      toast.success('Registration rejected successfully');
      registrationsRefetch();
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

  const handleSave = async (fields) => {
    const processedFields = fields.map((f) => ({
      label:f.label,
      type:f.type,
      required:f.required,
      options:f.options ?? []
    }))
    try {
      await updateFields(versionId as string,processedFields)
      toast.success('Custom fields saved successfully!');
      setIsCustomOpen(false)
      registrationsRefetch()
    } catch (error:any) {
      toast.error(error?.message || 'Failed to save fields. Please try again.')
    }
  }


  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };


  return (
    <div className="min-h-screen bg-background">
      <ConfirmationModal
        isOpen={isSingleApproveOpen}
        onClose={() => {
          setIsSingleApproveOpen(false);
          setSingleRegistrationId(null)
        }}
        onConfirm={() => handleApprove(singleRegistrationId)}
        title="Approve Registration"
        description="Are you sure you want to approve this registration? This action cannot be undone."
        confirmText="Approve"
        cancelText="Cancel"
        isDestructive={false}
      />
      <ConfirmationModal
        isOpen={isSingleRejectOpen}
        onClose={() => setIsSingleRejectOpen(false)}
        onConfirm={() => handleReject(singleRegistrationId)}
        title="Reject Registration"
        description="Are you sure you want to reject this registration? This action cannot be undone."
        confirmText="Reject"
        cancelText="Cancel"
        isDestructive={true}
      />
      <ConfirmationModal
        isOpen={isBulkApproveOpen}
        onClose={() => setIsBulkApproveOpen(false)}
        onConfirm={() => handleBulkApprove()}
        title="Approve All Registrations"
        description="Are you sure you want to approve all selected registrations? This action cannot be undone."
        confirmText="Approve All"
        cancelText="Cancel"
        isDestructive={false}
      />
      <div className="container mx-auto py-4 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Course Registration Requests
            </h1>
            <p className="text-muted-foreground">
              Review and manage all pending course registration requests.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsCustomOpen(true)}
            >
              <Share2 className="h-4 w-4" />
              Create Custom Fields
            </Button>

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
              onClick={() => registrationsRefetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full"
            />
          </div>

          {/* <Select
            value={filterStatus}
            onValueChange={value => {
              setFilterStatus(value as RegistrationStatus);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select> */}

          <Select
            value={sortOrder}
            onValueChange={value => {
              setSortOrder(value as 'older' | 'latest');
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="older">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    <TableHead className="w-[40px] pl-6">
                      <Checkbox
                        checked={
                          selectedIds?.length === registrations?.length &&
                          registrations?.length > 0
                        }
                        onCheckedChange={checked =>
                          handleSelectAll(checked as boolean)
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
                  {isLoading ? (
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
                    registrations?.map((reg: any, index: number) => (
                      <TableRow
                        key={reg._id}
                        className="border-border hover:bg-muted/20 transition-colors duration-200 group"
                      >

                        <TableCell className="pl-6 py-4">
                          <Checkbox
                            checked={selectedIds.includes(reg._id)}
                            onCheckedChange={checked =>
                              handleSelectRow(reg._id, checked as boolean)
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
                                {reg.detail.name
                                  ? reg.detail.name
                                    .split(" ")
                                    .map((part: string) => part[0]?.toUpperCase())
                                    .join("")
                                  : "?"}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate text-base md:text-lg">
                                {reg.detail.name || "Unknown User"}
                              </p>

                              {reg.detail.email && (
                                <p className="text-xs md:text-sm text-muted-foreground truncate mt-1">
                                  {reg.detail.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {/* { 
                        <TableCell className="py-4">
                          {reg.createdAt
                            ? new Date(reg.createdAt).toLocaleDateString("en-US")
                            : "-"}
                        </TableCell>
                        } */}


                        <TableCell className="py-4">
                          {reg.createdAt ? (
                            <div className="flex flex-col">
                              {/* Date */}
                              <span>
                                {new Date(reg.createdAt).toLocaleDateString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                })}
                              </span>

                              {/* Time */}
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
                  {selectedRegistration && (
                    <Dialog
                      open={!!selectedRegistration}
                      onOpenChange={() => setSelectedRegistration(null)}
                    >
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
                                <div>
                                  <span className="font-medium">Name:</span>{' '}
                                  {selectedRegistration.detail.name}
                                </div>
                                <div>
                                  <span className="font-medium">Email:</span>{' '}
                                  {selectedRegistration.detail.email}
                                </div>
                                <div>
                                  <span className="font-medium">Mobile:</span>{' '}
                                  {selectedRegistration.detail.mobile}
                                </div>
                                <div>
                                  <span className="font-medium">Gender:</span>{' '}
                                  {selectedRegistration.detail.gender}
                                </div>
                                <div>
                                  <span className="font-medium">City:</span>{' '}
                                  {selectedRegistration.detail.city}
                                </div>
                                <div>
                                  <span className="font-medium">State:</span>{' '}
                                  {selectedRegistration.detail.state}
                                </div>
                                <div>
                                  <span className="font-medium">Category:</span>{' '}
                                  {selectedRegistration.detail.category}
                                </div>
                                <div>
                                  <span className="font-medium">
                                    University:
                                  </span>{' '}
                                  {selectedRegistration.detail.university}
                                </div>
                              </div>
                              <Separator className="my-4" />
                              <p className="text-sm text-muted-foreground">
                                Registered on:{' '}
                                {new Date(
                                  selectedRegistration.createdAt,
                                ).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </DialogContent>
                    </Dialog>
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

        <RegistrationSettingsDialog
          open={isCustomOpen}
          onOpenChange={setIsCustomOpen}
          onSave={handleSave}
          versionId={versionId as string}
        />
      </div>
    </div>
  );
}

