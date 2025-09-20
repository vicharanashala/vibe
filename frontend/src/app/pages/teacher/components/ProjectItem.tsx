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
  onClose,
  onSave,
  onDelete,
  isSaving = false,
  isDeleting = false,
}: ProjectItemProps) {
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');

  useEffect(() => {
    setName(initialValues?.name || '');
    setDescription(initialValues?.description || '');
  }, [initialValues, open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSave({ name: name.trim(), description: description.trim() });
    if (mode === 'add' && onClose) {
      setName('');
      setDescription('');
      onClose();
    }
  };

  // Modal style for add mode
  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">{mode === 'add' ? 'Add Project' : 'Edit Project'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                required
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter project description"
                required
                disabled={isSaving}
              />
            </div>
            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              {mode === 'edit' && onDelete && (
                <Button type="button" variant="destructive" onClick={onDelete} disabled={isSaving || isDeleting}>
                  Delete
                </Button>
              )}
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (mode === 'add' ? 'Saving...' : 'Updating...') : (mode === 'add' ? 'Save' : 'Update')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Inline style for edit mode
  return (
    <div className="space-y-6 p-4 border rounded-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter project name"
            className="mt-1"
            disabled={isSaving || isDeleting}
          />
        </div>
        <div>
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
