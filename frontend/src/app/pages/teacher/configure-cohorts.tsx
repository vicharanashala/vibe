"use client"

import { useEffect, useState } from "react"
import { Loader2, ArrowUp, ArrowDown, Plus, Pencil, Trash, Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCourseStore } from "@/store/course-store"

import {
  useCreateCohort,
  useUpdateCohort,
  useDeleteCohort,
  useCourseVersionCohorts
} from "@/hooks/hooks"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { AnnouncementType } from "@/types/announcement.types"
import { AnnouncementModal } from "@/components/announcements/AnnouncementModal"

export default function ConfigureCohorts() {

  const { currentCourse } = useCourseStore()
  const courseId = currentCourse?.courseId
  const versionId = currentCourse?.versionId
  const createMutation = useCreateCohort()
  const updateMutation = useUpdateCohort()
  const deleteMutation = useDeleteCohort()
  const [sortBy, setSortBy] =
    useState<"name" | "createdAt" | "updatedAt">("createdAt")
  const [sortOrder, setSortOrder] =
    useState<"asc" | "desc">("asc")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [cohortName, setCohortName] = useState("")
  const [selectedCohort, setSelectedCohort] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isPublicDialogOpen, setIsPublicDialogOpen] = useState(false)
  const [targetCohort, setTargetCohort] = useState<any>(null)
  const [nextPublicState, setNextPublicState] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [selectedCohortForAnnouncement, setSelectedCohortForAnnouncement] = useState<any>(null)

  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      // Reset to first page when search term changes
      setCurrentPage(1);
      setDebouncedSearch(searchQuery);
      setIsSearching(false);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

    const {
      data: cohortsData,
      isLoading: isLoading,
      error: cohortsError,
      refetch: refetch,
    } = useCourseVersionCohorts(
      courseId,
      versionId ?? '',
      currentPage,
      limit,
      debouncedSearch,
      sortBy,
      sortOrder,
    );

  const handleSort = (key: "name" | "createdAt" | "updatedAt") => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(key)
      setSortOrder("asc")
    }
  }

  const createCohort = async () => {
    if (!cohortName.trim()) return
    if(cohortName.length >=50){
        toast.error("Keep cohort name length below 50");
        return;
    }
    try{
        await createMutation.mutateAsync({
        params: {
            path: {
            courseId: courseId ?? "",
            versionId: versionId ?? ""
            }
        },
        body: {
            newCohortName: cohortName.toLowerCase()
        }
        })
        setIsCreateOpen(false)
        setCohortName("")
        refetch()
    } catch(err: any){
        toast.error(err?.message || "Failed to create cohort");
    }
  }

  const updateCohort = async () => {
    if (!cohortName.trim()) return
    if(cohortName.length >=50){
        toast.error("Keep cohort name length below 50");
        return;
    }
    try{
        await updateMutation.mutateAsync({
        params: {
            path: {
            courseId : courseId??"",
            versionId: versionId??"",
            cohortId: selectedCohort.id
            }
        },
        body: {
            newCohortName: cohortName.toLowerCase()
        }
        })
        setIsEditOpen(false)
        refetch()
    } catch(err: any){
        toast.error(err?.message || "Failed to update cohort");
    }
  }

    const updateCohortPublicStatus = async () => {

    try{
        await updateMutation.mutateAsync({
        params: {
            path: {
            courseId : courseId??"",
            versionId: versionId??"",
            cohortId: selectedCohort.id
            }
        },
        body: {
            isPublic: nextPublicState
        }
        })
        setIsEditOpen(false)
        setIsPublicDialogOpen(false);
        refetch()
    } catch(err: any){
        toast.error(err?.message || "Failed to update cohort");
    }
  }

  const deleteCohort = async () => {
    try{
        await deleteMutation.mutateAsync({
        params: {
            path: {
            courseId : courseId??"",
            versionId: versionId??"",
            cohortId: selectedCohort.id
            }
        }
        })
        setIsDeleteOpen(false)
        refetch()
    }catch(err: any){
        toast.error(err?.message || "Failed to delete cohort");
    }

  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="animate-spin w-8 h-8"/>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          Manage Cohorts (Version {cohortsData?.version})
        </h1>
        <Button
          onClick={() => {
            setCohortName("")
            setIsCreateOpen(true)
          }}
        >
          <Plus className="w-4 h-4 mr-2"/>
          Add Cohort
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cohorts</CardTitle>
        </CardHeader>
      {cohortsData?.cohorts?.length && cohortsData?.cohorts?.length > 0 ?
       ( <div className="flex items-center justify-between mx-6 gap-4">
          <Input
            placeholder="Search cohort..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
            </select>
            <Button
              variant="outline"
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </div>
        </div>):(<div></div>)}

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  { key: "name", label: "Cohort Name" },
                  { key: "createdAt", label: "Created" },
                  { key: "updatedAt", label: "Updated" }
                ].map(({ key, label }) => (
                  <TableHead
                    key={key}
                    className="cursor-pointer"
                    onClick={() =>
                      handleSort(key as any)
                    }
                  >
                <span className="flex items-center gap-1">
                  {label}
                  <span className="w-4 flex justify-center">
                    {sortBy === key ? (
                      sortOrder === "asc"
                        ? <ArrowUp size={14} />
                        : <ArrowDown size={14} />
                    ) : null}
                  </span>
                </span>
                  </TableHead>
                ))}
                <TableHead>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {cohortsData?.cohorts?.length && cohortsData?.cohorts?.length > 0 ? ( cohortsData?.cohorts.map((cohort: any) => (
                <TableRow key={cohort.id}>
                  <TableCell>
                    {cohort.name}
                  </TableCell>
                  <TableCell>
                    {new Date(cohort.createdAt)
                      .toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(cohort.updatedAt)
                      .toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCohort(cohort)
                          setCohortName(cohort.name)
                          setIsEditOpen(true)
                        }}
                      >
                        <Pencil className="w-4 h-4"/>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedCohort(cohort)
                          setIsDeleteOpen(true)
                        }}
                      >
                        <Trash className="w-4 h-4"/>
                      </Button>
                    <AnnouncementModal
                        isOpen={showAnnouncementModal}
                        onClose={() => setShowAnnouncementModal(false)}
                        defaultType={AnnouncementType.COHORT_SPECIFIC}
                        courseId={courseId}
                        versionId={versionId}
                        cohortId={selectedCohortForAnnouncement?.id}
                      />
                      <Button
                            variant="outline"
                            size="sm"
  
                            onClick={() => {
                              setSelectedCohortForAnnouncement(cohort)
                              setShowAnnouncementModal(true)
                            }}
                            className="h-8 bg-background border-border hover:bg-accent hover:text-accent-foreground transition-all duration-300 text-xs"
                          >
                        <Megaphone className="h-3 w-3 mr-1" />
                        Announce
                      </Button>
                    <span className="flex items-center space-x-2 ml-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Is Public</Label>
                      </div>
                      <Switch
                        checked={cohort.isPublic}
                        onCheckedChange={(checked) => {
                          setTargetCohort(cohort)
                          setSelectedCohort(cohort)
                          setNextPublicState(checked)
                          setIsPublicDialogOpen(true)
                        }}
                      />
                    </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))):(
                    <TableRow>
                       <TableCell colSpan={5} className="text-center">
                         <div className="flex flex-col items-center justify-center">
                           <p className="text-foreground font-medium">No Cohorts found</p>
                         </div>
                       </TableCell>
                     </TableRow>
                    )
              }
            </TableBody>
          </Table>
        </CardContent>
          {cohortsData?.cohorts?.length && cohortsData?.cohorts?.length > 0 ?(
          <div className="flex justify-between items-center mx-4">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>

            <span className="text-sm">
              Page {currentPage}
            </span>

            <Button
              variant="outline"
              disabled={cohortsData?.cohorts?.length < limit}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>):
            <div></div>
          }

      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen}
              onOpenChange={setIsCreateOpen}>
        <DialogContent className="p-10">
          <DialogHeader className="mb-4 font-bold">
            <DialogTitle >Enter Cohort Name</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Cohort name"
            value={cohortName}
            onChange={(e) =>
              setCohortName(e.target.value)
            }
          />
          <Button
            className="mt-8"
            onClick={createCohort}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? <Loader2 className="animate-spin mr-2"/>
              : null}
            Create
          </Button>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen}
              onOpenChange={setIsEditOpen}>
        <DialogContent className="p-10">
          <DialogHeader className="mb-4">
            <DialogTitle>Edit Cohort Name</DialogTitle>
          </DialogHeader>
          <Input
            value={cohortName}
            onChange={(e) =>
              setCohortName(e.target.value)
            }
          />
          <Button
            onClick={updateCohort}
            disabled={updateMutation.isPending}
            className="mt-6"
          >
            {updateMutation.isPending
              ? <Loader2 className="animate-spin mr-2"/>
              : null}
            Update
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen}
              onOpenChange={setIsDeleteOpen}>
        <DialogContent className="p-10">
          <DialogHeader className="mb-4">
            <DialogTitle>
              Delete Cohort
            </DialogTitle>
          </DialogHeader>

          <p>
            Are you sure you want to delete
            <strong>
              {" Cohort- "} {selectedCohort?.name}
            </strong> ?
          </p>
          <Button
            variant="destructive"
            onClick={deleteCohort}
            disabled={deleteMutation.isPending}
            className="mt-10"
          >
            {deleteMutation.isPending
              ? <Loader2 className="animate-spin mr-2"/>
              : null}
            Delete
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPublicDialogOpen}
        onOpenChange={setIsPublicDialogOpen}
      >
        <DialogContent className="p-10">
          <DialogHeader className="mb-4">
            <DialogTitle>
              {nextPublicState ? "Make Cohort Public" : "Make Cohort Private"}
            </DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to{" "}
            <strong>
              {nextPublicState ? "make public" : "make private"}
            </strong>{" "}
            the cohort{" "}
            <strong>{targetCohort?.name}</strong>?
          </p>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsPublicDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={updateCohortPublicStatus}
              disabled={updateMutation.isPending}
            >
            {updateMutation.isPending
              ? <Loader2 className="animate-spin mr-2"/>
              : null}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}