import { useState, useEffect } from 'react';
import { FileText, Edit, X, Loader2, Sparkles, Users, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Form from '@rjsf/shadcn';
import validator from "@rjsf/validator-ajv8";
import { useUpdateCourseItem, useCreateItem } from '@/hooks/hooks';
import FeedbackFormBuilder from '../student/components/FeedbackFormBuilder';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeedbackSubmissionsTable } from './FeedbackSubmissionTable';
import ConfirmationModal from './components/confirmation-modal';
import { buildEmptyFormData, normalizeSchemaOptions } from "@/utils/utils";


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
  moduleId,
  sectionId,
  courseId,
  courseVersionId,
  details,
  onRefetch,
  onDelete,
}: FeedbackFormEditorProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formBuilder, setFormBuilder] = useState(false)
  const [showDeleteFormModal, setShowDeleteFormModal]=useState(false)
  const [selectedTab, setSelectedTab] = useState<'create' | 'submissions'>('create');
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
  const createItem = useCreateItem();
  
  const handleCopyFeedbackForm = async () => {
    if (!details?.item || !moduleId || !sectionId || !courseVersionId) {
      toast.error("Missing required information to copy form");
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to copy "${details.item.name}"? This will create a new feedback form with same fields`
    );

    if (!confirmed) {
      return;
    }

    try {
      const currentItem = details.item;
      const copyPayload = {
        type: "FEEDBACK",
        name: `${currentItem.name} - copy`,
        description: currentItem.description,
        feedbackFormDetails: {
          jsonSchema: currentItem.details?.jsonSchema,
          uiSchema: currentItem.details?.uiSchema
        }
      };

      await createItem.mutateAsync({
        params: {
          path: {
            versionId: courseVersionId,
            moduleId: moduleId,
            sectionId: sectionId,
          },
        },
        body: copyPayload,
      });

      toast.success("Feedback form copied successfully!");
      onRefetch();
    } catch (error: any) {
      console.error('Copy failed', error);
      let message = "Failed to copy feedback form";
      
      if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error?.response?.data?.error) {
        message = error.response.data.error;
      } else if (error?.message) {
        message = error.message;
      }
      
      toast.error(message);
    }
  };
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
            courseId: courseId,
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
            courseId: courseId,
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
    <>
      <div className="h-full flex flex-col">
        <div className="border-b">
          <div className="md:p-6 pb-6">
            <div className="lg:flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold">{selectedItemName}</h1>
                  <p className="text-muted-foreground text-sm md:text-base">{details?.description || 'Manage your feedback form content'}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      Feedback Form
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 lg:mt-0">
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
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Update Form
                  </Button>
                )}
                <Button
                  onClick={handleCopyFeedbackForm}
                  variant="outline"
                  className="text-black bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                  disabled={isEditMode || createItem.isPending}
                >
                  {createItem.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  Copy Feedback Form
                </Button>
                <Button
                  onClick={()=>setShowDeleteFormModal(true)}
                  variant="outline"
                  className="border-border bg-background"
                  disabled={isEditMode}
                >
                  <X className="h-3 w-3 mr-1" />
                  Delete Form
                </Button>
              </div>
               <div className="relative group">
      <ConfirmationModal
        isOpen={showDeleteFormModal}
        onClose={() => setShowDeleteFormModal(false)}
        onConfirm={onDelete}
        title="Delete Form"
        description="This will delete this form. Are you sure you want to delete it?"
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        // isLoading={}
        loadingText="Deleting..."
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
        
            </div>
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="md:px-6 mb-4">
            <TabsList className="lg:w-fit w-full overflow-x-auto no-scrollbar">
              <TabsTrigger value="create" className="flex items-center gap-2 cursor-pointer">
                <Edit className="h-4 w-4" />
                Create
              </TabsTrigger>
              <TabsTrigger value="submissions" className="flex items-center gap-2 cursor-pointer">
                <Users className="h-4 w-4" />
                Submissions
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-hidden">

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsContent value="create" className="h-full m-0 mt-2">
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
                  {/* <div className="space-y-2">
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
                  </div> */}
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
                      disabled={!isEditMode} // optional: only enable in edit mode
                    >
                      <Sparkles className="h-4 w-4" />
                      Build Form
                    </Button>
                  </div>

                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                    {details &&
                      <div className="overflow-y-auto max-h-[70vh] pr-2">
                        <div className="max-w-lg mx-auto w-full space-y-4">
                          <div className="text-left items-start">
                          <Form
                            // schema={details?.item?.details?.jsonSchema}
                            schema={normalizeSchemaOptions(details?.item?.details?.jsonSchema)}
                            validator={validator}
                            uiSchema={details?.item?.details?.uiSchema}
                            onSubmit={onSubmit}
                            disabled={isSubmitting}
                           formData={buildEmptyFormData(details?.item?.details?.jsonSchema)}
                            
                          />
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="submissions" className="h-full m-0">
              <div className="p-6 w-full">
                <FeedbackSubmissionsTable
                  feedbackId={feedbackId}
                  courseId={courseId}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Build Form Dialog - moved outside TabsContent */}
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
            <DialogHeader className="p-5 border-b sticky top-0 bg-card z-20 flex items-center justify-between relative">
              <div>
                <DialogTitle className="text-xl text-center font-semibold">
                  Build Feedback Form
                </DialogTitle>
                <p className="text-sm text-center text-muted-foreground">
                  Customize your form layout and fields.
                </p>
              </div>

              {/* Close Button - Absolutely positioned */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFormBuilder(false)}
                className="h-8 w-8 rounded-full hover:bg-muted absolute right-4 top-4"
              >
                <X className="h-4 w-4" />
              </Button>
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
    </>
  );
}