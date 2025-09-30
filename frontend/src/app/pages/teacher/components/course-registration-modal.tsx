import type React from 'react';
import {useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Separator} from '@/components/ui/separator';
import {Input} from '@/components/ui/input';
import {Checkbox} from '@/components/ui/checkbox';
import {Textarea} from '@/components/ui/textarea';
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
  Lock,
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
} from 'lucide-react';
import {toast} from 'sonner';
import { RJSFSchema } from '@rjsf/utils';
import ConfirmationModal from './confirmation-modal';


type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'radio'
  | 'date'
  | 'tel'
  | 'url'
  | 'file';

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

// Basic JSON Schema property definition
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;

  // String-specific
  format?: 'email' | 'uri' | 'date' | 'date-time' | 'hostname' | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number-specific
  minimum?: number;
  maximum?: number;

  // Enum / select
  enum?: string[];

  // Object / array
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;

  // Default value
  default?: any;
}

// interface JSONSchema {
//   title?: string;
//   description?: string;
//   type: 'object';
//   properties: Record<string, JSONSchemaProperty>;
//   required: string[];
// }

const FIELD_TYPES = [
  {type: 'text' as FieldType, label: 'Text Input', icon: Type},
  {type: 'email' as FieldType, label: 'Email', icon: Mail},
  {type: 'password' as FieldType, label: 'Password', icon: Lock},
  {type: 'number' as FieldType, label: 'Number', icon: Hash},
  {type: 'textarea' as FieldType, label: 'Text Area', icon: AlignLeft},
  {type: 'checkbox' as FieldType, label: 'Checkbox', icon: CheckSquare},
  {type: 'select' as FieldType, label: 'Dropdown', icon: List},
  {type: 'radio' as FieldType, label: 'Radio Group', icon: Radio},
  {type: 'date' as FieldType, label: 'Date Picker', icon: Calendar},
  {type: 'tel' as FieldType, label: 'Phone', icon: Phone},
  {type: 'url' as FieldType, label: 'URL', icon: Link},
  {type: 'file' as FieldType, label: 'File Upload', icon: FileText},
];

export const FormBuilder = ({versionId}: {versionId: string}) => {
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);

  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>({
    title: 'A registration form',
    description: `A simple form for version ${versionId}`,
    type: 'object',
    properties: {},
    required: [],
  });
  const [uiSchema, setUiSchema] = useState<Record<string, any>>({});
  // Get selected field
  const selectedField = fields.find(f => f.id === selectedFieldId);

  // Add a new field to the form
  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      placeholder: '',
      helpText: '',
      validation: {},
      options:
        type === 'select' || type === 'radio'
          ? [
              {label: 'Option 1', value: 'option1'},
              {label: 'Option 2', value: 'option2'},
            ]
          : undefined,
    };

    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
    toast.success('Field added to form');
  };

  // Update field properties
  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => (f.id === id ? {...f, ...updates} : f)));
  };

  // Delete a field
  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
    toast.success('Field removed');
  };

  // Move field up/down
  const moveField = (id: string, direction: 'up' | 'down') => {
    const index = fields.findIndex(f => f.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === fields.length - 1)
    ) {
      return;
    }

    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [
      newFields[targetIndex],
      newFields[index],
    ];
    setFields(newFields);
    toast.success(`Field moved ${direction}`);
  };

  // Add option to select/radio field
  const addOption = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || !field.options) return;

    const newOption: SelectOption = {
      label: `Option ${field.options.length + 1}`,
      value: `option${field.options.length + 1}`,
    };

    updateField(fieldId, {
      options: [...field.options, newOption],
    });
  };

  // Update option
  const updateOption = (
    fieldId: string,
    optionIndex: number,
    updates: Partial<SelectOption>,
  ) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || !field.options) return;

    const newOptions = [...field.options];
    newOptions[optionIndex] = {...newOptions[optionIndex], ...updates};
    updateField(fieldId, {options: newOptions});
  };

  // Delete option
  const deleteOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || !field.options || field.options.length <= 1) return;

    updateField(fieldId, {
      options: field.options.filter((_, i) => i !== optionIndex),
    });
  };

  const mapValidationToSchema = (validation: ValidationRule): Partial<JSONSchemaProperty> => {
    return {
        ...(validation.minLength !== undefined && { minLength: validation.minLength }),
        ...(validation.maxLength !== undefined && { maxLength: validation.maxLength }),
        ...(validation.min !== undefined && { minimum: validation.min }),
        ...(validation.max !== undefined && { maximum: validation.max }),
        ...(validation.pattern && { pattern: validation.pattern }),
    };
   };

   const buildSchemas = (
): { jsonSchema: RJSFSchema ; uiSchema: Record<string, any> } => {
  const jsonSchema: RJSFSchema = {
    type: "object",
    properties: {},
    required: [],
  };

  const uiSchema: Record<string, any> = {};

  fields.forEach((field) => {
    const { type, label, validation, options, placeholder, helpText } = field;
    const fieldSchema: JSONSchemaProperty = { type: "string" };

    // --- Map type -> JSON Schema ---
    if (type === "email") {
      fieldSchema.format = "email";
    } else if (type === "number") {
      fieldSchema.type = "number";
    } else if (type === "checkbox") {
      fieldSchema.type = "boolean";
    } else if (type === "select" || type === "radio") {
      fieldSchema.enum = options?.map((opt) => opt.value);
    }

    // --- Add validations ---
    if (validation) {
      Object.assign(fieldSchema, mapValidationToSchema(validation));
    }

    // --- Required ---
    if (validation?.required) {
      jsonSchema.required?.push(label);
    }

    // Add to jsonSchema
    if(!jsonSchema.properties) jsonSchema.properties = {};
    jsonSchema.properties[label] = fieldSchema;

    // --- Build uiSchema ---
    const ui: Record<string, any> = {};
    if (placeholder) ui["ui:placeholder"] = placeholder;
    if (helpText) ui["ui:help"] = helpText;

    if (type === "password") ui["ui:widget"] = "password";
    else if (type === "textarea") ui["ui:widget"] = "textarea";
    else if (type === "number") ui["ui:widget"] = "updown";
    else if (type === "radio") ui["ui:widget"] = "radio";
    else if (type === "date") ui["ui:widget"] = "date";
    else if (type === "tel") ui["ui:options"] = { inputType: "tel" };

    uiSchema[label] = ui;
  });

  return { jsonSchema, uiSchema };
};

const handleSubmit = async () => {
  try {
    const { jsonSchema, uiSchema } = buildSchemas();

    setJsonSchema(jsonSchema);
    setUiSchema(uiSchema);

    console.log("Form submitted:", { jsonSchema, uiSchema, formData });

    toast.success("Form submitted successfully!");
  } catch (error) {
    console.error("Error submitting form:", error);
    toast.error("Something went wrong while submitting the form!");
  } finally {
    setIsConfirmationModalOpen(false);
  }
};

  return (
    <div className="p-6">
         <ConfirmationModal
                isOpen={isConfirmationModalOpen}
                onClose={() => {
                  setIsConfirmationModalOpen(false);
                }}
                onConfirm={handleSubmit}
                title="Approve Registration"
                description="Are you sure you want to approve this registration? This action cannot be undone."
                confirmText="Approve"
                cancelText="Cancel"
                isDestructive={false}
              />
    <div className="flex gap-6 h-[calc(100vh-180px)]">
     
      <div className="w-[380px] flex flex-col gap-4">
        <Card className="flex-shrink-0">
          <CardHeader>
            <CardTitle className="text-lg">Add Elements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map(fieldType => {
                const Icon = fieldType.icon;
                return (
                  <Button
                    key={fieldType.type}
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-2 bg-transparent"
                    onClick={() => addField(fieldType.type)}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{fieldType.label}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Field Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-scroll">
          {!selectedField ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Select a field from the preview to configure it
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="field-label">Label</label>
                <Input
                  id="field-label"
                  value={selectedField.label}
                  onChange={e =>
                    updateField(selectedField.id, {label: e.target.value})
                  }
                  className="mt-1.5"
                />
              </div>

              {/* Placeholder */}
              {selectedField.type !== 'checkbox' &&
                selectedField.type !== 'radio' &&
                selectedField.type !== 'file' && (
                  <div>
                    <label htmlFor="field-placeholder">Placeholder</label>
                    <Input
                      id="field-placeholder"
                      value={selectedField.placeholder || ''}
                      onChange={e =>
                        updateField(selectedField.id, {
                          placeholder: e.target.value,
                        })
                      }
                      className="mt-1.5"
                    />
                  </div>
                )}

              {/* Help Text */}
              <div>
                <label htmlFor="field-help">Help Text</label>
                <Input
                  id="field-help"
                  value={selectedField.helpText || ''}
                  onChange={e =>
                    updateField(selectedField.id, {
                      helpText: e.target.value,
                    })
                  }
                  className="mt-1.5"
                />
              </div>

              <Separator />

              {/* Validation Rules */}
              <div>
                <h4 className="font-semibold mb-3">Validation Rules</h4>

                {/* Required */}
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    id="field-required"
                    checked={selectedField.validation.required || false}
                    onCheckedChange={checked =>
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

                {/* Min/Max Length for text fields */}
                {(selectedField.type === 'text' ||
                  selectedField.type === 'email' ||
                  selectedField.type === 'password' ||
                  selectedField.type === 'textarea' ||
                  selectedField.type === 'tel' ||
                  selectedField.type === 'url') && (
                  <>
                    <div className="mb-3">
                      <label htmlFor="field-minlength">Minimum Length</label>
                      <Input
                        id="field-minlength"
                        type="number"
                        min="0"
                        value={selectedField.validation.minLength || ''}
                        onChange={e =>
                          updateField(selectedField.id, {
                            validation: {
                              ...selectedField.validation,
                              minLength: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            },
                          })
                        }
                        className="mt-1.5"
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="field-maxlength">Maximum Length</label>
                      <Input
                        id="field-maxlength"
                        type="number"
                        min="0"
                        value={selectedField.validation.maxLength || ''}
                        onChange={e =>
                          updateField(selectedField.id, {
                            validation: {
                              ...selectedField.validation,
                              maxLength: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            },
                          })
                        }
                        className="mt-1.5"
                      />
                    </div>
                  </>
                )}

                {/* Min/Max Value for number fields */}
                {selectedField.type === 'number' && (
                  <>
                    <div className="mb-3">
                      <label htmlFor="field-min">Minimum Value</label>
                      <Input
                        id="field-min"
                        type="number"
                        value={selectedField.validation.min ?? ''}
                        onChange={e =>
                          updateField(selectedField.id, {
                            validation: {
                              ...selectedField.validation,
                              min: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            },
                          })
                        }
                        className="mt-1.5"
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="field-max">Maximum Value</label>
                      <Input
                        id="field-max"
                        type="number"
                        value={selectedField.validation.max ?? ''}
                        onChange={e =>
                          updateField(selectedField.id, {
                            validation: {
                              ...selectedField.validation,
                              max: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            },
                          })
                        }
                        className="mt-1.5"
                      />
                    </div>
                  </>
                )}

                {/* Pattern for text fields */}
                {(selectedField.type === 'text' ||
                  selectedField.type === 'email' ||
                  selectedField.type === 'tel' ||
                  selectedField.type === 'url') && (
                  <div className="mb-3">
                    <label htmlFor="field-pattern">Pattern (Regex)</label>
                    <Input
                      id="field-pattern"
                      value={selectedField.validation.pattern || ''}
                      onChange={e =>
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
                  </div>
                )}
              </div>

              {/* Options for select/radio */}
              {(selectedField.type === 'select' ||
                selectedField.type === 'radio') && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">Options</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addOption(selectedField.id)}
                      >
                        Add Option
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {selectedField.options?.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={option.label}
                            onChange={e =>
                              updateOption(selectedField.id, index, {
                                label: e.target.value,
                                value: e.target.value
                                  .toLowerCase()
                                  .replace(/\s+/g, '_'),
                              })
                            }
                            placeholder="Option label"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              deleteOption(selectedField.id, index)
                            }
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

              {/* Delete Field Button */}
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => deleteField(selectedField.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Field
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RIGHT PANEL: Form Preview */}
      <Card className="flex-1 flex flex-col min-w-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Form Preview</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData({})}
              >
                Clear Form
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-scroll">
          {fields.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">No fields yet</p>
                <p className="text-sm mt-1">
                  Add elements from the left panel to start building your form
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full">
              <form onSubmit={(e: React.FormEvent)=> {
                e.preventDefault();
                setIsConfirmationModalOpen(true);
              }} className="space-y-6 pr-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`relative group p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                      selectedFieldId === field.id
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-muted'
                    }`}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedFieldId(field.id);
                    }}
                  >
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
                      <Button
                        size="icon"
                        type="button"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={e => {
                          e.stopPropagation();
                          moveField(field.id, 'up');
                        }}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>

                      <Button
                        size="icon"
                        type="button"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={e => {
                          e.stopPropagation();
                          moveField(field.id, 'down');
                        }}
                        disabled={index === fields.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>

                      <Button
                        size="icon"
                        type="button"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={e => {
                          e.stopPropagation();
                          deleteField(field.id);
                        }}
                      >
                        <span className="text-white text-lg font-bold">×</span>
                      </Button>
                    </div>
                    <div
                      className="space-y-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <label>
                        {field.label}
                        {field.validation.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </label>

                      {field.type === 'text' && (
                        <Input
                          type="text"
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.value,
                            })
                          }
                          required={field.validation.required}
                          minLength={field.validation.minLength}
                          maxLength={field.validation.maxLength}
                          pattern={field.validation.pattern}
                        />
                      )}

                      {field.type === 'email' && (
                        <Input
                          type="email"
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.value,
                            })
                          }
                          required={field.validation.required}
                          minLength={field.validation.minLength}
                          maxLength={field.validation.maxLength}
                        />
                      )}

                      {field.type === 'password' && (
                        <Input
                          type="password"
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.value,
                            })
                          }
                          required={field.validation.required}
                          minLength={field.validation.minLength}
                          maxLength={field.validation.maxLength}
                        />
                      )}

                      {field.type === 'number' && (
                        <Input
                          type="number"
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.value,
                            })
                          }
                          required={field.validation.required}
                          min={field.validation.min}
                          max={field.validation.max}
                        />
                      )}

                      {field.type === 'textarea' && (
                        <Textarea
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.value,
                            })
                          }
                          required={field.validation.required}
                          minLength={field.validation.minLength}
                          maxLength={field.validation.maxLength}
                          rows={4}
                        />
                      )}

                      {field.type === 'checkbox' && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={field.id}
                            checked={formData[field.id] || false}
                            onCheckedChange={checked =>
                              setFormData({
                                ...formData,
                                [field.id]: checked,
                              })
                            }
                            required={field.validation.required}
                          />
                          <label htmlFor={field.id} className="cursor-pointer">
                            {field.placeholder || 'Check this box'}
                          </label>
                        </div>
                      )}

                      {field.type === 'select' && (
                        <Select
                          value={formData[field.id] || ''}
                          onValueChange={value =>
                            setFormData({...formData, [field.id]: value})
                          }
                          required={field.validation.required}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                field.placeholder || 'Select an option'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Radio Group */}
                      {field.type === 'radio' && (
                        <div className="space-y-2">
                          {field.options?.map(option => (
                            <div
                              key={option.value}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="radio"
                                id={`${field.id}_${option.value}`}
                                name={field.id}
                                value={option.value}
                                checked={formData[field.id] === option.value}
                                onChange={e =>
                                  setFormData({
                                    ...formData,
                                    [field.id]: e.target.value,
                                  })
                                }
                                required={field.validation.required}
                                className="w-4 h-4"
                              />
                              <label
                                htmlFor={`${field.id}_${option.value}`}
                                className="cursor-pointer"
                              >
                                {option.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Date Input */}
                      {field.type === 'date' && (
                        <Input
                          type="date"
                          value={formData[field.id] || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.value,
                            })
                          }
                          required={field.validation.required}
                        />
                      )}

                      {/* Tel Input */}
                      {field.type === 'tel' && (
                        <Input
                          type="tel"
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.value,
                            })
                          }
                          required={field.validation.required}
                          minLength={field.validation.minLength}
                          maxLength={field.validation.maxLength}
                          pattern={field.validation.pattern}
                        />
                      )}

                      {/* URL Input */}
                      {field.type === 'url' && (
                        <Input
                          type="url"
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.value,
                            })
                          }
                          required={field.validation.required}
                          minLength={field.validation.minLength}
                          maxLength={field.validation.maxLength}
                        />
                      )}

                      {field.type === 'file' && (
                        <Input
                          type="file"
                          onChange={e =>
                            setFormData({
                              ...formData,
                              [field.id]: e.target.files?.[0],
                            })
                          }
                          required={field.validation.required}
                        />
                      )}

                      {field.helpText && (
                        <p className="text-sm text-muted-foreground">
                          {field.helpText}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <Button type="submit">Save changes</Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
     <div className="mt-6 max-h-120 min-h-80 overflow-y-scroll p-4 rounded border space-y-4 w-full">
        <h3 className="font-semibold">JSON Schema</h3>
        <pre className="p-4 rounded">{JSON.stringify(jsonSchema, null, 2)}</pre>

        <h3 className="font-semibold mt-4">UI Schema</h3>
        <pre className="p-4 rounded">{JSON.stringify(uiSchema, null, 2)}</pre>
      </div>
    </div>
  );
};
