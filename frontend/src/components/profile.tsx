"use client"

import React, { useCallback, useRef, useState } from "react"
import { Mail, User, Shield, Pencil, BookOpen, Award, Camera, Eye, EyeOff, Lock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useChangePassword, useEditUser, useUserEnrollments } from "@/hooks/hooks"
import { logout } from "@/utils/auth"
import { useNavigate } from "@tanstack/react-router"
import { LogOut } from "lucide-react"
import { auth, sendPasswordResetEmail } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
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

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Other", "Prefer not to say"]
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?]).{8,}$/;

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

    // Calculate total completed items and total items across all enrollments
    const { totalCompleted, totalItems } = enrollments.reduce((acc, enrollment) => {
      const completed = typeof enrollment.completedItems === 'number' ? enrollment.completedItems : 0;
      const total = enrollment.contentCounts?.totalItems || 0;
      return {
        totalCompleted: acc.totalCompleted + completed,
        totalItems: acc.totalItems + (total > 0 ? total : 1) // Avoid division by zero
      };
    }, { totalCompleted: 0, totalItems: 0 });

    // Calculate overall progress percentage
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
  const [confirmLogout, setConfirmLogout] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [hasPasswordProvider, setHasPasswordProvider] = useState(true)
  const [isSendingSetPassword, setIsSendingSetPassword] = useState(false)

  const countries = Country.getAllCountries()
  const selectedCountry = countries.find((country) => country.name === newCountry)
  const states = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : []
  const selectedState = states.find((stateItem) => stateItem.name === newState)
  const cities = selectedCountry && selectedState
    ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode)
    : []

  const { mutateAsync: editUser } = useEditUser();
  const { mutateAsync: changePassword } = useChangePassword();

  React.useEffect(() => {
    const updateProviders = (firebaseUser: typeof auth.currentUser) => {
      const providerIds = firebaseUser?.providerData?.map((p) => p.providerId) || [];
      setHasPasswordProvider(providerIds.includes("password"));
    };

    updateProviders(auth.currentUser);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      updateProviders(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

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

  const handleSave = async () => {
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
        firstName: newFirstName,
        lastName: newLastName,
        gender: newGender,
        country: newCountry,
        state: newState,
        city: newCity,
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
      setEditField(null)
    } catch (error) {
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
      setConfirmLogout(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error("Please fill in all password fields")
      return
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      toast.error("Password must include uppercase, lowercase, number, and special character")
      return
    }

    try {
      setIsChangingPassword(true)
      await changePassword({
        body: {
          currentPassword,
          newPassword,
          newPasswordConfirm: confirmNewPassword,
        },
      })
      toast.success("Password updated successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleSendSetPassword = async () => {
    if (!user?.email) {
      toast.error("Email not found for this account")
      return
    }

    const from =
      role === "teacher" ? "teacher" : role === "student" ? "student" : undefined;

    try {
      setIsSendingSetPassword(true)
      await sendPasswordResetEmail(user.email, from)
      toast.success("Password setup link sent. Check your email.")
    } catch (error: any) {
      toast.error(error?.message || "Failed to send password setup link")
    } finally {
      setIsSendingSetPassword(false)
    }
  }


  return (
    <div className="flex flex-1 flex-col gap-4 md:p-4 pt-0">
      <div className="flex flex-col space-y-6">
        <section className="flex flex-col space-y-2">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground text-sm md:text-base">Your personal information and details</p>
        </section>
        <ConfirmationModal isOpen={confirmLogout}
          onClose={() => setConfirmLogout(false)}
          onConfirm={handleLogout}
          title={"Confirm Logout"}
          description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
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
                {isImageSaving ? "Saving..." : "Save Photo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="grid lg:gap-6 lg:gap-y-0 gap-y-6 lg:grid-cols-3 md:grid-cols-1">
          {/* Profile Picture & Basic Info */}
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-card text-card-foreground" />
            <CardContent className="relative xl:p-6 lg:p-2 p-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <Avatar className="h-28 w-28 ring-4 ring-white dark:ring-gray-800 shadow-xl">
                    <AvatarImage src={user?.avatar || "/placeholder.svg"} alt="Profile" />
                    <AvatarFallback className="text-lg md:text-xl font-semibold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      {avatarFallback.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    className="absolute -bottom-2 -left-2 h-8 w-8 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageSelect}
                  />
                  <div className="absolute -bottom-2 right-4">
                    <Badge variant="secondary" className="text-xs px-3 py-1 bg-white dark:bg-gray-800 shadow-lg border">
                      {displayRole}
                    </Badge>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <h3 className="font-bold text-xl">{displayName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <div className="xl:flex lg:hidden flex"><Mail className="h-4 w-4" /></div>
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
                      ✓ Active Member
                    </Badge>
                  </div>

                  {/* <div className="text-center pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="relative h-9 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:text-red-600 dark:hover:text-red-400 hover:shadow-lg hover:shadow-red-500/10"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div> */}
                  <div className="text-center pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmLogout(true)}
                      className="relative  h-10 px-4 text-sm font-medium transition-all duration-300  hover:text-red-600 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:shadow-red-500/10 dark:hover:text-red-400  dark:hover:bg-gradient-to-r dark:over:from-red-500/10 dark:hover:to-red-400/5"
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
          <Card className="md:col-span-2">
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
                    <Button variant={"ghost"} size={"icon"} onClick={() => setEditField("firstName")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editField === "firstName" ? (
                    <div className="flex gap-2 items-center">
                      <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
                      <Button size={"sm"} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newFirstName || "Not provided"}</p>
                  )}

                  {/* Last Name */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <Button variant={"ghost"} size={"icon"} onClick={() => setEditField("lastName")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editField === "lastName" ? (
                    <div className="flex gap-2 items-center">
                      <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
                      <Button size={"sm"} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newLastName || "Not provided"}</p>
                  )}

                  {/* Gender */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">Gender</label>
                    <Button variant={"ghost"} size={"icon"} onClick={() => setEditField("gender")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editField === "gender" ? (
                    <div className="flex gap-2 items-center">
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
                      <Button size={"sm"} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newGender || "Not provided"}</p>
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
                    <Button variant={"ghost"} size={"icon"} onClick={() => setEditField("country")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editField === "country" ? (
                    <div className="flex gap-2 items-center">
                      <Select
                        value={newCountry}
                        onValueChange={(value) => {
                          setNewCountry(value)
                          setNewState("")
                          setNewCity("")
                        }}
                      >
                        <SelectTrigger className="w-full">
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
                      <Button size={"sm"} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newCountry || "Not provided"}</p>
                  )}

                  {/* State */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">State</label>
                    <Button variant={"ghost"} size={"icon"} onClick={() => setEditField("state")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editField === "state" ? (
                    <div className="flex gap-2 items-center">
                      <Select
                        value={newState}
                        onValueChange={(value) => {
                          setNewState(value)
                          setNewCity("")
                        }}
                        disabled={!newCountry || states.length === 0}
                      >
                        <SelectTrigger className="w-full">
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
                      <Button size={"sm"} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newState || "Not provided"}</p>
                  )}

                  {/* City */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">City</label>
                    <Button variant={"ghost"} size={"icon"} onClick={() => setEditField("city")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editField === "city" ? (
                    <div className="flex gap-2 items-center">
                      <Select
                        value={newCity}
                        onValueChange={setNewCity}
                        disabled={!newState || cities.length === 0}
                      >
                        <SelectTrigger className="w-full">
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
                      <Button size={"sm"} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newCity || "Not provided"}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {hasPasswordProvider ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl font-bold">
                <Lock className="h-6 w-6" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Toggle current password visibility"
                    className="absolute inset-y-0 right-1"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                  >
                    {showCurrentPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Create a new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Toggle new password visibility"
                    className="absolute inset-y-0 right-1"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                  >
                    {showNewPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters and include uppercase, lowercase, number, and special character.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Toggle confirm password visibility"
                    className="absolute inset-y-0 right-1"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              <Button
                className="w-full md:w-auto"
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? "Updating..." : "Update Password"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl font-bold">
                <Lock className="h-6 w-6" />
                Set Password
              </CardTitle>
              <CardDescription>
                Create a password so you can sign in without Google next time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We will send a secure link to your email to set a password.
              </p>
              <Button
                className="w-full md:w-auto"
                onClick={handleSendSetPassword}
                disabled={isSendingSetPassword}
              >
                {isSendingSetPassword ? "Sending..." : "Send Set Password Link"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Learning Stats */}

        {role === "student" && (
          <Card>
            <CardHeader>
              <CardTitle>Learning Statistics</CardTitle>
              <CardDescription>Your progress and achievements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  {/* Enrolled Courses */}
                  {enrollmentsLoading ? (
                    <Skeleton className="h-8 w-12 mx-auto mb-1" />
                  ) : (
                    <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {totalEnrollments}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                </div>

                {/* Overall Progress */}
                <div className="text-center">
                  {enrollmentsLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto mb-1" />
                  ) : (
                    <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                      <Award className="h-4 w-4" />
                      {totalProgress}%
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Overall Progress</p>
                </div>
                {/* <div className="text-center">
                  <div className="text-2xl font-bold text-primary">7</div>
                  <p className="text-sm text-muted-foreground">Day Streak</p>
                </div> */}
              </div>
            </CardContent>
          </Card>
        )
        }
        {/* : (
          <Card>
            <CardHeader>
              <CardTitle>Teaching Statistics</CardTitle>
              <CardDescription>Your contributions and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">3</div>
                  <p className="text-sm text-muted-foreground">Courses Created</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">10</div>
                  <p className="text-sm text-muted-foreground">Articles</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">19</div>
                  <p className="text-sm text-muted-foreground">Blogs</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">100</div>
                  <p className="text-sm text-muted-foreground">Assignments Given</p>
                </div>
                
              </div>
            </CardContent>
          </Card> */}

      </div>
    </div>
  )
}
