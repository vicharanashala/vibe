"use client"

import { Mail, User, Shield } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAuthStore } from "@/store/auth-store"

export default function UserProfile({ role = "student" } : {role?: "student" | "teacher" | "admin"}) {
  const { user } = useAuthStore()

  // Fallback data if user is not available
  let firstName: string | undefined;
  let lastName: string | undefined;

  if (user?.firstName && user?.lastName) {
    firstName = user.firstName;
    lastName = user.lastName;
  } else {
    const nameParts = (user?.name || "FirstName LastName").split(" ");
    firstName = nameParts[0];
    lastName = nameParts[1];
  }

  const displayName = user?.name || `${firstName || ""} ${lastName || ""}`.trim() || (role === "teacher" ? "Teacher" : "Student")
  const displayEmail = user?.email || "No email provided"
  const displayRole = role
  const avatarFallback = (firstName?.[0] || "") + (lastName?.[0] || "") || (displayEmail[0] || "U")

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col space-y-6">
        <section className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">Your personal information and details</p>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Picture & Basic Info */}
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20" />
            <CardContent className="relative p-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <Avatar className="h-28 w-28 ring-4 ring-white dark:ring-gray-800 shadow-xl">
                    <AvatarImage src={user?.avatar || "/placeholder.svg"} alt="Profile" />
                    <AvatarFallback className="text-xl font-semibold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      {avatarFallback.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2">
                    <Badge variant="secondary" className="text-xs px-3 py-1 bg-white dark:bg-gray-800 shadow-lg border">
                      {displayRole}
                    </Badge>
                  </div>
                </div>

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
                      ✓ Active Member
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <User className="h-6 w-6" />
                Personal Information
                </CardTitle>
              <CardDescription>Your account details and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">First Name</label>
                    <p className="text-base font-medium mt-1">{firstName || "Not provided"}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <p className="text-base font-medium mt-1">{lastName|| "Not provided"}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                    <p className="text-base font-medium mt-1">{user?.name || "Not set"}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email Address
                    </label>
                    <p className="text-base font-medium mt-1 break-all">{displayEmail}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Stats */}
        
        {role === "student" ? (
            <Card>
            <CardHeader>
                <CardTitle>Learning Statistics</CardTitle>
                <CardDescription>Your progress and achievements</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary">3</div>
                    <p className="text-sm text-muted-foreground">Courses Enrolled</p>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary">45</div>
                    <p className="text-sm text-muted-foreground">Lessons Completed</p>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary">72%</div>
                    <p className="text-sm text-muted-foreground">Average Progress</p>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary">7</div>
                    <p className="text-sm text-muted-foreground">Day Streak</p>
                </div>
                </div>
            </CardContent>
            </Card>

        ) : (
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
            </Card>

        )}

        
      </div>
    </div>
  )
}
