import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChevronRight } from "lucide-react";

interface FeedbackFormProps {
  title: string;
  description?: string;
  isOptional?: boolean;
  jsonSchema: any;
  uiSchema?: any;
  onSubmit: (data: any) => void;
  onSkip?: () => void;
  isSubmitting?: boolean;
}

const customWidgets = {
  TextWidget: (props: any) => (
    <input
      {...props}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    />
  ),
  TextareaWidget: (props: any) => (
    <textarea
      {...props}
      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    />
  ),
  SelectWidget: (props: any) => (
    <select
      {...props}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {props.options.enumOptions.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
};

const customFieldTemplate = (props: any) => {
  const {
    id,
    classNames,
    style,
    label,
    help,
    required,
    description,
    errors,
    children,
  } = props;

  return (
    <div className={`space-y-2 ${classNames}`} style={style}>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-gray-900 dark:text-gray-100"
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <div className="space-y-1">
        {children}
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {errors && (
        <div className="text-destructive text-sm">{errors}</div>
      )}
      {help && (
        <div className="text-sm text-muted-foreground">{help}</div>
      )}
    </div>
  );
};

const FeedbackForm = ({
  title,
  description,
  isOptional = false,
  jsonSchema,
  uiSchema,
  onSubmit,
  onSkip,
  isSubmitting = false
}: FeedbackFormProps) => {
  const handleSubmit = (data: any) => {
    onSubmit(data.formData);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  // Custom form template to match shadcn styling
  const customFormTemplate = {
    Button: ({ children, ...props }: any) => (
      <div className="flex justify-center pt-4">
        <Button 
          type="submit" 
          disabled={isSubmitting || props.disabled}
          className="min-w-[200px] relative bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold shadow-lg border-2 border-amber-300"
          size="lg"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {children}
        </Button>
      </div>
    ),
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
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
              schema={jsonSchema}
              uiSchema={{
                ...uiSchema,
                "ui:classNames": "space-y-6",
              }}
              validator={validator}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              templates={{
                ...customFormTemplate,
                FieldTemplate: customFieldTemplate,
              }}
              widgets={customWidgets}
              showErrorList={false}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackForm;