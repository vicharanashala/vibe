// @ts-nocheck

"use client"

import { useEffect, useState } from "react"
import { Loader2, ArrowUp, ArrowDown, Plus, Pencil, Trash, Megaphone, AlertCircle, RefreshCw } from "lucide-react"
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
import { Ban } from "lucide-react"


const RESTRICTED_VERSION_IDS = [
  '6968e12cbf2860d6e39051af',
  '6970f87e30644cbc74b67150',
  '697b4e262942654879011c57',
  '69903415e1930c015760a719',
  '69942dc6d6d99b252e3a54ff',
  '69d2b1bc0744872b91ab54da',
  '69d2b2e50744872b91ab641f',
];

export default function ConfigureCohorts() {

  const { currentCourse } = useCourseStore()
  const courseId = currentCourse?.courseId
  const versionId = currentCourse?.versionId
  const createMutation = useCreateCohort()
  const updateMutation = useUpdateCohort()
  const deleteMutation = useDeleteCohort()
  const [cohortError, setCohortError] = useState("")
  const [sortBy, setSortBy] =
    useState<"name" | "createdAt" | "updatedAt" | "baseHp" | "safeHp">("createdAt")
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

  const isRestricted = versionId && RESTRICTED_VERSION_IDS.includes(versionId);
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false)
  const [nextActiveState, setNextActiveState] = useState(false)

  const [baseHp, setBaseHp] = useState(0);
  const [safeHp, setSafeHp] = useState(0);
  const [isHpEditEnabled, setIsHpEditEnabled] = useState(false);
  const [isHpToggleConfirmOpen, setIsHpToggleConfirmOpen] = useState(false);
  const [baseHpError, setBaseHpError] = useState("");
  const [safeHpError, setSafeHpError] = useState("");

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
      isRefetching: isRefetching,
    } = useCourseVersionCohorts(
      courseId,
      versionId ?? '',
      currentPage,
      limit,
      debouncedSearch,
      sortBy,
      sortOrder,
    );

  const handleSort = (key: "name" | "createdAt" | "updatedAt" | "baseHp" | "safeHp") => {
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
    const BLOCKED_COHORT_NAMES = ["euclideans", "dijkstrians", "kruskalians", "rsaians", "aksians", "a", "b"];
    if (BLOCKED_COHORT_NAMES.includes(cohortName.trim().toLowerCase())) {
      setCohortError(`"${cohortName.trim()}" is a reserved cohort name and cannot be used.`);
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
    const BLOCKED_COHORT_NAMES = ["euclideans", "dijkstrians", "kruskalians", "rsaians", "aksians"];
    if (BLOCKED_COHORT_NAMES.includes(cohortName.trim().toLowerCase())) {
      setCohortError(`"${cohortName.trim()}" is a reserved cohort name and cannot be used.`);
      return;
    }

    if (isHpEditEnabled) {
      if (baseHp <= 0) {
        setBaseHpError("Base HP must be greater than 0")
        return
      }

      if (safeHp < 0) {
        setSafeHpError("Safe HP cannot be negative")
        return
      }
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
            newCohortName: cohortName.toLowerCase(),
           ...(isHpEditEnabled && { baseHp, safeHp })
          }
        })
        setIsEditOpen(false)
        refetch()
        toast.success("Cohort updated successfully")
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
        toast.success("Cohort deleted successfully")
    }catch(err: any){
        toast.error(err?.message || "Failed to delete cohort");
    }

  }

  const updateCohortActiveStatus = async () => {
    try {
      await updateMutation.mutateAsync({
        params: {
          path: {
            courseId: courseId ?? "",
            versionId: versionId ?? "",
            cohortId: selectedCohort.id
          }
        },
        body: {
          isActive: nextActiveState
        }
      })

      setIsRegistrationDialogOpen(false)
      refetch()
    } catch (err: any) {
      toast.error(err?.message || "Failed to update cohort status")
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
      {/* Restricting cohort creation for already existing course versions because these versions are already published and have students enrolled in them */}
      {isRestricted && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <Ban className="h-4 w-4" />
          <p className="text-sm font-medium">Cohorts cannot be created for this version since the version itself acts as a cohort.</p>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          Manage Cohorts (Version {cohortsData?.version})
        </h1>
        <Button
          onClick={() => {
            setCohortName("")
            setCohortError("")
            setIsCreateOpen(true)
          }}
          disabled={isRestricted}
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
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              {isRefetching ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>):(<div></div>)}

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  { key: "name", label: "Cohort Name" },
                  { key: "baseHp", label: "Base HP" },
                  { key: "safeHp", label: "Safe HP" },
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
                    {cohort.baseHp ?? 0}
                  </TableCell>
                  <TableCell>
                    {cohort.safeHp ?? 0}
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
                          setBaseHp(cohort.baseHp ?? 0)
                          setSafeHp(cohort.safeHp ?? 0)
                          setIsEditOpen(true)

                          setIsHpEditEnabled(false)
                          setBaseHpError("")
                          setSafeHpError("")
                          setCohortError("")
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCohort(cohort)
                          setTargetCohort(cohort)
                          setNextActiveState(!cohort.isActive) // toggle
                          setIsRegistrationDialogOpen(true)
                        }}
                      >
                        {cohort.isActive ? "Pause Registrations" : "Resume Registrations"}
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
              onChange={(e) => {
                setCohortName(e.target.value);
                if (cohortError) setCohortError("");
              }}
            />
            {cohortError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {cohortError}
              </p>
            )}
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px] p-6">

          {/* Header */}
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Edit Cohort Details
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update cohort name and optionally modify HP configuration
            </p>
          </DialogHeader>

          <div className="space-y-5 mt-4">

            {/* Cohort Name */}
            <div className="space-y-2">
              <Label>Cohort Name</Label>
              <Input
                value={cohortName}
                onChange={(e) => {
                  setCohortName(e.target.value);
                  if (cohortError) setCohortError("");
                }}
              />
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Edit HP Configuration</p>
                <p className="text-xs text-muted-foreground">
                  Enable to modify Base HP and Safe HP
                </p>
              </div>

              <Switch
                checked={isHpEditEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setIsHpToggleConfirmOpen(true)
                  } else {
                    setIsHpEditEnabled(false)
                    setBaseHpError("")
                    setSafeHpError("")
                  }
                }}
              />
            </div>

            {/* HP Section */}
            <div
              className={`border rounded-lg p-4 space-y-4 bg-muted/30 ${
                !isHpEditEnabled ? "opacity-60" : ""
              }`}
            >
              <p className="text-sm font-medium text-muted-foreground">
                HP Configuration
              </p>

              <div className="grid grid-cols-2 gap-4">

                {/* Base HP */}
                <div className="space-y-2">
                  <Label>Base HP</Label>
                  <Input
                    type="number"
                    value={baseHp}
                    disabled={!isHpEditEnabled}
                    className={baseHpError ? "border-red-500" : ""}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setBaseHp(value)

                      if (value <= 0) {
                        setBaseHpError("Base HP must be greater than 0")
                      } else {
                        setBaseHpError("")
                      }
                    }}
                  />
                  {baseHpError && (
                    <p className="text-xs text-red-500">{baseHpError}</p>
                  )}
                </div>

                {/* Safe HP */}
                <div className="space-y-2">
                  <Label>Safe HP</Label>
                  <Input
                    type="number"
                    value={safeHp}
                    disabled={!isHpEditEnabled}
                    className={safeHpError ? "border-red-500" : ""}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setSafeHp(value)

                      if (value < 0) {
                        setSafeHpError("Safe HP cannot be negative")
                      } else {
                        setSafeHpError("")
                      }
                    }}
                  />
                  {safeHpError && (
                    <p className="text-xs text-red-500">{safeHpError}</p>
                  )}
                </div>

              </div>
            </div>

            {/* General Error */}
            {cohortError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {cohortError}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>

              <Button
                onClick={updateCohort}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="animate-spin mr-2" />
                )}
                Save Changes
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isHpToggleConfirmOpen} onOpenChange={setIsHpToggleConfirmOpen}>
        <DialogContent className="p-6">

          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Enable HP Editing?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-3 text-sm">

            <p>
              You are about to modify HP configuration for{" "}
              <strong>{selectedCohort?.name}</strong>.
            </p>

            <div className="bg-muted/30 p-3 rounded-md space-y-1">
              <p>New students will receive updated Base HP on enrollment</p>
              <p>Existing students will NOT receive additional Base HP</p>
              <p>Safe HP determines whether a student is considered safe</p>
              <p>Students below Safe HP are at risk</p>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button
                variant="outline"
                onClick={() => setIsHpToggleConfirmOpen(false)}
              >
                Cancel
              </Button>

              <Button
                onClick={() => {
                  setIsHpEditEnabled(true)
                  setIsHpToggleConfirmOpen(false)
                }}
              >
                Enable Editing
              </Button>
            </div>

          </div>
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

      {/* Public/Private Toggle Dialog */}
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

      {/* Active/Inactive for Registrations*/}
      <Dialog
        open={isRegistrationDialogOpen}
        onOpenChange={setIsRegistrationDialogOpen}
      >
        <DialogContent className="p-10">
          <DialogHeader className="mb-4">
            <DialogTitle>
              {nextActiveState ? "Resume Registrations" : "Pause Registrations"}
            </DialogTitle>
          </DialogHeader>

          <p>
            Are you sure you want to{" "}
            <strong>
              {nextActiveState ? "resume" : "pause"}
            </strong>{" "}
            registrations for{" "}
            <strong>{targetCohort?.name}</strong>?
          </p>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsRegistrationDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              onClick={updateCohortActiveStatus}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="animate-spin mr-2" />
              )}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}