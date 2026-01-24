import React, { useState, useEffect } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Save, Trash2, X, Edit } from 'lucide-react';
import ConfirmationModal from './confirmation-modal';

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
  isAlreadyWatched: boolean;
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
  isAlreadyWatched
}: ProjectItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [cachedValues, setCachedValues] = useState({
    name: controlledName || '',
    description: controlledDescription || ''
  });

  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false)

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
      await onSave({ name: localName.trim(), description: localDescription.trim() });
      if (onClose) {
        setLocalName('');
        setLocalDescription('');
        onClose();
      }
    } else {
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

  const handleEditClick = () => {
    setCachedValues({
      name: controlledName || '',
      description: controlledDescription || ''
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    // Restore cached values
    if (onNameChange) onNameChange(cachedValues.name);
    if (onDescriptionChange) onDescriptionChange(cachedValues.description);
    setIsEditing(false);
  };

  const handleSubmitWrapper = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await handleSubmit(e);
    setIsEditing(false);
  };

  // View mode
  if (!isEditing && mode !== 'add') {
    return (
      <div className="space-y-6 p-4 border rounded-lg">
        <div className="space-y-4">
          <div>
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={controlledName || ''}
              disabled
              className="mt-1 bg-gray-50 dark:bg-gray-800"
            />
          </div>
          <div>
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={controlledDescription || ''}
              disabled
              className="mt-1 min-h-[100px] bg-gray-50 dark:bg-gray-800"
            />
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleEditClick}
            disabled={isSaving || isDeleting}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Project
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteProjectModal(true)}
              disabled={isSaving || isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          )}
        </div>
        <div className="relative group">
          <ConfirmationModal
            isOpen={showDeleteProjectModal}
            onClose={() => setShowDeleteProjectModal(false)}
            onConfirm={onDelete}
            title="Delete Project"
            description="This will delete this project. Are you sure you want to delete it?"
            confirmText="Delete"
            cancelText="Cancel"
            isDestructive={true}
            isLoading={isDeleting}
            loadingText="Deleting..."
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-6 p-4 border rounded-lg">
      <form onSubmit={handleSubmitWrapper} className="space-y-4">
        <div>
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            value={controlledName || ''}
            onChange={(e) => onNameChange?.(e.target.value)}
            placeholder="Enter project name"
            className="mt-1"
            disabled={isSaving || isDeleting}
            required
          />
        </div>
        <div>
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            value={controlledDescription || ''}
            onChange={(e) => onDescriptionChange?.(e.target.value)}
            placeholder="Enter project description"
            className="mt-1 min-h-[100px]"
            disabled={isSaving || isDeleting}
            required
          />
        </div>
        <div className="flex justify-end pt-4 border-t gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving || isDeleting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving || isDeleting}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
