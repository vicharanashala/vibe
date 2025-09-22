import React, { useState, useEffect } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Save, Trash2, X } from 'lucide-react';

interface ProjectItemProps {
  open?: boolean; // If true, render as modal (add mode)
  mode: 'add' | 'edit';
  initialValues?: { name: string; description: string };
  name?: string; // controlled for edit mode
  description?: string; // controlled for edit mode
  onNameChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
  onClose?: () => void;
  onSave: (data: { name: string; description: string }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  isSaving?: boolean;
  isDeleting?: boolean;
}

export default function ProjectItem({
  open = false,
  mode,
  initialValues,
  name: controlledName,
  description: controlledDescription,
  onNameChange,
  onDescriptionChange,
  onClose,
  onSave,
  onDelete,
  isSaving = false,
  isDeleting = false,
}: ProjectItemProps) {
  // Only use local state for add mode (modal)
  const [localName, setLocalName] = useState(initialValues?.name || '');
  const [localDescription, setLocalDescription] = useState(initialValues?.description || '');

  useEffect(() => {
    if (mode === 'add' && initialValues) {
      setLocalName(initialValues.name || '');
      setLocalDescription(initialValues.description || '');
    }
  }, [initialValues, mode]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (mode === 'add') {
      console.log('[ProjectItem] handleSubmit (add)', { name: localName, description: localDescription });
      await onSave({ name: localName.trim(), description: localDescription.trim() });
      if (onClose) {
        setLocalName('');
        setLocalDescription('');
        onClose();
      }
    } else {
      console.log('[ProjectItem] handleSubmit (edit)', { name: controlledName, description: controlledDescription });
      await onSave({ name: (controlledName || '').trim(), description: (controlledDescription || '').trim() });
    }
  };

  if (open) {
    // Add mode (modal): use local state
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Add Project</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={localName}
                onChange={(e) => {
                  setLocalName(e.target.value);
                  console.log('[ProjectItem] Name changed:', e.target.value);
                }}
                placeholder="Enter project name"
                required
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={localDescription}
                onChange={(e) => {
                  setLocalDescription(e.target.value);
                  console.log('[ProjectItem] Description changed:', e.target.value);
                }}
                placeholder="Enter project description"
                required
                disabled={isSaving}
              />
            </div>
            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Inline style for edit mode: controlled by parent
  return (
    <div className="space-y-6 p-4 border rounded-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            value={controlledName || ''}
            onChange={(e) => {
              onNameChange?.(e.target.value);
              console.log('[ProjectItem] Name changed (controlled):', e.target.value);
            }}
            placeholder="Enter project name"
            className="mt-1"
            disabled={isSaving || isDeleting}
          />
        </div>
        <div>
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            value={controlledDescription || ''}
            onChange={(e) => {
              onDescriptionChange?.(e.target.value);
              console.log('[ProjectItem] Description changed (controlled):', e.target.value);
            }}
            placeholder="Enter project description"
            className="mt-1 min-h-[100px]"
            disabled={isSaving || isDeleting}
          />
        </div>
        <div className="flex justify-end pt-4 border-t gap-2">
          {onClose && (
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          {onDelete && (
            <Button type="button" variant="destructive" onClick={onDelete} disabled={isSaving || isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Button type="submit" disabled={isSaving || isDeleting}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
