import { BookOpen, List, FileText, Play, AlertTriangle, X, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import type { EnrolledUser } from "@/types/course.types"
import React from "react"

// Helper function to generate default names for items with empty names
function generateDefaultItemNames(items: any[]) {
  const typeCounts: { [key: string]: number } = {}
  return items.map((item) => {
    if (!item.name || item.name.trim() === "") {
      const type = item.type || "Item"
      const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
      if (!typeCounts[type]) {
        typeCounts[type] = 0
      }
      typeCounts[type]++
      return {
        ...item,
        displayName: `${capitalizedType} ${typeCounts[type]}`,
      }
    }
    return {
      ...item,
      displayName: item.name,
    }
  })
}

export interface ResetProgressModalProps {
  isOpen: boolean
  onClose: () => void
  selectedUser: EnrolledUser | null
  course: any
  version: any
  handleConfirmReset: () => void
  resetProgressMutation: any
  resetScope: "course" | "module" | "section" | "item"
  setResetScope: (scope: "course" | "module" | "section" | "item") => void
  selectedModule: string
  setSelectedModule: (id: string) => void
  selectedSection: string
  setSelectedSection: (id: string) => void
  selectedItem: string
  setSelectedItem: (id: string) => void
}

export function ResetProgressModal(props: ResetProgressModalProps) {
  const {
    isOpen,
    onClose,
    selectedUser,
    course,
    version,
    handleConfirmReset,
    resetProgressMutation,
    resetScope,
    setResetScope,
    selectedModule,
    setSelectedModule,
    selectedSection,
    setSelectedSection,
    selectedItem,
    setSelectedItem,
  } = props

  // Helper functions for available modules/sections/items
  const getAvailableModules = () => {
    return version?.modules || []
  }
  const getAvailableSections = () => {
    if (!selectedModule || !version?.modules) return []
    const module = version.modules.find((m: any) => m.moduleId === selectedModule)
    return module?.sections || []
  }
  const isFormValid = () => {
    switch (resetScope) {
      case "course":
        return true
      case "module":
        return !!selectedModule
      case "section":
        return !!selectedModule && !!selectedSection
      case "item":
        return !!selectedModule && !!selectedSection && !!selectedItem
      default:
        return false
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full mx-4 p-8 space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300 cursor-default">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-card-foreground">Reset Student Progress</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {selectedUser && (
          <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-border">
            <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md">
              <AvatarImage src={selectedUser.avatar || "/placeholder.svg"} alt={selectedUser.name} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                {selectedUser.name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-card-foreground truncate text-lg">{selectedUser.name}</p>
              <p className="text-muted-foreground truncate">{selectedUser.email}</p>
            </div>
          </div>
        )}

        <p className="text-muted-foreground">
          Choose the scope of progress reset for this student in{" "}
          <strong>
            {course?.name} ({version?.version})
          </strong>
          . This action cannot be undone.
        </p>

        <div className="space-y-8">
          <div className="space-y-3">
            <Label htmlFor="reset-scope" className="text-sm font-bold text-foreground">
              Reset Scope
            </Label>
            <Select value={resetScope} onValueChange={(value: any) => setResetScope(value)}>
              <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
                <SelectValue placeholder="Select reset scope" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border cursor-pointer">
                <SelectItem value="course" className="cursor-pointer">
                  <div className="flex items-center gap-3 py-3 px-2">
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <div className="font-semibold">Entire Course Version</div>
                      <div className="text-xs text-muted-foreground">Reset all progress in this version</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="module" className="cursor-pointer">
                  <div className="flex items-center gap-3 py-3 px-2">
                    <List className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <div className="font-semibold">Specific Module</div>
                      <div className="text-xs text-muted-foreground">Reset module progress</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="section" className="cursor-pointer">
                  <div className="flex items-center gap-3 py-3 px-2">
                    <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <div className="font-semibold">Specific Section</div>
                      <div className="text-xs text-muted-foreground">Reset section progress</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="item" className="cursor-pointer">
                  <div className="flex items-center gap-3 py-3 px-2">
                    <Play className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <div className="font-semibold">Specific Item</div>
                      <div className="text-xs text-muted-foreground">Reset single item</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(resetScope === "module" || resetScope === "section" || resetScope === "item") && (
            <div className="space-y-3">
              <Label htmlFor="module" className="text-sm font-bold text-foreground">
                Module
              </Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border cursor-pointer">
                  {getAvailableModules().map((module: any) => (
                    <SelectItem key={module.moduleId} value={module.moduleId} className="cursor-pointer">
                      <div className="py-2">
                        <div className="font-semibold">{module.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {module.sections?.length || 0} sections
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(resetScope === "section" || resetScope === "item") && selectedModule && (
            <div className="space-y-3">
              <Label htmlFor="section" className="text-sm font-bold text-foreground">
                Section
              </Label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border cursor-pointer">
                  {getAvailableSections().map((section: any) => (
                    <SelectItem key={section.sectionId} value={section.sectionId} className="cursor-pointer">
                      <div className="py-2">
                        <div className="font-semibold">{section.name}</div>
                        <div className="text-xs text-muted-foreground">Section in selected module</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {resetScope === "item" && selectedModule && selectedSection && (
            <ItemSelector
              versionId={version?.versionId || version?.id || ""}
              moduleId={selectedModule}
              sectionId={selectedSection}
              selectedItem={selectedItem}
              onItemChange={setSelectedItem}
            />
          )}

          <div className="flex gap-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Warning:</strong> This action cannot be undone. The student's progress will be permanently
              reset for the selected scope.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-w-[100px] cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmReset}
            disabled={!isFormValid() || resetProgressMutation.isPending}
            className="min-w-[120px] shadow-lg cursor-pointer"
          >
            {resetProgressMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Progress"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ItemSelector component (exported for use in parent if needed)
export function ItemSelector({
  versionId,
  moduleId,
  sectionId,
  selectedItem,
  onItemChange,
}: {
  versionId: string
  moduleId: string
  sectionId: string
  selectedItem: string
  onItemChange: (itemId: string) => void
}) {
  // You may need to import useItemsBySectionId from your hooks
  // import { useItemsBySectionId } from "@/hooks/hooks"
  // If not available, pass items as a prop
  const { data: itemsResponse, isLoading, error } = { data: [], isLoading: false, error: null } // Placeholder, replace with hook

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-bold text-foreground">Item</Label>
        <div className="flex items-center gap-3 p-4 border rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading items...</span>
        </div>
      </div>
    )
  }

  if (error || !itemsResponse || !Array.isArray(itemsResponse) || itemsResponse.length === 0) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-bold text-foreground">Item</Label>
        <div className="p-4 border rounded-lg text-sm text-destructive">
          {error ? `Error loading items: ${error}` : "No items found in this section"}
        </div>
      </div>
    )
  }

  const getItemIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case "VIDEO":
        return "🎥"
      case "QUIZ":
        return "❓"
      case "ARTICLE":
      case "BLOG":
        return "📖"
      default:
        return "📄"
    }
  }

  const getItemTypeDisplay = (type: string) => {
    switch (type?.toUpperCase()) {
      case "VIDEO":
        return "Video"
      case "QUIZ":
        return "Quiz"
      case "ARTICLE":
        return "Article"
      case "BLOG":
        return "Blog"
      default:
        return type || "Unknown"
    }
  }

  const itemsWithDefaultNames = generateDefaultItemNames(itemsResponse)

  return (
    <div className="space-y-3">
      <Label htmlFor="item" className="text-sm font-bold text-foreground">
        Item
      </Label>
      <Select value={selectedItem} onValueChange={onItemChange}>
        <SelectTrigger className="h-16 border-border bg-card text-card-foreground cursor-pointer">
          <SelectValue placeholder="Select item" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border cursor-pointer">
          {itemsWithDefaultNames.map((item: any) => (
            <SelectItem key={item._id} value={item._id} className="cursor-pointer">
              <div className="flex items-center gap-3 py-2">
                <span className="text-lg">{getItemIcon(item.type)}</span>
                <div>
                  <div className="font-semibold">{item.displayName}</div>
                  <div className="text-xs text-muted-foreground">{getItemTypeDisplay(item.type)}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
