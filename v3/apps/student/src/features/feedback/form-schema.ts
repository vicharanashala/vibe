/**
 * Feedback forms are stored on the item as `details: { jsonSchema, uiSchema }`
 * (JSON Schema + react-jsonschema-form uiSchema). This is the exact shape the
 * old frontend's form builder writes and renders with rjsf, so we read and write
 * the same thing and forms stay interchangeable:
 *
 *   - one property per field, keyed by its label (submissions are keyed the same)
 *   - choices as `oneOf: [{const, title}]` plus `enum` for older readers
 *   - the widget in uiSchema[label]['ui:widget']; help/placeholder in ui:help/ui:placeholder
 *   - field order in uiSchema['ui:order'] (rjsf honours it; property order is the fallback)
 *
 * Two kinds the old builder lacked are encoded so rjsf still renders them:
 * a rating is a radio over "1".."N" (marked with ui:options.display = 'rating'),
 * and checkboxes are an array of unique enum strings with the 'checkboxes' widget.
 */

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'url'
  | 'tel'
  | 'date'
  | 'radio'
  | 'select'
  | 'checkboxes'
  | 'rating'
  | 'checkbox';

export interface FormField {
  key: string;
  kind: FieldKind;
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
  /** radio / select / checkboxes */
  options: string[];
  /** number: bounds; rating: scale size in max */
  min?: number;
  max?: number;
  /**
   * The property key answers are stored under, when the form came from storage.
   * It can differ from the label (e.g. key "Year", label "Year of study") and is
   * kept when the label is edited, so earlier answers still line up. New fields
   * have none and are keyed by their label.
   */
  name?: string;
  /** Stored as JSON Schema "integer" rather than "number". */
  integer?: boolean;
}

/** The key a field's answer is stored under. */
export function fieldName(f: FormField) {
  return f.name ?? f.label.trim();
}

type JsonSchema = {
  type?: string;
  properties?: Record<string, PropertySchema>;
  required?: string[];
  [key: string]: unknown;
};
type PropertySchema = {
  type?: string;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  oneOf?: { const: unknown; title?: string }[];
  items?: { type?: string; enum?: unknown[] };
  uniqueItems?: boolean;
  title?: string;
  description?: string;
};
type UiSchema = Record<string, any>;

let seq = 0;
export const fieldKey = () =>
  `f${Date.now().toString(36)}${(seq++).toString(36)}`;

export const KIND_LABELS: Record<FieldKind, string> = {
  text: 'Short answer',
  textarea: 'Paragraph',
  rating: 'Rating',
  radio: 'Multiple choice',
  checkboxes: 'Checkboxes',
  select: 'Dropdown',
  checkbox: 'Yes / no',
  number: 'Number',
  email: 'Email',
  url: 'Link',
  tel: 'Phone',
  date: 'Date',
};

export function blankField(kind: FieldKind = 'rating'): FormField {
  return {
    key: fieldKey(),
    kind,
    label: '',
    help: '',
    placeholder: '',
    required: kind === 'rating',
    options:
      kind === 'radio' || kind === 'select' || kind === 'checkboxes'
        ? ['Option 1', 'Option 2']
        : [],
    ...(kind === 'rating' ? { min: 1, max: 5 } : {}),
  };
}

function choiceValues(p: PropertySchema): string[] {
  if (p.oneOf?.length) return p.oneOf.map((o) => String(o.title ?? o.const));
  if (p.enum?.length) return p.enum.map(String);
  return [];
}

/** Reads a stored form. Unknown property shapes fall back to a short answer. */
export function schemaToFields(
  jsonSchema: JsonSchema | undefined,
  uiSchema: UiSchema | undefined,
): FormField[] {
  const props = jsonSchema?.properties ?? {};
  const ui = uiSchema ?? {};
  const required = new Set(jsonSchema?.required ?? []);
  const order: string[] = Array.isArray(ui['ui:order'])
    ? ui['ui:order'].filter((k: string) => k in props)
    : [];
  const names = [
    ...order,
    ...Object.keys(props).filter((k) => !order.includes(k)),
  ];

  return names.map((name) => {
    const p = props[name] ?? {};
    const u = ui[name] ?? {};
    const widget: string | undefined = u['ui:widget'];
    const display: string | undefined = u['ui:options']?.display;
    let kind: FieldKind = 'text';
    if (display === 'rating') kind = 'rating';
    else if (p.type === 'array') kind = 'checkboxes';
    else if (p.type === 'boolean') kind = 'checkbox';
    else if (p.type === 'number' || p.type === 'integer') kind = 'number';
    else if (p.oneOf?.length || p.enum?.length)
      kind = widget === 'select' ? 'select' : 'radio';
    else if (widget === 'textarea') kind = 'textarea';
    else if (p.format === 'email') kind = 'email';
    else if (p.format === 'uri') kind = 'url';
    else if (p.format === 'date' || widget === 'date') kind = 'date';
    else if (u['ui:options']?.inputType === 'tel') kind = 'tel';

    const options =
      kind === 'checkboxes'
        ? (p.items?.enum ?? []).map(String)
        : choiceValues(p);
    return {
      key: fieldKey(),
      kind,
      name,
      label: p.title ?? name,
      ...(p.type === 'integer' ? { integer: true } : {}),
      help: u['ui:help'] ?? p.description ?? '',
      placeholder: u['ui:placeholder'] ?? '',
      required: required.has(name),
      options: kind === 'rating' ? [] : options,
      ...(kind === 'rating' ? { min: 1, max: options.length || 5 } : {}),
      ...(kind === 'number' ? { min: p.minimum, max: p.maximum } : {}),
    };
  });
}

/** Problems that would make the stored form ambiguous or unusable, or null. */
export function formProblem(fields: FormField[]): string | null {
  if (fields.length === 0) return 'Add at least one question.';
  const labels = fields.map((f) => f.label.trim());
  const empty = labels.findIndex((l) => !l);
  if (empty !== -1) return `Question ${empty + 1} needs a label.`;
  const dup = labels.findIndex((l, i) => labels.indexOf(l) !== i);
  if (dup !== -1)
    return `Two questions are labelled “${labels[dup]}”. Please make labels unique.`;
  const names = fields.map(fieldName);
  const dupName = names.findIndex((n, i) => names.indexOf(n) !== i);
  if (dupName !== -1)
    return `Question ${dupName + 1} would be stored under “${names[dupName]}”, which another question already uses. Please rename it.`;
  const noOptions = fields.findIndex(
    (f) =>
      (f.kind === 'radio' || f.kind === 'select' || f.kind === 'checkboxes') &&
      f.options.filter((o) => o.trim()).length < 2,
  );
  if (noOptions !== -1)
    return `Question ${noOptions + 1} needs at least two options.`;
  return null;
}

export function fieldsToSchema(fields: FormField[]): {
  jsonSchema: JsonSchema;
  uiSchema: UiSchema;
} {
  const properties: Record<string, PropertySchema> = {};
  const required: string[] = [];
  const uiSchema: UiSchema = { 'ui:order': fields.map(fieldName) };

  for (const f of fields) {
    const name = fieldName(f);
    const label = f.label.trim();
    const options = f.options.map((o) => o.trim()).filter(Boolean);
    const ui: Record<string, unknown> = {};
    let p: PropertySchema;
    switch (f.kind) {
      case 'textarea':
        p = { type: 'string' };
        ui['ui:widget'] = 'textarea';
        break;
      case 'number':
        p = {
          type: f.integer ? 'integer' : 'number',
          ...(f.min !== undefined ? { minimum: f.min } : {}),
          ...(f.max !== undefined ? { maximum: f.max } : {}),
        };
        ui['ui:widget'] = 'updown';
        break;
      case 'email':
        p = { type: 'string', format: 'email' };
        ui['ui:widget'] = 'text';
        break;
      case 'url':
        p = { type: 'string', format: 'uri' };
        ui['ui:widget'] = 'text';
        break;
      case 'tel':
        p = { type: 'string', pattern: '^\\+?[0-9\\-\\s]{7,15}$' };
        ui['ui:options'] = { inputType: 'tel' };
        break;
      case 'date':
        p = { type: 'string', format: 'date' };
        ui['ui:widget'] = 'date';
        break;
      case 'checkbox':
        p = { type: 'boolean' };
        ui['ui:widget'] = 'checkbox';
        break;
      case 'radio':
      case 'select':
        p = {
          type: 'string',
          oneOf: options.map((o) => ({ const: o, title: o })),
          enum: options,
        };
        ui['ui:widget'] = f.kind;
        if (f.kind === 'radio') ui['ui:options'] = { inline: false };
        break;
      case 'checkboxes':
        p = {
          type: 'array',
          items: { type: 'string', enum: options },
          uniqueItems: true,
        };
        ui['ui:widget'] = 'checkboxes';
        break;
      case 'rating': {
        const scale = Array.from(
          { length: Math.max(2, Math.min(10, f.max ?? 5)) },
          (_, i) => String(i + 1),
        );
        p = {
          type: 'string',
          oneOf: scale.map((v) => ({ const: v, title: v })),
          enum: scale,
        };
        ui['ui:widget'] = 'radio';
        ui['ui:options'] = { inline: true, display: 'rating' };
        break;
      }
      default:
        p = { type: 'string' };
        ui['ui:widget'] = 'text';
    }
    if (f.help.trim()) ui['ui:help'] = f.help.trim();
    if (f.placeholder.trim()) ui['ui:placeholder'] = f.placeholder.trim();
    // The label is the title whenever it isn't simply the key.
    if (label !== name) p.title = label;
    properties[name] = p;
    uiSchema[name] = ui;
    if (f.required) required.push(name);
  }
  return { jsonSchema: { type: 'object', properties, required }, uiSchema };
}

export type FormValues = Record<string, unknown>;

export function isAnswered(f: FormField, v: unknown) {
  if (f.kind === 'checkbox') return v === true;
  return !(v === undefined || v === '' || (Array.isArray(v) && v.length === 0));
}

/** Client-side checks matching the schema; returns field name → message. */
export function validate(
  fields: FormField[],
  values: FormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const name = fieldName(f);
    const v = values[name];
    const empty =
      v === undefined ||
      v === '' ||
      (Array.isArray(v) && v.length === 0) ||
      (f.kind === 'checkbox' && v !== true);
    if (f.required && empty) {
      errors[name] =
        f.kind === 'checkbox'
          ? 'Please tick this to continue.'
          : 'This question is required.';
      continue;
    }
    if (empty) continue;
    if (f.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)))
      errors[name] = 'Enter a valid email address.';
    if (f.kind === 'url' && !/^https?:\/\/\S+\.\S+/.test(String(v)))
      errors[name] = 'Enter a link starting with http:// or https://.';
    if (f.kind === 'tel' && !/^\+?[0-9\-\s]{7,15}$/.test(String(v)))
      errors[name] = 'Enter a valid phone number.';
    if (f.kind === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) errors[name] = 'Enter a number.';
      else if (f.min !== undefined && n < f.min)
        errors[name] = `Enter ${f.min} or more.`;
      else if (f.max !== undefined && n > f.max)
        errors[name] = `Enter ${f.max} or less.`;
    }
  }
  return errors;
}

/** Drops unanswered optional fields and converts numbers, so the stored response matches the schema. */
export function toSubmission(
  fields: FormField[],
  values: FormValues,
): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const name = fieldName(f);
    const v = values[name];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
      if (f.kind === 'checkbox') out[name] = false;
      continue;
    }
    out[name] = f.kind === 'number' ? Number(v) : v;
  }
  return out;
}
