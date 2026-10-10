import type { ReactNode } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * A small renderer for the registration forms instructors build in ViBe
 * (react-jsonschema-form JSON Schema + uiSchema). It covers exactly the field
 * types the instructor form builder offers: text, email, textarea, select,
 * radio, checkbox, date and number. Unknown types fall back to a text input.
 */
export interface FieldSchema {
  type?: 'string' | 'number' | 'integer' | 'boolean';
  title?: string;
  description?: string;
  format?: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
}

export interface FormSchema {
  type?: 'object';
  title?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, FieldSchema>;
}

export type UiSchema = Record<string, { 'ui:widget'?: string; 'ui:placeholder'?: string; 'ui:help'?: string } | undefined> & {
  'ui:order'?: string[];
};

export type FormValues = Record<string, string | boolean>;
export type FormErrors = Record<string, string>;

type Widget = 'text' | 'email' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'number';

export function widgetFor(field: FieldSchema, ui?: UiSchema[string]): Widget {
  const w = ui?.['ui:widget'];
  if (field.type === 'boolean') return 'checkbox';
  if (field.enum) return w === 'radio' ? 'radio' : 'select';
  if (field.type === 'number' || field.type === 'integer' || w === 'updown') return 'number';
  if (field.format === 'date' || w === 'date') return 'date';
  if (field.format === 'email' || w === 'email') return 'email';
  if (w === 'textarea') return 'textarea';
  return 'text';
}

/** Field names in display order (uiSchema's `ui:order` first, then schema order). */
export function fieldOrder(schema: FormSchema, ui?: UiSchema): string[] {
  const names = Object.keys(schema.properties ?? {});
  const order = (ui?.['ui:order'] ?? []).filter((n) => names.includes(n));
  return [...order, ...names.filter((n) => !order.includes(n))];
}

export function initialValues(schema: FormSchema, prefill: Record<string, string | undefined> = {}): FormValues {
  const values: FormValues = {};
  for (const [name, field] of Object.entries(schema.properties ?? {})) {
    if (field.type === 'boolean') values[name] = field.default === true;
    else values[name] = prefill[name] ?? (field.default != null ? String(field.default) : '');
  }
  return values;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(schema: FormSchema, values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const required = new Set(schema.required ?? []);
  for (const [name, field] of Object.entries(schema.properties ?? {})) {
    const value = values[name];
    const label = field.title ?? name;
    if (field.type === 'boolean') {
      if (required.has(name) && value !== true) errors[name] = 'Please tick this box to continue.';
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
      if (required.has(name)) errors[name] = `${label} is required.`;
      continue;
    }
    if (field.format === 'email' && !EMAIL.test(text)) errors[name] = 'Enter a valid email address.';
    if (field.type === 'number' || field.type === 'integer') {
      const n = Number(text);
      if (Number.isNaN(n) || (field.type === 'integer' && !Number.isInteger(n))) errors[name] = 'Enter a whole number.';
      else if (field.minimum != null && n < field.minimum) errors[name] = `Must be at least ${field.minimum}.`;
      else if (field.maximum != null && n > field.maximum) errors[name] = `Must be at most ${field.maximum}.`;
    }
    if (field.minLength != null && text.length < field.minLength) errors[name] = `Use at least ${field.minLength} characters.`;
    if (field.maxLength != null && text.length > field.maxLength) errors[name] = `Use at most ${field.maxLength} characters.`;
  }
  return errors;
}

/** Converts form state to the JSON the backend stores: trimmed strings, real numbers, empty optionals dropped. */
export function toSubmission(schema: FormSchema, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(schema.properties ?? {})) {
    const value = values[name];
    if (field.type === 'boolean') {
      out[name] = value === true;
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) continue;
    if (field.type === 'number' || field.type === 'integer') {
      out[name] = Number(text);
    } else if (field.enum && typeof field.enum[0] === 'number') {
      out[name] = Number(text);
    } else {
      out[name] = text;
    }
  }
  return out;
}

export function SchemaFields({
  schema,
  uiSchema,
  values,
  errors,
  onChange,
  idPrefix = 'reg',
  disabled,
}: {
  schema: FormSchema;
  uiSchema?: UiSchema;
  values: FormValues;
  errors: FormErrors;
  onChange: (name: string, value: string | boolean) => void;
  idPrefix?: string;
  disabled?: boolean;
}) {
  const required = new Set(schema.required ?? []);
  return (
    <FieldGroup className="gap-5">
      {fieldOrder(schema, uiSchema).map((name) => {
        const field = schema.properties?.[name] ?? {};
        const ui = uiSchema?.[name];
        const id = `${idPrefix}-${name.replace(/\W+/g, '-')}`;
        const error = errors[name];
        const errorId = `${id}-error`;
        const help = field.description ?? ui?.['ui:help'];
        const helpId = `${id}-help`;
        const describedBy = [help && helpId, error && errorId].filter(Boolean).join(' ') || undefined;
        const label = field.title ?? name;
        const labelText = (
          <span>
            {label}
            {!required.has(name) && <OptionalTag />}
          </span>
        );
        const widget = widgetFor(field, ui);
        const value = values[name];
        const invalid = error ? true : undefined;
        const common = { id, disabled, 'aria-invalid': invalid, 'aria-describedby': describedBy };
        const notes = (
          <>
            {help && <FieldDescription id={helpId}>{help}</FieldDescription>}
            {error && <FieldError id={errorId}>{error}</FieldError>}
          </>
        );

        if (widget === 'checkbox') {
          // shadcn "choice card": the whole bordered row is the label.
          return (
            <Field key={name} data-invalid={invalid}>
              <FieldLabel htmlFor={id}>
                <Field orientation="horizontal">
                  <Checkbox {...common} checked={value === true} onCheckedChange={(c) => onChange(name, c === true)} />
                  <FieldContent>
                    <FieldTitle className="leading-snug font-normal">{labelText}</FieldTitle>
                  </FieldContent>
                </Field>
              </FieldLabel>
              {notes}
            </Field>
          );
        }

        if (widget === 'radio') {
          return (
            <FieldSet key={name} data-invalid={invalid} className="gap-2">
              <FieldLegend variant="label" id={`${id}-label`}>
                {labelText}
              </FieldLegend>
              <RadioGroup
                aria-labelledby={`${id}-label`}
                aria-describedby={describedBy}
                disabled={disabled}
                value={String(value ?? '')}
                onValueChange={(v) => onChange(name, String(v))}
                className="grid gap-2 sm:grid-cols-2"
              >
                {field.enum?.map((opt) => {
                  const optId = `${id}-${String(opt).replace(/\W+/g, '-')}`;
                  return (
                    <FieldLabel key={String(opt)} htmlFor={optId}>
                      <Field orientation="horizontal">
                        <RadioGroupItem id={optId} value={String(opt)} />
                        <FieldTitle className="font-normal">{String(opt)}</FieldTitle>
                      </Field>
                    </FieldLabel>
                  );
                })}
              </RadioGroup>
              {notes}
            </FieldSet>
          );
        }

        let control: ReactNode;
        switch (widget) {
          case 'textarea':
            control = (
              <Textarea {...common} rows={3} placeholder={ui?.['ui:placeholder']} value={String(value ?? '')} onChange={(e) => onChange(name, e.target.value)} />
            );
            break;
          case 'select':
            control = (
              <NativeSelect {...common} className="w-full" value={String(value ?? '')} onChange={(e) => onChange(name, e.target.value)}>
                <NativeSelectOption value="">Choose an option</NativeSelectOption>
                {field.enum?.map((opt) => (
                  <NativeSelectOption key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            );
            break;
          case 'number':
            control = (
              <Input
                {...common}
                type="number"
                inputMode={field.type === 'integer' ? 'numeric' : 'decimal'}
                enterKeyHint="next"
                min={field.minimum}
                max={field.maximum}
                step={field.type === 'integer' ? 1 : 'any'}
                placeholder={ui?.['ui:placeholder']}
                value={String(value ?? '')}
                onChange={(e) => onChange(name, e.target.value)}
                className="h-11 sm:h-10"
              />
            );
            break;
          default:
            control = (
              <Input
                {...common}
                type={widget === 'email' ? 'email' : widget === 'date' ? 'date' : 'text'}
                autoComplete={/^(full\s*)?name$/i.test(name) ? 'name' : widget === 'email' ? 'email' : undefined}
                // Phone keyboards: no auto-capitalising emails, capitalise names, "Next" key.
                autoCapitalize={widget === 'email' ? 'none' : /name/i.test(name) ? 'words' : undefined}
                spellCheck={widget === 'email' ? false : undefined}
                enterKeyHint="next"
                placeholder={ui?.['ui:placeholder']}
                value={String(value ?? '')}
                onChange={(e) => onChange(name, e.target.value)}
                // iOS shrinks empty date inputs; keep them full width and left aligned.
                className={cn('h-11 sm:h-10', widget === 'date' && 'block w-full min-w-0 appearance-none text-left')}
              />
            );
        }

        return (
          <Field key={name} data-invalid={invalid}>
            <FieldLabel htmlFor={id}>{labelText}</FieldLabel>
            {control}
            {notes}
          </Field>
        );
      })}
    </FieldGroup>
  );
}

function OptionalTag() {
  return <span className="ml-1 font-normal text-muted-foreground">(optional)</span>;
}
