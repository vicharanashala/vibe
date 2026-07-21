"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Mail, User, Shield, Pencil, BookOpen, Award, Camera, Trash2, Loader2, ImagePlus, X, BookOpenCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { useEditUser, useUserEnrollments } from "@/hooks/hooks"
import { logout } from "@/utils/auth"
import { useNavigate } from "@tanstack/react-router"
import { LogOut } from "lucide-react"
import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Country, State, City } from "country-state-city"
import Cropper, { Area } from "react-easy-crop"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { motion } from "motion/react"
import ProfileActivityTimeline, { buildActivityFromEnrollment } from "@/components/profile-activity-timeline"
import ProfileCompletionCard from "@/components/profile-completion-card"

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Other", "Prefer not to say"]

const NAME_MIN_LENGTH = 2
const NAME_MAX_LENGTH = 50

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous")
    image.src = url
  })

const getCroppedImageDataUrl = async (imageSrc: string, croppedAreaPixels: Area): Promise<string> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Failed to initialize canvas context")
  }

  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
  )

  return canvas.toDataURL("image/jpeg", 0.92)
}

export default function UserProfile({ role = "student" }: { role?: "student" | "teacher" | "admin" }) {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = () => {
    logout();
    navigate({ to: "/auth" });
  };

  // Fetch user data and statistics
  const { token } = useAuthStore();
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useUserEnrollments(1, 100, !!token);

  // Calculate statistics
  const totalEnrollments = enrollmentsData?.totalDocuments || 0;

  const enrollments = enrollmentsData?.enrollments || [];

  // Calculate progress including all enrolled courses
  const totalProgress = React.useMemo(() => {
    if (enrollments.length === 0) return 0;

    const { totalCompleted, totalItems } = enrollments.reduce((acc, enrollment) => {
      const completed = typeof enrollment.completedItems === 'number' ? enrollment.completedItems : 0;
      const total = enrollment.contentCounts?.totalItems || 0;
      return {
        totalCompleted: acc.totalCompleted + completed,
        totalItems: acc.totalItems + (total > 0 ? total : 1)
      };
    }, { totalCompleted: 0, totalItems: 0 });

    return Number(((totalCompleted / totalItems) * 100).toFixed(2)) || 0;
  }, [enrollments]);

  // Fallback data if user is not available
  const firstName = user?.firstName || user?.name?.split(" ")[0] || ""
  const lastName = user?.lastName || user?.name?.split(" ")[1] || ""
  const displayName = user?.name || `${firstName || ""} ${lastName || ""}`.trim() || (role === "teacher" ? "Teacher" : "Student")
  const displayEmail = user?.email || "No email provided"
  const displayRole = role
  const avatarFallback = (firstName?.[0] || "") + (lastName?.[0] || "") || (displayEmail[0] || "U")

  const [editField, setEditField] = useState<"firstName" | "lastName" | "gender" | "country" | "state" | "city" | (null)>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [newFirstName, setNewFirstName] = useState(firstName || "")
  const [newLastName, setNewLastName] = useState(lastName || "")
  const [newGender, setNewGender] = useState(user?.gender || "")
  const [newCountry, setNewCountry] = useState(user?.country || "")
  const [newState, setNewState] = useState(user?.state || "")
  const [newCity, setNewCity] = useState(user?.city || "")
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)
  const [isImageSaving, setIsImageSaving] = useState(false)
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!user) return
    setNewFirstName(user.firstName || user.name?.split(" ")[0] || "")
    setNewLastName(user.lastName || user.name?.split(" ")[1] || "")
    setNewGender(user.gender || "")
    setNewCountry(user.country || "")
    setNewState(user.state || "")
    setNewCity(user.city || "")
  }, [user])

  const countries = Country.getAllCountries()
  const selectedCountry = countries.find((country) => country.name === newCountry)
  const states = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : []
  const selectedState = states.find((stateItem) => stateItem.name === newState)
  const cities = selectedCountry && selectedState
    ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode)
    : []

  const { mutateAsync: editUser } = useEditUser();

  const validateField = (name: string, value: string): string => {
    if (name === "firstName" || name === "lastName") {
      const trimmed = value.trim()
      if (trimmed.length === 0) return `${name === "firstName" ? "First name" : "Last name"} is required`
      if (trimmed.length < NAME_MIN_LENGTH) return `Must be at least ${NAME_MIN_LENGTH} characters`
      if (trimmed.length > NAME_MAX_LENGTH) return `Must be at most ${NAME_MAX_LENGTH} characters`
    } else if (name === "country" || name === "state" || name === "city") {
      if (!value || value.trim() === "") {
        return `${name.charAt(0).toUpperCase() + name.slice(1)} is required`
      }
    }
    return ""
  }

  const handleFieldChange = (name: string, value: string) => {
    if (name === "firstName") setNewFirstName(value)
    else if (name === "lastName") setNewLastName(value)
    const error = validateField(name, value)
    setValidationErrors((prev) => ({ ...prev, [name]: error }))
  }

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const recentActivities = useMemo(() => {
    return enrollments
      .map((enrollment) => buildActivityFromEnrollment({
        courseTitle: enrollment.course?.name || "Unknown Course",
        enrolledAt: enrollment.enrollmentDate || enrollment.createdAt || new Date().toISOString(),
        progress: enrollment.contentCounts?.totalItems
          ? Math.round(((enrollment.completedItems || 0) / enrollment.contentCounts.totalItems) * 100)
          : 0,
      }))
      .slice(0, 10)
  }, [enrollments])

  const handleCancel = () => {
    // Restore original values
    setNewFirstName(firstName || "")
    setNewLastName(lastName || "")
    setNewGender(user?.gender || "")
    setNewCountry(user?.country || "")
    setNewState(user?.state || "")
    setNewCity(user?.city || "")
    setValidationErrors({})
    setEditField(null)
  }

  const handleProfileImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file")
      return
    }

    const maxFileSize = 5 * 1024 * 1024
    if (file.size > maxFileSize) {
      toast.error("Image size should be less than 5MB")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImageToCrop(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setIsCropDialogOpen(true)
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleProfileImageSave = async () => {
    if (!imageToCrop || !croppedAreaPixels || !user?.uid) {
      return
    }

    try {
      setIsImageSaving(true)
      const croppedDataUrl = await getCroppedImageDataUrl(imageToCrop, croppedAreaPixels)

      await editUser({ body: { avatar: croppedDataUrl } })

      setUser({
        ...user,
        avatar: croppedDataUrl,
        uid: user.uid,
      })

      toast.success("Profile picture updated successfully")
      setIsCropDialogOpen(false)
      setImageToCrop(null)
    } catch (error) {
      toast.error("Failed to update profile picture")
    } finally {
      setIsImageSaving(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user?.uid) return

    try {
      setIsRemovingAvatar(true)
      await editUser({ body: { avatar: "" } })

      setUser({
        ...user,
        avatar: undefined,
        uid: user.uid,
      })

      toast.success("Profile picture removed")
      setConfirmRemoveAvatar(false)
    } catch (error) {
      toast.error("Failed to remove profile picture")
    } finally {
      setIsRemovingAvatar(false)
    }
  }

  const handleSave = async () => {
    const errors: Record<string, string> = {}
    const firstNameError = validateField("firstName", newFirstName)
    const lastNameError = validateField("lastName", newLastName)
    const countryError = validateField("country", newCountry)
    const stateError = validateField("state", newState)
    const cityError = validateField("city", newCity)

    if (firstNameError) errors.firstName = firstNameError
    if (lastNameError) errors.lastName = lastNameError
    if (countryError) errors.country = countryError
    if (stateError) errors.state = stateError
    if (cityError) errors.city = cityError

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors({})
    setIsSaving(true)
    try {
      const payload: {
        firstName: string;
        lastName: string;
        gender: string;
        country: string;
        state: string;
        city: string;
      } = {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        gender: newGender,
        country: newCountry.trim(),
        state: newState.trim(),
        city: newCity.trim(),
      }

      await editUser({ body: payload })

      if (user && user.uid) {
        setUser({
          ...user,
          ...payload,
          name: `${payload.firstName} ${payload.lastName}`,
          uid: user.uid,
        })
      }

      toast.success("Profile updated successfully")
      setValidationErrors({})
      setEditField(null)
    } catch (error) {
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
      setConfirmLogout(false)
    }
  }


  return (
    <div className="flex flex-1 flex-col gap-4 md:p-4 pt-0">
      <div className="flex flex-col space-y-6">
        <motion.section
          className="flex flex-col space-y-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground text-sm md:text-base">Your personal information and details</p>
        </motion.section>
        <ConfirmationModal isOpen={confirmLogout}
          onClose={() => setConfirmLogout(false)}
          onConfirm={handleLogout}
          title={"Confirm Logout"}
          description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
        />
        <ConfirmationModal isOpen={confirmRemoveAvatar}
          onClose={() => setConfirmRemoveAvatar(false)}
          onConfirm={handleRemoveAvatar}
          title="Remove Profile Picture"
          description="Are you sure you want to remove your profile picture? You can upload a new one at any time."
        />
        <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Profile Picture</DialogTitle>
              <DialogDescription>
                Move and zoom the image to select the best visible area.
              </DialogDescription>
            </DialogHeader>
            <div className="relative h-80 w-full overflow-hidden rounded-md bg-black/70">
              {imageToCrop && (
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Zoom</label>
              <Slider
                min={1}
                max={3}
                step={0.1}
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0] ?? 1)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCropDialogOpen(false)
                  setImageToCrop(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleProfileImageSave} disabled={isImageSaving}>
                {isImageSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Photo"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <motion.div
          className="grid lg:gap-6 lg:gap-y-0 gap-y-6 lg:grid-cols-3 md:grid-cols-1"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          {/* Profile Picture & Basic Info */}
          <Card className="relative overflow-hidden transition-shadow duration-200 hover:shadow-md">
            <div className="absolute inset-0 bg-card text-card-foreground" />
            <CardContent className="relative xl:p-6 lg:p-2 p-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative group">
                  <Avatar className="h-28 w-28 ring-4 ring-white dark:ring-gray-800 shadow-xl transition-transform duration-200 group-hover:scale-105">
                    <AvatarImage src={user?.avatar || "/placeholder.svg"} alt="Profile" />
                    <AvatarFallback className="text-lg md:text-xl font-semibold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      {avatarFallback.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Loading spinner overlay */}
                  {(isImageSaving || isRemovingAvatar) && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center z-20">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <button
                    type="button"
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer z-10"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImageSaving || isRemovingAvatar}
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>

                  <div className="absolute -bottom-2 right-4">
                    <Badge variant="secondary" className="text-xs px-3 py-1 bg-white dark:bg-gray-800 shadow-lg border">
                      {displayRole}
                    </Badge>
                  </div>
                </div>

                {/* Change Photo & Remove buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImageSaving || isRemovingAvatar}
                  >
                    <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                    Change Photo
                  </Button>
                  {user?.avatar && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmRemoveAvatar(true)}
                      disabled={isImageSaving || isRemovingAvatar}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfileImageSelect}
                />

                <div className="text-center space-y-2">
                  <h3 className="font-bold text-xl">{displayName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Mail className="h-4 w-4" />
                    {displayEmail}
                  </p>
                </div>

                <div className="w-full space-y-4">
                  <Separator />

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Account Type
                    </span>
                    <Badge
                      variant={
                        displayRole === "admin" ? "destructive" : displayRole === "teacher" ? "default" : "secondary"
                      }
                      className="px-3 py-1"
                    >
                      {displayRole.charAt(0).toUpperCase() + displayRole.slice(1)}
                    </Badge>
                  </div>

                  <div className="text-center pt-2">
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-4 py-2"
                    >
                      Active Member
                    </Badge>
                  </div>

                  <div className="text-center pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmLogout(true)}
                      className="h-10 px-4 text-sm font-medium transition-all duration-200 hover:text-red-600 hover:bg-red-50 active:scale-95 dark:hover:text-red-400 dark:hover:bg-red-950"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="md:col-span-2 transition-shadow duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl font-bold">
                <User className="h-6 w-6" />
                Personal Information
              </CardTitle>
              <CardDescription>Your account details and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  {/* First Name */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">First Name</label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-all duration-150 hover:bg-accent hover:scale-110 active:scale-95"
                      onClick={() => setEditField("firstName")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {editField === "firstName" ? (
                    <motion.div
                      className="space-y-1"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex gap-2 items-center">
                        <Input
                          value={newFirstName}
                          onChange={(e) => handleFieldChange("firstName", e.target.value)}
                          aria-invalid={!!validationErrors.firstName}
                          autoFocus
                          className={validationErrors.firstName ? "border-red-500" : ""}
                        />
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="transition-transform duration-100 active:scale-95">
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {validationErrors.firstName && (
                        <p className="text-xs text-red-500">{validationErrors.firstName}</p>
                      )}
                    </motion.div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newFirstName || "—"}</p>
                  )}

                  {/* Last Name */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-all duration-150 hover:bg-accent hover:scale-110 active:scale-95"
                      onClick={() => setEditField("lastName")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {editField === "lastName" ? (
                    <motion.div
                      className="space-y-1"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex gap-2 items-center">
                        <Input
                          value={newLastName}
                          onChange={(e) => handleFieldChange("lastName", e.target.value)}
                          aria-invalid={!!validationErrors.lastName}
                          autoFocus
                          className={validationErrors.lastName ? "border-red-500" : ""}
                        />
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="transition-transform duration-100 active:scale-95">
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {validationErrors.lastName && (
                        <p className="text-xs text-red-500">{validationErrors.lastName}</p>
                      )}
                    </motion.div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newLastName || "—"}</p>
                  )}

                  {/* Gender */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">Gender</label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-all duration-150 hover:bg-accent hover:scale-110 active:scale-95"
                      onClick={() => setEditField("gender")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {editField === "gender" ? (
                    <motion.div
                      className="flex gap-2 items-center"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.15 }}
                    >
                      <Select value={newGender} onValueChange={setNewGender}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDER_OPTIONS.map((genderOption) => (
                            <SelectItem key={genderOption} value={genderOption}>
                              {genderOption}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleSave} disabled={isSaving} className="transition-transform duration-100 active:scale-95">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newGender || "—"}</p>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email Address
                    </label>
                    <p className="md:text-base text-sm font-medium mt-1 break-all">{displayEmail}</p>
                  </div>

                  {/* Country */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">Country</label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-all duration-150 hover:bg-accent hover:scale-110 active:scale-95"
                      onClick={() => setEditField("country")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {editField === "country" ? (
                    <motion.div
                      className="space-y-1"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex gap-2 items-center">
                        <Select
                          value={newCountry}
                          onValueChange={(value) => {
                            setNewCountry(value)
                            setNewState("")
                            setNewCity("")
                            if (validationErrors.country) {
                              setValidationErrors(prev => ({ ...prev, country: "" }))
                            }
                          }}
                        >
                          <SelectTrigger className={`w-full ${validationErrors.country ? "border-red-500" : ""}`}>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((country) => (
                              <SelectItem key={country.isoCode} value={country.name}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="transition-transform duration-100 active:scale-95">
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {validationErrors.country && (
                        <p className="text-xs text-red-500">{validationErrors.country}</p>
                      )}
                    </motion.div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newCountry || "—"}</p>
                  )}

                  {/* State */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">State</label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-all duration-150 hover:bg-accent hover:scale-110 active:scale-95"
                      onClick={() => setEditField("state")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {editField === "state" ? (
                    <motion.div
                      className="space-y-1"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex gap-2 items-center">
                        <Select
                          value={newState}
                          onValueChange={(value) => {
                            setNewState(value)
                            setNewCity("")
                            if (validationErrors.state) {
                              setValidationErrors(prev => ({ ...prev, state: "" }))
                            }
                          }}
                          disabled={!newCountry || states.length === 0}
                        >
                          <SelectTrigger className={`w-full ${validationErrors.state ? "border-red-500" : ""}`}>
                            <SelectValue placeholder={newCountry ? "Select state" : "Select country first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {states.map((stateItem) => (
                              <SelectItem key={stateItem.isoCode} value={stateItem.name}>
                                {stateItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="transition-transform duration-100 active:scale-95">
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {validationErrors.state && (
                        <p className="text-xs text-red-500">{validationErrors.state}</p>
                      )}
                    </motion.div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newState || "—"}</p>
                  )}

                  {/* City */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">City</label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-all duration-150 hover:bg-accent hover:scale-110 active:scale-95"
                      onClick={() => setEditField("city")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {editField === "city" ? (
                    <motion.div
                      className="space-y-1"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex gap-2 items-center">
                        <Select
                          value={newCity}
                          onValueChange={(value) => {
                            setNewCity(value)
                            if (validationErrors.city) {
                              setValidationErrors(prev => ({ ...prev, city: "" }))
                            }
                          }}
                          disabled={!newState || cities.length === 0}
                        >
                          <SelectTrigger className={`w-full ${validationErrors.city ? "border-red-500" : ""}`}>
                            <SelectValue placeholder={newState ? "Select city" : "Select state first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {cities.map((cityItem, index) => (
                              <SelectItem key={`${cityItem.name}-${index}`} value={cityItem.name}>
                                {cityItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="transition-transform duration-100 active:scale-95">
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {validationErrors.city && (
                        <p className="text-xs text-red-500">{validationErrors.city}</p>
                      )}
                    </motion.div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newCity || "—"}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Profile Completion */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <ProfileCompletionCard
            user={user}
            onFieldClick={(field) => {
              if (field === "avatar") {
                fileInputRef.current?.click()
              } else {
                setEditField(field as typeof editField)
              }
            }}
            currentEditField={editField}
          />
        </motion.div>

        {/* Learning Stats */}
        {role === "student" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
          >
            <Card className="transition-shadow duration-200 hover:shadow-md">
              <CardHeader>
                <CardTitle>Learning Statistics</CardTitle>
                <CardDescription>Your progress and achievements</CardDescription>
              </CardHeader>
              <CardContent>
                {enrollmentsLoading ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-7 w-16" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : totalEnrollments === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <BookOpenCheck className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No courses yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Enroll in a course to start tracking your progress.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-4 rounded-lg border p-4 transition-colors duration-200 hover:bg-accent/50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tracking-tight">{totalEnrollments}</p>
                        <p className="text-xs text-muted-foreground">Enrolled Courses</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 rounded-lg border p-4 transition-colors duration-200 hover:bg-accent/50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tracking-tight">{totalProgress}%</p>
                        <p className="text-xs text-muted-foreground">Overall Progress</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {role === "student" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
          >
            <ProfileActivityTimeline activities={recentActivities} />
          </motion.div>
        )}
      </div>
    </div>
  )
}
