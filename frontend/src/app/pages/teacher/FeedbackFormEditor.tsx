import React, { useState, useEffect } from 'react';
import { FileText, Edit, X, Loader2, Sparkles } from 'lucide-react';
import { CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch'; // Make sure you have this
import Form from '@rjsf/shadcn';
import validator from "@rjsf/validator-ajv8";
import { useUpdateCourseItem } from '@/hooks/hooks';
import FeedbackFormBuilder from '../student/components/FeedbackFormBuilder';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FeedbackFormEditorProps {
  isLoading?: boolean;
  selectedItemName: string;
  feedbackId: string;
  moduleId?: string;
  sectionId?: string;
  courseId: string;
  courseVersionId: string;
  details: any;
  onRefetch: () => void;
  onDelete: () => void;
}

export default function FeedbackFormEditor({
  isLoading = false,
  selectedItemName,
  feedbackId,
  courseId,
  courseVersionId,
  details,
  onRefetch,
  onDelete,
}: FeedbackFormEditorProps) {
  console.log('details ', details)
  console.log("json ", details?.item?.details?.jsonSchema)
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formBuilder, setFormBuilder] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    isOptional: false,
    details: {
      jsonSchema: '',
      uiSchema: ''
    },
    type: 'FEEDBACK'
  });
  const updateItem = useUpdateCourseItem();
  // Load real data from props
  useEffect(() => {
    if (details) {
      setForm({
        name: details.item.name || '',
        description: details.item.description || '',
        isOptional: !!details.item.isOptional,
        details: {
          jsonSchema: details?.item?.details?.jsonSchema,
          uiSchema: details?.item?.details?.uiSchema
        },
        type: 'FEEDBACK'
      });
    }
  }, [details]);
  console.log('details ', details)
  const handleEdit = () => setIsEditMode(true);

  const handleCancel = () => {
    setIsEditMode(false);
    if (details) {
      setForm({
        name: details.name || '',
        description: details.description || '',
        isOptional: !!details.isOptional,
        details: {
          jsonSchema: details?.item?.details?.jsonSchema,
          uiSchema: details?.item?.details?.uiSchema
        },
        type: 'FEEDBACK'
      });
    }
  };
  const handleSaveSchemas = async (schemas: { jsonSchema: any; uiSchema: any }) => {
    setForm(prev => ({
      ...prev,
      details: {
        jsonSchema: schemas.jsonSchema,
        uiSchema: schemas.uiSchema,
      }
    }));

    try {
      await updateItem.mutateAsync({
        params: {
          path: {
            versionId: courseVersionId,
            itemId: feedbackId,
          },
        },
        body: {
          ...form,
          details: {
            jsonSchema: schemas.jsonSchema,
            uiSchema: schemas.uiSchema,
          }
        },
      });

      toast.success("Form saved successfully!");
      onRefetch();
      setFormBuilder(false); // Close builder after save
      setIsEditMode(false);
    } catch (err) {
      toast.error("Failed to save form");
    }
  };
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateItem.mutateAsync({
        params: {
          path: {
            versionId: courseVersionId,
            itemId: feedbackId,
          },
        },
        body: form,
      });
      toast.success("Feedback Form updated successfully")
      onRefetch();
      setIsEditMode(false);
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setIsSaving(false);
    }
  };
  const onSubmit = () => {
    alert("Submitted")
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - unchanged */}
      <div>
        <div className="pb-4">
          <div className="flex lg:flex-row flex-col gap-3 items-center justify-between">
            <div className="flex items-center gap-3 w-full">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl">{selectedItemName}</CardTitle>
                <div className="flex flex-wrap items-center gap-4 mt-foreground mt-1 text-sm text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    Feedback Form
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex lg:flex-nowrap flex-wrap items-center gap-2 justify-center">
              {isEditMode ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleEdit}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-all duration-300"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Update Form
                </Button>
              )}

              <Button
                onClick={onDelete}
                variant="outline"
                className="border-border bg-background ml-2"
                disabled={isEditMode}
              >
                <X className="h-3 w-3 mr-1" />
                Delete Form
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Box */}
      <div>
        <div className="p-6 space-y-6 bg-card rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="feedback-title">Title *</Label>
              <Input
                id="feedback-title"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Week 3 Feedback"
                disabled={!isEditMode}
              />
            </div>

            {/* Is Optional Toggle - replaces Points */}
            <div className="space-y-2">
              <Label>Is Optional</Label>
              <div className="flex items-center space-x-3">
                <Switch
                  checked={form.isOptional}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, isOptional: checked }))}
                  disabled={!isEditMode}
                />
                <span className="text-sm text-muted-foreground">
                  {form.isOptional ? 'Optional' : 'Required'}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="feedback-description">Description / Instructions *</Label>
            <Textarea
              id="feedback-description"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Explain what kind of feedback you expect from learners..."
              rows={4}
              disabled={!isEditMode}
            />
          </div>

          <Separator />

          {/* Build Form Button + Placeholder */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Your Feedback Form</h4>
                <p className="text-sm text-muted-foreground">Add more fields by clicking build form</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setFormBuilder(true)}
                // onClick={() => alert('Form builder coming soon!')} // replace later

                disabled={!isEditMode} // optional: only enable in edit mode
              >
                <Sparkles className="h-4 w-4" />
                Build Form
              </Button>
            </div>

            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
              {/* <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" /> */}
              {details &&
                <Form
                  schema={details?.item?.details?.jsonSchema}
                  validator={validator}
                  uiSchema={details?.item?.details?.uiSchema}
                  onSubmit={onSubmit}
                  disabled={isSubmitting}
                />}

              {/* {formBuilder && <FeedbackFormBuilder fetchedSchemas={details?.item?.details}
                onSave={handleSaveSchemas}
                isSaving={updateItem.isPending}
                onCancel={() => setFormBuilder(false)} />} */}

              <Dialog open={formBuilder} onOpenChange={setFormBuilder}>
                <DialogContent
                  className="
      max-w-[95vw]     /* nearly full width */
      w-full 
      h-[90vh]         /* tall but not full height */
      p-0 
      overflow-hidden  /* keeps inner scroll clean */
      rounded-xl 
      shadow-2xl
      border 
      bg-card
      animate-in 
      fade-in-0 
      zoom-in-95
    "
                >
                  {/* Sticky Header */}
                  <DialogHeader className="p-5 border-b sticky top-0 bg-card z-20">
                    <DialogTitle className="text-xl font-semibold">
                      Build Feedback Form
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Customize your form layout and fields.
                    </p>
                  </DialogHeader>

                  {/* Scrollable Body */}
                  <div className="p-6 overflow-y-auto h-full">
                    <FeedbackFormBuilder
                      fetchedSchemas={details?.item?.details}
                      onSave={handleSaveSchemas}
                      isSaving={updateItem.isPending}
                      onCancel={() => setFormBuilder(false)}
                    />
                  </div>
                </DialogContent>
              </Dialog>



            </div>
          </div>
        </div>
      </div>
    </div>
  );
}