import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type FormItemData = {
  _id: string;
  name: string;
  description: string;
};

interface FormItemProps {
  item: FormItemData;
  onSave: (data: {
    name: string;
    description: string;
  }) => void;
  onDelete: () => void;
  isInstructor: boolean;
}

export default function FormItem({ item, onSave, onDelete, isInstructor }: FormItemProps) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      description: description.trim()
    });
    setIsEditing(false);
  };

  if (isInstructor) {
    if (isEditing) {
      return (
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="text-lg font-semibold">Edit Form</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="form-name">Title</Label>
              <Input
                id="form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="form-description">Description</Label>
              <Textarea
                id="form-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                className="mt-1"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">{name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setIsEditing(true)} 
              size="sm" 
              variant="outline"
            >
              Edit
            </Button>
            <Button 
              onClick={onDelete} 
              size="sm" 
              variant="destructive"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Student view (simplified)
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">{item.name}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
    </div>
  );
}
