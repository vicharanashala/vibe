"use client"

import * as React from "react"
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"


type FieldType = "text" | "textarea" | "email" | "tel" | "date" | "number" | "url" | "select"

type Field = {
  id: string
  label: string
  type: FieldType
  required: boolean
  isDefault: boolean
  // For dropdown fields
  options?: string[]
  allowMultiple?: boolean
}

const fieldTypeLabels: Record<FieldType, string> = {
  text: "Short Text",
  textarea: "Long Text",
  email: "Email Address",
  tel: "Phone Number",
  date: "Date",
  number: "Number",
  url: "Website URL",
  select: "Dropdown",
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

type EditState = {
  id?: string // present when editing
  label: string
  type: FieldType
  required: boolean
  isDefault: boolean
  options: string[]
  allowMultiple: boolean
}

type RegistrationSettingsDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave?: (fields: Field[]) => Promise<void> | void
}

export const  RegistrationSettingsDialog = ({
  open,
  onOpenChange,
  onSave,
}: RegistrationSettingsDialogProps) => {
  const [fields, setFields] = React.useState<Field[]>(
   [       
     {
          id: uid(),
          label: "Full Name",
          type: "text",
          required: true,
          isDefault: true,
        },
        {
          id: uid(),
          label: "Email",
          type: "email",
          required: true,
          isDefault: true,
        },
        {
          id: uid(),
          label: "Subjects Interested",
          type: "select",
          required: false,
          isDefault: false,
          options: ["Math", "Science", "History"],
          allowMultiple: true,
        },
      ],
  )

  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const [showAddField, setShowAddField] = React.useState(false)
  const [editField, setEditField] = React.useState<EditState | null>(null)

  const startAdd = () => {
    setEditField({
      label: "",
      type: "text",
      required: false,
      isDefault: false,
      options: [],
      allowMultiple: false,
    })
    setShowAddField(true)
  }

  const startEdit = (f: Field) => {
    setEditField({
      id: f.id,
      label: f.label,
      type: f.type,
      required: f.required,
      isDefault: f.isDefault,
      options: f.options ?? [],
      allowMultiple: Boolean(f.allowMultiple),
    })
    setShowAddField(true)
  }

  const resetForm = () => {
    setShowAddField(false)
    setEditField(null)
    setError("")
  }

  const saveNewOrEdit = () => {
    if (!editField) return
    const label = editField.label.trim()
    if (!label) {
      setError("Field label is required.")
      return
    }

    // If field type is dropdown, at least one option is required
    if (editField.type === "select" && editField.options.length === 0) {
      setError("Please add at least one option for a dropdown field.")
      return
    }

    // Create or update
    if (!editField.id) {
      const newField: Field = {
        id: uid(),
        label,
        type: editField.type,
        required: editField.required,
        isDefault: false,
        options: editField.type === "select" ? [...editField.options] : undefined,
        allowMultiple: editField.type === "select" ? !!editField.allowMultiple : undefined,
      }
      setFields((prev) => [...prev, newField])
    } else {
      setFields((prev) =>
        prev.map((f) =>
          f.id === editField.id
            ? {
                ...f,
                label,
                // Lock type for default fields to be safe
                type: editField.isDefault ? f.type : editField.type,
                required: editField.required,
                options:
                  (editField.isDefault ? f.type : editField.type) === "select" ? [...editField.options] : undefined,
                allowMultiple:
                  (editField.isDefault ? f.type : editField.type) === "select" ? !!editField.allowMultiple : undefined,
              }
            : f,
        ),
      )
    }

    resetForm()
  }

  const removeCustomField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  const toggleRequired = (id: string) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, required: !f.required } : f)))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    try {
      await onSave?.(fields)
      onOpenChange?.(false)
    } catch (e: any) {
      setError(e?.message ?? "Failed to save settings.")
    } finally {
      setLoading(false)
    }
  }

  const renderEditor = () => {
    if (!showAddField || !editField) return null
    const disableTypeChange = editField.isDefault

    return (
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fieldLabel" className="text-sm font-medium">
            Field Label
          </Label>
          <Input
            id="fieldLabel"
            placeholder="e.g., Previous Education, Emergency Contact"
            value={editField.label}
            onChange={(e) => setEditField({ ...editField, label: e.target.value })}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">This will be displayed as the field name to students</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fieldType" className="text-sm font-medium">
            Field Type
          </Label>
          <Select
            value={editField.type}
            onValueChange={(value: FieldType) => setEditField({ ...editField, type: value })}
            disabled={disableTypeChange}
          >
            <SelectTrigger id="fieldType" className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Short Text</SelectItem>
              <SelectItem value="textarea">Long Text</SelectItem>
              <SelectItem value="email">Email Address</SelectItem>
              <SelectItem value="tel">Phone Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="url">Website URL</SelectItem>
              <SelectItem value="select">Dropdown</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose the input type that best fits the information you want to collect
          </p>
        </div>

        {editField.type === "select" ? (
          <div className="space-y-3">
            <ChipsInput
              label="Dropdown Options"
              values={editField.options}
              onChange={(opts) => setEditField({ ...editField, options: opts })}
              placeholder="Enter an option and press Enter"
              addButtonText="Add option"
            />
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="allowMultiple"
                checked={editField.allowMultiple}
                onCheckedChange={(v) => setEditField({ ...editField, allowMultiple: Boolean(v) })}
              />
              <label htmlFor="allowMultiple" className="text-sm text-muted-foreground cursor-pointer select-none">
                Allow multiple selections
              </label>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Checkbox
            id="required"
            checked={editField.required}
            disabled={disableTypeChange}
            onCheckedChange={(v) => setEditField({ ...editField, required: Boolean(v) })}
          />
          <label htmlFor="required" className="text-sm text-muted-foreground cursor-pointer select-none">
            Required
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetForm}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={saveNewOrEdit}>
            {editField.id ? "Add Changes" : "Add Field"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`bg-background text-foreground max-w-2xl max-h-[90vh] ${showAddField && "overflow-y-auto"}`}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">Registration Form Settings</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-6 pt-4"
        >
          {/* Default Fields Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">Default Registration Fields</h3>
              <p className="text-xs text-muted-foreground">
                Configure which default fields are required for student registration
              </p>
            </div>

            <div className="border border-border rounded-lg p-4">
              <ScrollArea className="min-h-fit max-h-64 w-full pe-6 ps-2">
                <div className="space-y-3">
                  {fields
                    .filter((f) => f.isDefault)
                    .map((field) => (
                      <div key={field.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div className="space-y-0.5">
                            <Label className="text-sm font-medium">{field.label}</Label>
                            <p className="text-xs text-muted-foreground">
                              Type: {fieldTypeLabels[field.type] || field.type}
                            </p>
                            {field.type === "select" && field.options ? (
                              <p className="text-xs text-muted-foreground">
                                Options: {field.options.join(", ")} {field.allowMultiple ? "(multi-select)" : ""}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`required-${field.id}`}
                              checked={field.required}
                              onCheckedChange={() => toggleRequired(field.id)}
                            />
                            <label
                              htmlFor={`required-${field.id}`}
                              className="text-sm text-muted-foreground cursor-pointer select-none"
                            >
                              Required
                            </label>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(field)}
                            className="h-8 w-8 p-0"
                            aria-label="Edit field"
                            title="Edit field"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <Separator />

          {/* Custom Fields Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">Custom Fields</h3>
              <p className="text-xs text-muted-foreground">
                Add additional fields to collect specific information from students
              </p>
            </div>

            {fields.filter((f) => !f.isDefault).length > 0 && (
              <div className="space-y-3 border border-border rounded-lg p-4">
                {fields
                  .filter((f) => !f.isDefault)
                  .map((field) => (
                    <div key={field.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">{field.label}</Label>
                          <p className="text-xs text-muted-foreground">
                            Type: {fieldTypeLabels[field.type] || field.type}
                          </p>
                          {field.type === "select" && field.options ? (
                            <p className="text-xs text-muted-foreground">
                              Options: {field.options.join(", ")} {field.allowMultiple ? "(multi-select)" : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`required-${field.id}`}
                            checked={field.required}
                            onCheckedChange={() => toggleRequired(field.id)}
                          />
                          <label
                            htmlFor={`required-${field.id}`}
                            className="text-sm text-muted-foreground cursor-pointer select-none"
                          >
                            Required
                          </label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(field)}
                          className="h-8 w-8 p-0"
                          aria-label="Edit field"
                          title="Edit field"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomField(field.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label="Delete field"
                          title="Delete field"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Add / Edit Field Form */}
            {showAddField ? (
              renderEditor()
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startAdd}
                className="w-full border-dashed bg-transparent"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Field
              </Button>
            )}
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <Separator />

          {showAddField && <p className="text-xs text-muted-foreground">* You have unsaved changes above</p>}
          {!showAddField && 
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
          }
        </form>
      </DialogContent>
    </Dialog>
  )
}
type ChipsInputProps = {
  label?: string
  placeholder?: string
  values: string[]
  onChange: (values: string[]) => void
  addButtonText?: string
  className?: string
}

export function ChipsInput({
  label,
  placeholder = "Type an option and press Enter",
  values,
  onChange,
  addButtonText = "Add",
  className,
}: ChipsInputProps) {
  const [draft, setDraft] = React.useState("")

  const addValue = () => {
    const v = draft.trim()
    if (!v) return
    if (!values.includes(v)) onChange([...values, v])
    setDraft("")
  }

  const removeAt = (idx: number) => {
    const next = values.slice()
    next.splice(idx, 1)
    onChange(next)
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addValue()
    }
  }

  return (
    <div className={className}>
      {label ? <div className="text-sm font-medium mb-1">{label}</div> : null}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="text-sm"
        />
        <Button type="button" variant="secondary" onClick={addValue}>
          {addButtonText}
        </Button>
      </div>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-xs"
            >
              <span className="text-foreground/80">{v}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${v}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
