"use client"

import React, { useEffect, useRef, useState } from "react"
import { Pencil, LogOut, X, Camera, User2, Upload } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { useNavigate } from "@tanstack/react-router"

export default function UserProfile() {
  const { user, clearUser, updateAvatar } = useAuthStore()
  const navigate = useNavigate()

  const [profilePic, setProfilePic] = useState("")
  const [tempPic, setTempPic] = useState("")
  const [openEdit, setOpenEdit] = useState(false)
  const [fileName, setFileName] = useState("No file selected")

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const avatar = user?.avatar || ""
    setProfilePic(avatar)
    setTempPic(avatar)
  }, [user?.avatar])

  const handleLogout = () => {
    clearUser()
    navigate({ to: "/auth" })
  }

  const handleOpenEdit = () => {
    setTempPic(profilePic)
    setFileName("No file selected")
    setOpenEdit(true)
  }

  const handleSave = () => {
    if (tempPic) {
      updateAvatar(tempPic)
    }
    setOpenEdit(false)
  }

  const handleCancel = () => {
    setTempPic(profilePic)
    setFileName("No file selected")
    setOpenEdit(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    const reader = new FileReader()
    reader.onloadend = () => {
      const imageData = reader.result as string
      setTempPic(imageData)
    }
    reader.readAsDataURL(file)
  }

  const name = user?.name || "Student"
  const initials = name?.charAt(0).toUpperCase() || "U"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#07111f] via-[#0b1730] to-[#081224] px-4 py-10">
      {openEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Update Profile Picture
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-500 transition hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 flex justify-center">
              <Avatar className="h-28 w-28 border-4 border-orange-500 shadow-lg">
                <AvatarImage src={tempPic || ""} className="object-cover" />
                <AvatarFallback className="bg-orange-100 text-2xl font-bold text-orange-600">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-gray-300 bg-gray-50 p-3">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Image
                </Button>

                <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  <p className="truncate">{fileName}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="w-1/2 rounded-xl border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="w-1/2 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="w-full max-w-md rounded-3xl border-0 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <CardContent className="p-8">
          <div className="flex flex-col items-center">
            <div className="relative mb-6">
              <div className="rounded-full bg-gradient-to-br from-orange-400 to-orange-600 p-1 shadow-[0_0_30px_rgba(255,115,0,0.35)]">
                <Avatar className="h-32 w-32 border-4 border-white bg-white">
                  <AvatarImage src={profilePic || ""} className="object-cover" />
                  <AvatarFallback className="bg-orange-100 text-3xl font-bold text-orange-600">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>

              <button
                onClick={handleOpenEdit}
                className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition hover:bg-orange-600"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-8 text-center">
              <div className="flex items-center justify-center gap-2">
                <User2 className="h-5 w-5 text-orange-500" />
                <h2 className="text-3xl font-bold text-gray-900">{name}</h2>
              </div>
            </div>

            <div className="w-full space-y-4">
              <Button
                onClick={handleOpenEdit}
                className="h-12 w-full rounded-2xl bg-orange-500 text-base font-medium text-white shadow-md hover:bg-orange-600"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Profile Picture
              </Button>

              <Button
                onClick={handleLogout}
                variant="outline"
                className="h-12 w-full rounded-2xl border border-red-300 bg-white text-base font-medium text-red-500 hover:bg-red-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}