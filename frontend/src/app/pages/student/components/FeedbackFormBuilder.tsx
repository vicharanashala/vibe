import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Type,
  Mail,
  Hash,
  CheckSquare,
  Calendar,
  Phone,
  Link,
  AlignLeft,
  List,
  Radio,
  FileText,
  Trash2,
  Settings,
  ArrowDown,
  ArrowUp,
  Info,
  Regex,
  ListChecks,
  Plus,
  Eye,
  PlusCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { RJSFSchema } from '@rjsf/utils';
import ConfirmationModal from '../../teacher/components/confirmation-modal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'radio'
  | 'date'
  | 'tel'
  | 'url'

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
}

interface SelectOption {
  label: string;
  value: string;
}

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  validation: ValidationRule;
  options?: SelectOption[];
}

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  format?: 'email' | 'uri' | 'date' | 'date-time' | 'hostname' | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  oneOf?: { const: string; title: string }[];
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  default?: any;
}

const FIELD_TYPES = [
  { type: 'text' as FieldType, label: 'Text Input', icon: Type },
  { type: 'email' as FieldType, label: 'Email', icon: Mail },
  { type: 'number' as FieldType, label: 'Number', icon: Hash },
  { type: 'textarea' as FieldType, label: 'Text Area', icon: AlignLeft },
  { type: 'checkbox' as FieldType, label: 'Checkbox', icon: CheckSquare },
  { type: 'select' as FieldType, label: 'Dropdown', icon: List },
  { type: 'radio' as FieldType, label: 'Radio Group', icon: Radio },
  { type: 'date' as FieldType, label: 'Date Picker', icon: Calendar },
  { type: 'tel' as FieldType, label: 'Phone', icon: Phone },
  { type: 'url' as FieldType, label: 'URL', icon: Link },
];



interface FeedbackFormBuilderProps {
  fetchedSchemas?: {
    jsonSchema?: any;
    uiSchema?: any;
  };
  onSave: (schemas: { jsonSchema: any; uiSchema: any }) => Promise<void>;
  isSaving?: boolean;
  onCancel?: () => void;
}

const FeedbackFormBuilder = ({
  fetchedSchemas,
  onSave,
  isSaving = false,
  onCancel
}: FeedbackFormBuilderProps) => {
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldIdToDelete, setFieldIdToDelete] = useState("")
  const [isLoading, setIsLoading] = useState(true);

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const schemasToFields = (
    schema: RJSFSchema,
    ui: Record<string, any>,
  ): FormField[] => {
    const populatedFields: FormField[] = [];

    if (schema.properties) {
      Object.entries(schema.properties).forEach(([label, prop]) => {
        const typedProp = prop as JSONSchemaProperty;

        let fieldType: FieldType = 'text';
        
        //  Checking for select/radio before other type checks
        const widget = ui[label]?.['ui:widget'];
        const hasOptions = (typedProp.oneOf && typedProp.oneOf.length > 0) || 
                          (typedProp.enum && typedProp.enum.length > 0);
        
        if (hasOptions) {
          // If it has options, determine if it's radio or select based on widget
          fieldType = widget === 'radio' ? 'radio' : 'select';
        } else if (typedProp.type === 'number') {
          fieldType = 'number';
        } else if (typedProp.type === 'boolean') {
          fieldType = 'checkbox';
        } else if (typedProp.format === 'email') {
          fieldType = 'email';
        } else if (typedProp.format === 'date') {
          fieldType = 'date';
        } else if (typedProp.format === 'uri') {
          fieldType = 'url';
        } else if (widget === 'textarea') {
          fieldType = 'textarea';
        } else if (ui[label]?.['ui:options']?.inputType === 'tel') {
          fieldType = 'tel';
        }

        const validation: ValidationRule = {
          required: schema.required?.includes(label) || false,
          minLength: typedProp.minLength,
          maxLength: typedProp.maxLength,
          min: typedProp.minimum,
          max: typedProp.maximum,
          pattern: typedProp.pattern,
        };

        const placeholder = ui[label]?.['ui:placeholder'] || '';
        const helpText = ui[label]?.['ui:help'] || '';

        // Properly extract options, filtering out empty ones
        let options: SelectOption[] | undefined;
        if (typedProp.oneOf) {
          // Use oneOf (newer format) 
          options = typedProp.oneOf
            .filter(opt => opt.const && opt.const.trim() !== '') 
            .map(opt => ({
              label: opt.title || opt.const,
              value: opt.const,
            }));
        } else if (typedProp.enum) {
          // Fallback to enum (older format)
          options = typedProp.enum
            .filter(value => value && value.trim() !== '') 
            .map((value: string) => ({
              label: value.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              value,
            }));
        }

        const formField: FormField = {
          id: label.toLowerCase().replace(/\s+/g, '_'),
          type: fieldType,
          label,
          placeholder,
          helpText,
          validation,
          options,
        };

        populatedFields.push(formField);
      });
    }

    return populatedFields;
  };

  useEffect(() => {
    if (!fetchedSchemas) {
      setFields([]);
      setIsLoading(false);
      return;
    }

    const { jsonSchema, uiSchema } = fetchedSchemas;

    if (jsonSchema || uiSchema) {
      const populatedFields = schemasToFields(jsonSchema || { properties: {} }, uiSchema || {});
      setFields(populatedFields);
    } else {
      setFields([]);
    }

    setIsLoading(false);
  }, [fetchedSchemas]);

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      placeholder: '',
      helpText: '',
      validation: {
        required: false,  // Ensure new fields are not required by default
      },
      options:
        type === 'select' || type === 'radio'
          ? [
            { label: 'Option 1', value: 'option1' },
            { label: 'Option 2', value: 'option2' },
          ]
          : undefined,
    };

    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
    toast.success('Field added to form');
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const deleteField = () => {
    setFields(fields.filter((f) => f.id !== fieldIdToDelete));
    if (selectedFieldId === fieldIdToDelete) {
      setSelectedFieldId(null);
    }
    setFieldIdToDelete("")
    toast.success('Field removed');
  };

  const addOption = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || !field.options) return;

    const newOption: SelectOption = {
      label: `Option ${field.options.length + 1}`,
      value: `option${field.options.length + 1}`,
    };

    updateField(fieldId, {
      options: [...field.options, newOption],
    });
  };

  const updateOption = (
    fieldId: string,
    optionIndex: number,
    updates: Partial<SelectOption>,
  ) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || !field.options) return;

    const newOptions = [...field.options];
    newOptions[optionIndex] = { ...newOptions[optionIndex], ...updates };
    updateField(fieldId, { options: newOptions });
  };

  const deleteOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || !field.options || field.options.length <= 1) return;

    updateField(fieldId, {
      options: field.options.filter((_, i) => i !== optionIndex),
    });
  };

  const mapValidationToSchema = (validation: ValidationRule): Partial<JSONSchemaProperty> => {
    const schema: Partial<JSONSchemaProperty> = {};

    if (validation.required) schema['minLength'] = 1;
    if (validation.minLength !== undefined) schema.minLength = validation.minLength;
    if (validation.maxLength !== undefined) schema.maxLength = validation.maxLength;
    if (validation.min !== undefined) schema.minimum = validation.min;
    if (validation.max !== undefined) schema.maximum = validation.max;
    if (validation.pattern) schema.pattern = validation.pattern;

    return schema;
  };


  const buildSchemas = (): { jsonSchema: RJSFSchema; uiSchema: Record<string, any> } | null => {
    //  Check for empty labels
    const emptyLabelFields = fields.filter(f => !f.label || !f.label.trim());
    if (emptyLabelFields.length > 0) {
      toast.error('All fields must have a label');
      console.error('Fields with empty labels:', emptyLabelFields);
      return null;
    }

    // Check for duplicate labels
    const labels = fields.map(f => f.label.trim());
    const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
    if (duplicates.length > 0) {
      toast.error(`Duplicate field names: ${duplicates.join(', ')}`);
      return null;
    }

    //  Check select/radio have options
    const fieldsWithoutOptions = fields.filter(
      f => (f.type === 'select' || f.type === 'radio') && (!f.options || f.options.length === 0)
    );
    if (fieldsWithoutOptions.length > 0) {
      toast.error('All dropdown/radio fields must have at least one option');
      console.error('Fields without options:', fieldsWithoutOptions);
      return null;
    }

    const jsonSchema: RJSFSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    const uiSchema: Record<string, any> = {};

    fields.forEach((field) => {
      const { type, label, validation, options, placeholder, helpText } = field;
      const sanitizedLabel = label.trim();

      const fieldSchema: JSONSchemaProperty = { type: 'string' };

      switch (type) {
        case 'text':
          fieldSchema.type = 'string';
          break;
        case 'email':
          fieldSchema.type = 'string';
          fieldSchema.format = 'email';
          break;
        case 'number':
          fieldSchema.type = 'number';
          break;
        case 'textarea':
          fieldSchema.type = 'string';
          break;
        case 'checkbox':
          fieldSchema.type = 'boolean';
          break;
        case 'select':
        case 'radio':
          fieldSchema.type = 'string';
          
          //  Only use oneOf format, filter empty options
          if (options && options.length > 0) {
            const validOptions = options.filter(opt => opt.value && opt.value.trim() && opt.label && opt.label.trim());
            
            if (validOptions.length > 0) {
              fieldSchema.oneOf = validOptions.map(opt => ({
                const: opt.value,
                title: opt.label,
              }));
              
              // adding enum for backward compatibility
              fieldSchema.enum = validOptions.map(o => o.value);
            }
          }
          
          // not setting a default value for select/radio
          delete fieldSchema.default;
          break;
        case 'date':
          fieldSchema.type = 'string';
          fieldSchema.format = 'date';
          break;
        case 'tel':
          fieldSchema.type = 'string';
          fieldSchema.pattern = validation?.pattern || '^\\+?[0-9\\-\\s]{7,15}$';
          break;
        case 'url':
          fieldSchema.type = 'string';
          fieldSchema.format = 'uri';
          break;
        default:
          fieldSchema.type = 'string';
      }

      if (validation) Object.assign(fieldSchema, mapValidationToSchema(validation));

      if (validation?.required) jsonSchema.required?.push(sanitizedLabel);

      jsonSchema.properties![sanitizedLabel] = fieldSchema;

      const ui: Record<string, any> = {};
      if (placeholder) ui['ui:placeholder'] = placeholder;
      if (helpText) ui['ui:help'] = helpText;

      switch (type) {
        case 'textarea':
          ui['ui:widget'] = 'textarea';
          break;
        case 'number':
          ui['ui:widget'] = 'updown';
          break;
        case 'radio':
          ui['ui:widget'] = 'radio';
          ui['ui:options'] = { inline: true };
          break;
        case 'select':
          ui['ui:widget'] = 'select';
          break;
        case 'date':
          ui['ui:widget'] = 'date';
          break;
        case 'tel':
          ui['ui:options'] = { inputType: 'tel' };
          break;
        case 'checkbox':
          ui['ui:widget'] = 'checkbox';
          break;
        default:
          ui['ui:widget'] = 'text';
      }

      uiSchema[sanitizedLabel] = ui;
    });

    console.log('Schema built successfully:', { jsonSchema, uiSchema });
    return { jsonSchema, uiSchema };
  };
  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading form fields...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full ">
      <div className="container mx-auto ">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent pt-2">
              Form Builder
            </h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="me-2 w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Here you can manage the course registration form fields.
                  Only selected fields will be visible to students.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="sm:p-6 ">
          <ConfirmationModal
            isOpen={!!fieldIdToDelete}
            onClose={() => setFieldIdToDelete("")}
            onConfirm={deleteField}
            title="Delete Field"
            description="Are you sure you want to delete this field? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            isDestructive={true}
          />

          <div className="flex flex-col lg:gap-1 gap-3 h-[110vh]">
            <Card className="flex-shrink-0">
              <CardHeader className="sm:px-6 px-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-muted-foreground" />
                  Add Elements
                </CardTitle>
              </CardHeader>

              <CardContent className="">
                <ScrollArea className="max-h-24 min-h-fit">
                  <div className="flex flex-wrap gap-2">
                    {FIELD_TYPES.map((fieldType) => {
                      const Icon = fieldType.icon;
                      return (
                        <Button
                          key={fieldType.type}
                          variant="outline"
                          className="h-auto py-2 px-4 flex items-center gap-2 bg-transparent"
                          onClick={() => addField(fieldType.type)}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-xs">{fieldType.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="flex flex-col lg:flex-row lg:gap-1 gap-3 flex-1 pb-6">
              <Card className="flex-1 lg:flex-[2] flex flex-col min-w-0">
                <CardHeader className="sm:px-6 px-4 pb-2 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div><Eye className="w-4 h-4" /></div>
                      <div className='xl:text-lg lg:text-sm text-base'>Form Preview</div>
                    </CardTitle>
                    <div className="flex items-center xl:gap-2 lg:gap-1 gap-2">
                      <span className="text-xs text-muted-foreground">
                        {fields.length} {fields.length === 1 ? "field" : "fields"}
                      </span>
                      {fields.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setFormData({})} className="h-7 text-xs border-1">
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-4">
                  <ScrollArea className="h-[120%] pr-3">
                    {fields.length === 0 ? (
                      <div className="h-full flex items-center justify-center px-8">
                        <div className="text-center max-w-sm">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                          <h3 className="text-base font-semibold text-foreground mb-1">No fields yet</h3>
                          <p className="text-xs text-muted-foreground">Add elements from the top panel to build your form</p>
                        </div>
                      </div>
                    ) : (
                      <form
                        className="space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const schemas = buildSchemas();               
                          if (!schemas) {
                            console.error('Schema validation failed - cannot save');
                            return;
                          }
                          const { jsonSchema, uiSchema } = schemas;
                          onSave({ jsonSchema, uiSchema });
                        }}
                      >
                        {fields.map((field, index) => (
                          <div
                            key={field.id}
                            className={`relative group p-3 rounded-lg border-2 transition-all cursor-pointer ${selectedFieldId === field.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                              }`}
                            onClick={() => setSelectedFieldId(field.id)}
                          >
                            <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-50 w-10">
                              <Button
                                size="icon"
                                type="button"
                                variant="secondary"
                                className="h-7 w-7 shadow-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const newFields = [...fields]
                                  const fromIndex = index
                                  const toIndex = index - 1
                                    ;[newFields[fromIndex], newFields[toIndex]] = [newFields[toIndex], newFields[fromIndex]]
                                  setFields(newFields)
                                }}
                                disabled={index === 0}
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                type="button"
                                variant="secondary"
                                className="h-7 w-7 shadow-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const newFields = [...fields]
                                  const fromIndex = index
                                  const toIndex = index + 1
                                    ;[newFields[fromIndex], newFields[toIndex]] = [newFields[toIndex], newFields[fromIndex]]
                                  setFields(newFields)
                                }}
                                disabled={index === fields.length - 1}
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                type="button"
                                variant="destructive"
                                className="h-7 w-7 shadow-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFieldIdToDelete(field.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>

                            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                              <label className="text-xs font-medium flex items-center gap-1">
                                {field.label}
                                {field.validation.required && <span className="text-destructive">*</span>}
                              </label>

                              {field.type === "text" && (
                                <Input
                                  type="text"
                                  placeholder={field.placeholder}
                                  value={formData[field.id] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                  className="h-9"
                                />
                              )}

                              {field.type === "email" && (
                                <Input
                                  type="email"
                                  placeholder={field.placeholder}
                                  value={formData[field.id] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                  className="h-9"
                                />
                              )}

                              {field.type === "number" && (
                                <Input
                                  type="number"
                                  placeholder={field.placeholder}
                                  value={formData[field.id] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                  className="h-9"
                                />
                              )}

                              {field.type === "textarea" && (
                                <Textarea
                                  placeholder={field.placeholder}
                                  value={formData[field.id] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                  rows={3}
                                  className="resize-none"
                                />
                              )}

                              {field.type === "checkbox" && (
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={field.id}
                                    checked={formData[field.id] || false}
                                    onCheckedChange={(checked) => setFormData({ ...formData, [field.id]: checked })}
                                  />
                                  <label htmlFor={field.id} className="text-xs cursor-pointer">
                                    {field.placeholder || "Check this box"}
                                  </label>
                                </div>
                              )}

                              {field.type === "select" && (
                                <Select
                                  value={formData[field.id] ?? undefined}
                                  onValueChange={(value) => setFormData({ ...formData, [field.id]: value })}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder={field.placeholder || "Select an option"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {field.options?.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}

                              {field.type === "radio" && (
                                <div className="space-y-1.5">
                                  {field.options?.map((option) => (
                                    <div key={option.value} className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        id={`${field.id}_${option.value}`}
                                        name={field.id}
                                        value={option.value}
                                        checked={formData[field.id] === option.value}
                                        onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                        className="w-4 h-4"
                                      />
                                      <label htmlFor={`${field.id}_${option.value}`} className="text-xs cursor-pointer">
                                        {option.label}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {field.type === "date" && (
                                <Input
                                  type="date"
                                  value={formData[field.id] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                  className="h-9"
                                />
                              )}

                              {field.type === "tel" && (
                                <Input
                                  type="tel"
                                  placeholder={field.placeholder}
                                  value={formData[field.id] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                  className="h-9"
                                />
                              )}

                              {field.type === "url" && (
                                <Input
                                  type="url"
                                  placeholder={field.placeholder}
                                  value={formData[field.id] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                  className="h-9"
                                />
                              )}

                              {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
                            </div>
                          </div>
                        ))}

                        <Button
                          type="submit"
                          className="w-full h-9"
                          disabled={isSaving}
                        >
                          {isSaving ? "Saving Changes..." : "Save Form Changes"}
                        </Button>
                      </form>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="w-full lg:w-[380px] flex-shrink-0 flex flex-col max-h-[calc(100vh-150px)]">
                <CardHeader className="sm:px-6 px-4 pb-2 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Field Settings
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 min-h-0 p-0">
                  {!selectedField ? (
                    <div className="text-sm text-muted-foreground text-center py-12 px-4">
                      Select a field from the preview to configure its properties and validation rules.
                    </div>
                  ) : (
                    <ScrollArea className="h-full px-4 py-4">
                      <div className="space-y-6 px-1">
                        <div>
                          <label htmlFor="field-label" className="font-medium flex items-center gap-2">
                            <Type className="w-4 h-4 text-muted-foreground" />
                            Label
                          </label>
                          <Input
                            id="field-label"
                            value={selectedField.label}
                            onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                            className="mt-1.5"
                          />
                          <span className="text-xs text-muted-foreground">Display name of the field shown to users.</span>
                        </div>

                        {selectedField.type !== "checkbox" && selectedField.type !== "radio" && (
                          <div>
                            <label htmlFor="field-placeholder" className="font-medium flex items-center gap-2">
                              <AlignLeft className="w-4 h-4 text-muted-foreground" />
                              Placeholder
                            </label>
                            <Input
                              id="field-placeholder"
                              value={selectedField.placeholder || ""}
                              onChange={(e) =>
                                updateField(selectedField.id, {
                                  placeholder: e.target.value,
                                })
                              }
                              className="mt-1.5"
                            />
                            <span className="text-xs text-muted-foreground">
                              Shown inside the input before the user types.
                            </span>
                          </div>
                        )}

                        <div>
                          <label htmlFor="field-help" className="font-medium flex items-center gap-2">
                            <Info className="w-4 h-4 text-muted-foreground" />
                            Help Text
                          </label>
                          <Input
                            id="field-help"
                            value={selectedField.helpText || ""}
                            onChange={(e) =>
                              updateField(selectedField.id, {
                                helpText: e.target.value,
                              })
                            }
                            className="mt-1.5"
                          />
                          <span className="text-xs text-muted-foreground">Additional guidance shown below the field.</span>
                        </div>

                        <Separator />

                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-muted-foreground" />
                            Validation Rules
                          </h4>
                          {/* {(selectedField.type !== "url") && (<> */}

                          <div className="flex items-center gap-2 mb-3">
                            <Checkbox
                              id="field-required"
                              checked={selectedField.validation.required || false}
                              onCheckedChange={(checked) =>
                                updateField(selectedField.id, {
                                  validation: {
                                    ...selectedField.validation,
                                    required: !!checked,
                                  },
                                })
                              }
                              />
                            <label htmlFor="field-required" className="cursor-pointer">
                              Required field
                            </label>
                          </div>
                              {/* </>)} */}

                          {(selectedField.type === "text" ||
                            selectedField.type === "email" ||
                            selectedField.type === "textarea" ||
                            selectedField.type === "tel" ||
                            selectedField.type === "url") && (
                              <>
                                <div className="mb-3">
                                  <label htmlFor="field-minlength" className="flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-muted-foreground" />
                                    Minimum Length
                                  </label>
                                  <Input
                                    id="field-minlength"
                                    type="number"
                                    min="0"
                                    value={selectedField.validation.minLength || ""}
                                    onChange={(e) =>
                                      updateField(selectedField.id, {
                                        validation: {
                                          ...selectedField.validation,
                                          minLength: e.target.value ? Number(e.target.value) : undefined,
                                        },
                                      })
                                    }
                                    className="mt-1.5"
                                  />
                                </div>

                                <div className="mb-3">
                                  <label htmlFor="field-maxlength" className="flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-muted-foreground" />
                                    Maximum Length
                                  </label>
                                  <Input
                                    id="field-maxlength"
                                    type="number"
                                    min="0"
                                    value={selectedField.validation.maxLength || ""}
                                    onChange={(e) =>
                                      updateField(selectedField.id, {
                                        validation: {
                                          ...selectedField.validation,
                                          maxLength: e.target.value ? Number(e.target.value) : undefined,
                                        },
                                      })
                                    }
                                    className="mt-1.5"
                                  />
                                </div>
                              </>
                            )}

                          {selectedField.type === "number" && (
                            <>
                              <div className="mb-3">
                                <label htmlFor="field-min" className="flex items-center gap-2">
                                  <Hash className="w-4 h-4 text-muted-foreground" />
                                  Minimum Value
                                </label>
                                <Input
                                  id="field-min"
                                  type="number"
                                  value={selectedField.validation.min ?? ""}
                                  onChange={(e) =>
                                    updateField(selectedField.id, {
                                      validation: {
                                        ...selectedField.validation,
                                        min: e.target.value ? Number(e.target.value) : undefined,
                                      },
                                    })
                                  }
                                  className="mt-1.5"
                                />
                              </div>

                              <div className="mb-3">
                                <label htmlFor="field-max" className="flex items-center gap-2">
                                  <Hash className="w-4 h-4 text-muted-foreground" />
                                  Maximum Value
                                </label>
                                <Input
                                  id="field-max"
                                  type="number"
                                  value={selectedField.validation.max ?? ""}
                                  onChange={(e) =>
                                    updateField(selectedField.id, {
                                      validation: {
                                        ...selectedField.validation,
                                        max: e.target.value ? Number(e.target.value) : undefined,
                                      },
                                    })
                                  }
                                  className="mt-1.5"
                                />
                              </div>
                            </>
                          )}

                          {(selectedField.type === "text" ||
                            selectedField.type === "email" ||
                            selectedField.type === "tel" ||
                            selectedField.type === "url") && (
                              <div className="mb-3">
                                <label htmlFor="field-pattern" className="flex items-center gap-2">
                                  <Regex className="w-4 h-4 text-muted-foreground" />
                                  Pattern (Regex)
                                </label>
                                <Input
                                  id="field-pattern"
                                  value={selectedField.validation.pattern || ""}
                                  onChange={(e) =>
                                    updateField(selectedField.id, {
                                      validation: {
                                        ...selectedField.validation,
                                        pattern: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="e.g., ^[A-Z].*"
                                  className="mt-1.5"
                                />
                                <span className="text-xs text-muted-foreground">
                                  Defines a regex pattern the input must match.
                                </span>
                              </div>
                            )}
                        </div>

                        {(selectedField.type === "select" || selectedField.type === "radio") && (
                          <>
                            <Separator />
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold flex items-center gap-2">
                                  <ListChecks className="w-4 h-4 text-muted-foreground" />
                                  Options
                                </h4>
                                <Button size="sm" variant="outline" onClick={() => addOption(selectedField.id)}>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add Option
                                </Button>
                              </div>

                              <div className="space-y-2">
                                {selectedField.options?.map((option, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <div className="flex flex-col gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        if (index === 0) return;
                                        const newOptions = [...(selectedField.options || [])];
                                        [newOptions[index - 1], newOptions[index]] = [newOptions[index], newOptions[index - 1]];
                                        updateField(selectedField.id, { options: newOptions });
                                      }}
                                      disabled={index === 0}
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        if (!selectedField.options || index === selectedField.options.length - 1) return;
                                        const newOptions = [...selectedField.options];
                                        [newOptions[index], newOptions[index + 1]] = [newOptions[index + 1], newOptions[index]];
                                        updateField(selectedField.id, { options: newOptions });
                                      }}
                                      disabled={!selectedField.options || index === selectedField.options.length - 1}
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                    <Input
                                      value={option.label}
                                      onChange={(e) => {
                                        const label = e.target.value
                                        const value = label.trim() ? 
                                          label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") 
                                          : `option-${index}`;
                                        updateOption(selectedField.id, index, { label, value })
                                      }}
                                      placeholder="Option label"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => deleteOption(selectedField.id, index)}
                                      disabled={(selectedField.options?.length || 0) <= 1}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        <Separator />

                        <Button variant="destructive" className="w-full" onClick={() => setFieldIdToDelete(selectedField.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Field
                        </Button>
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackFormBuilder;