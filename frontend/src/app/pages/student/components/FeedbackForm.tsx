
import validator from "@rjsf/validator-ajv8";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChevronRight } from "lucide-react";
import { useCourseStore } from "@/store/course-store";
import { useStartItem, useStopItem, useSubmitFeedback } from "@/hooks/hooks";
import { useEffect, useRef } from "react";
import { ISubmitFeedbackBody } from "@/components/Item-container";
import Form from "@rjsf/shadcn";
import { toast } from "sonner";
import { buildEmptyFormData, normalizeSchemaOptions } from "@/utils/utils";
import { FocusableSelectWidget } from "./FocusableSelectWidget";
import { AlignedFieldTemplate } from "./AlignedFieldTemplate";
import { CustomSubmitButton } from "./CustomSubmitButton";

interface FeedbackFormProps {
  title: string;
  description?: string;
  isOptional?: boolean;
  jsonSchema: any;
  uiSchema?: any;
  onSubmit: (data: any) => void;
  onSkip?: () => void;
  isSubmitting?: boolean;
  onNext: () => void
  isAlreadyWatched?: boolean;
  completedItemIdsRef: React.RefObject<Set<string>>;
  previousItem?: object
}

const FeedbackForm = ({
  title,
  description,
  isOptional = false,
  jsonSchema,
  uiSchema,
  onSubmit,
  onSkip,
  isSubmitting = false,
  onNext,
  isAlreadyWatched,
  completedItemIdsRef,
  previousItem
}: FeedbackFormProps) => {
  const watchItemIdRef = useRef<string | null>(null);

  const startItem = useStartItem();
  const stopItem = useStopItem();
  const { currentCourse, setWatchItemId } = useCourseStore();
  const submitFeedback = useSubmitFeedback(currentCourse?.itemId || '')
  const watchItemId = watchItemIdRef.current


  // useEffect(() => {
  //   handleSendStartItem()
  // }, [])
  useEffect(() => {
    if (!currentCourse?.itemId) return;
    if (!currentCourse?.moduleId) return;
    if (!currentCourse?.sectionId) return;

    handleSendStartItem();
  }, [
    currentCourse?.itemId,
    currentCourse?.moduleId,
    currentCourse?.sectionId,
  ]);

  useEffect(() => {
    if (startItem.data?.watchItemId) {
      watchItemIdRef.current = startItem.data.watchItemId;
      setWatchItemId(startItem.data.watchItemId);
    }
  }, [startItem.data?.watchItemId, setWatchItemId]);

  function handleSendStartItem() {
    if (!currentCourse?.itemId) return;
    if(!isAlreadyWatched && (currentCourse!.itemId && !completedItemIdsRef.current.has(currentCourse!.itemId))){
      startItem.mutate({
        params: {
          path: {
            courseId: currentCourse.courseId,
            courseVersionId: currentCourse.versionId ?? '',
          },
        },
        body: {
          itemId: currentCourse.itemId,
          moduleId: currentCourse.moduleId ?? '',
          sectionId: currentCourse.sectionId ?? '',
          cohortId: currentCourse.cohortId ?? '',
        }
      });
    }
  }
  // const handleSubmit = async ({formData}:any ) => {
  //   const payload: ISubmitFeedbackBody = {
  //     details: formData,
  //     courseId: currentCourse?.courseId || '',
  //     courseVersionId: currentCourse?.versionId || '',
  //     isSkipped: false
  //   };

  //   try {
  //     await submitFeedback.mutateAsync(payload);
  //       stopItem.mutate({
  //   params: {
  //     path: {
  //       courseId: currentCourse!.courseId,
  //       courseVersionId: currentCourse!.versionId ?? '',
  //     },
  //   },
  //   body: {
  //     watchItemId: watchItemId ?? '',
  //     itemId: currentCourse!.itemId ?? '',
  //     moduleId: currentCourse!.moduleId ?? '',
  //     sectionId: currentCourse!.sectionId ?? '',
  //   }
  // });
  //     onNext(); 
  //   } catch (err) {
  //     console.error("Feedback submit failed:", err);
  //   }
  // }

  const handleSubmit = async ({ formData }: any) => {
    const payload: ISubmitFeedbackBody = {
      details: formData,
      courseId: currentCourse?.courseId || "",
      courseVersionId: currentCourse?.versionId || "",
      // isSkipped: false,
      cohortId: currentCourse?.cohortId ?? '',
    };


    try {
      // 1️⃣ If this fails, it immediately goes to catch
       const result = await submitFeedback.mutateAsync(payload);
       toast.success(result.message);

      // 2️⃣ Only runs if submitFeedback succeeded
      if(!isAlreadyWatched && (currentCourse!.itemId && !completedItemIdsRef.current.has(currentCourse!.itemId))){
        await stopItem.mutateAsync({
          params: {
            path: {
              courseId: currentCourse!.courseId,
              courseVersionId: currentCourse!.versionId ?? "",
            },
          },
          body: {
            watchItemId: watchItemId ?? "",
            itemId: currentCourse!.itemId ?? "",
            moduleId: currentCourse!.moduleId ?? "",
            sectionId: currentCourse!.sectionId ?? "",
            cohortId: currentCourse!.cohortId ?? '',
          },
        });
      }
      completedItemIdsRef.current.add(currentCourse!.itemId!);
      // 3️⃣ Only when both succeed
      onNext();

    } catch (err) {
      console.error("Feedback submit or stopItem failed:", err);
    }
  };




  const handleSkip = () => {
    // onSkip();
    stopItem.mutate({
      params: {
        path: {
          courseId: currentCourse!.courseId,
          courseVersionId: currentCourse!.versionId ?? '',
        },
      },
      body: {
        watchItemId: watchItemId ?? '',
        itemId: currentCourse!.itemId ?? '',
        moduleId: currentCourse!.moduleId ?? '',
        sectionId: currentCourse!.sectionId ?? '',
        cohortId: currentCourse!.cohortId ?? '',
      }
    });
    onNext()

  };
 


  return (
    <div>{ previousItem === null || previousItem === undefined ? (      <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Static Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Feedback Form
        </h1>
        {description && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {description}
          </p>
        )}
      </div>

      {/* Form Card */}
      <Card className="w-full">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold">{title}</CardTitle>
              <CardDescription className="text-sm">
                Please fill out the form below
              </CardDescription>
            </div>
            {isOptional && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Optional</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="text-muted-foreground flex items-center gap-1"
                  size="sm"
                >
                  Skip
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="max-h-[60vh] overflow-y-auto pr-4">            
            <Form
              // schema={jsonSchema}
              schema={normalizeSchemaOptions(jsonSchema)}
              validator={validator}
              uiSchema={uiSchema}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              formData={buildEmptyFormData(jsonSchema)}
              templates={{
                  FieldTemplate: AlignedFieldTemplate,
                  ButtonTemplates: {
                    SubmitButton: CustomSubmitButton,
                  },
                }}
              widgets={{
                SelectWidget: FocusableSelectWidget, 
              }}
             
            />
          </div>
        </CardContent>
      </Card>
    </div>): (previousItem?.isCompleted ? (<div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Static Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Feedback Form
        </h1>
        {description && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {description}
          </p>
        )}
      </div>

      {/* Form Card */}
      <Card className="w-full">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold">{title}</CardTitle>
              <CardDescription className="text-sm">
                Please fill out the form below
              </CardDescription>
            </div>
            {isOptional && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Optional</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="text-muted-foreground flex items-center gap-1"
                  size="sm"
                >
                  Skip
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="max-h-[60vh] overflow-y-auto pr-4">            
            <Form
              // schema={jsonSchema}
              schema={normalizeSchemaOptions(jsonSchema)}
              validator={validator}
              uiSchema={uiSchema}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              formData={buildEmptyFormData(jsonSchema)}
              templates={{
                  FieldTemplate: AlignedFieldTemplate,
                  ButtonTemplates: {
                    SubmitButton: CustomSubmitButton,
                  },
                }}
              widgets={{
                SelectWidget: FocusableSelectWidget, 
              }}
             
            />
          </div>
        </CardContent>
      </Card>
    </div>): <h1>{`This feed back form is locked please see previous video ${previousItem?.name}`}</h1>)}
    </div>
  );
}

export default FeedbackForm;