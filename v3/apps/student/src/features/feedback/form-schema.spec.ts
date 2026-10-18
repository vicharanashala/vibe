import { describe, expect, it } from 'vitest';

import {
  blankField,
  fieldsToSchema,
  formProblem,
  schemaToFields,
  toSubmission,
  validate,
  type FormField,
} from './form-schema';

/** Shaped exactly like the old frontend builder's output (FeedbackFormBuilder.tsx buildSchema). */
const legacy = {
  jsonSchema: {
    type: 'object',
    properties: {
      'Your name': { type: 'string' },
      'How was it?': {
        type: 'string',
        oneOf: [
          { const: 'Good', title: 'Good' },
          { const: 'Bad', title: 'Bad' },
        ],
        enum: ['Good', 'Bad'],
      },
      Comments: { type: 'string' },
      Age: { type: 'number', minimum: 10, maximum: 99 },
      Email: { type: 'string', format: 'email' },
      Agree: { type: 'boolean' },
      Track: {
        type: 'string',
        oneOf: [
          { const: 'A', title: 'A' },
          { const: 'B', title: 'B' },
        ],
        enum: ['A', 'B'],
      },
    },
    required: ['How was it?', 'Agree'],
  },
  uiSchema: {
    'Your name': { 'ui:widget': 'text', 'ui:placeholder': 'Jane' },
    'How was it?': { 'ui:widget': 'radio', 'ui:options': { inline: true } },
    Comments: { 'ui:widget': 'textarea', 'ui:help': 'Anything else?' },
    Age: { 'ui:widget': 'updown' },
    Email: { 'ui:widget': 'text' },
    Agree: { 'ui:widget': 'checkbox' },
    Track: { 'ui:widget': 'select' },
  },
};

describe('feedback form schema', () => {
  it('reads forms built by the old frontend', () => {
    const fields = schemaToFields(legacy.jsonSchema, legacy.uiSchema);
    expect(fields.map((f) => [f.label, f.kind, f.required])).toEqual([
      ['Your name', 'text', false],
      ['How was it?', 'radio', true],
      ['Comments', 'textarea', false],
      ['Age', 'number', false],
      ['Email', 'email', false],
      ['Agree', 'checkbox', true],
      ['Track', 'select', false],
    ]);
    expect(fields[0].placeholder).toBe('Jane');
    expect(fields[2].help).toBe('Anything else?');
    expect(fields[1].options).toEqual(['Good', 'Bad']);
    expect([fields[3].min, fields[3].max]).toEqual([10, 99]);
  });

  it('writes them back in the same shape, with an explicit field order', () => {
    const { jsonSchema, uiSchema } = fieldsToSchema(
      schemaToFields(legacy.jsonSchema, legacy.uiSchema),
    );
    expect(jsonSchema.properties).toEqual(legacy.jsonSchema.properties);
    expect(jsonSchema.required).toEqual(legacy.jsonSchema.required);
    expect(uiSchema['ui:order']).toEqual(
      Object.keys(legacy.jsonSchema.properties),
    );
    expect(uiSchema['Comments']).toEqual({
      'ui:widget': 'textarea',
      'ui:help': 'Anything else?',
    });
  });

  it('round-trips the kinds the old builder lacked', () => {
    const fields: FormField[] = [
      { ...blankField('rating'), label: 'Rate it', max: 7 },
      {
        ...blankField('checkboxes'),
        label: 'Topics',
        options: ['Arrays', 'Maps'],
      },
    ];
    const { jsonSchema, uiSchema } = fieldsToSchema(fields);
    // rjsf-compatible encodings
    expect(uiSchema['Rate it']).toMatchObject({
      'ui:widget': 'radio',
      'ui:options': { display: 'rating' },
    });
    expect(jsonSchema.properties?.['Topics']).toMatchObject({
      type: 'array',
      items: { enum: ['Arrays', 'Maps'] },
      uniqueItems: true,
    });
    const back = schemaToFields(jsonSchema, uiSchema);
    expect(back.map((f) => [f.kind, f.max ?? null, f.options])).toEqual([
      ['rating', 7, []],
      ['checkboxes', null, ['Arrays', 'Maps']],
    ]);
  });

  it('rejects forms that would store answers ambiguously', () => {
    expect(formProblem([])).toMatch(/at least one/);
    expect(
      formProblem([
        { ...blankField('text'), label: 'A' },
        { ...blankField('text'), label: 'A ' },
      ]),
    ).toMatch(/unique/);
    expect(
      formProblem([
        { ...blankField('radio'), label: 'Pick', options: ['Only one'] },
      ]),
    ).toMatch(/two options/);
  });

  it('validates answers and shapes the submission', () => {
    const fields = schemaToFields(legacy.jsonSchema, legacy.uiSchema);
    expect(validate(fields, { Email: 'nope', Age: '5' })).toEqual({
      'How was it?': 'This question is required.',
      Agree: 'Please tick this to continue.',
      Email: 'Enter a valid email address.',
      Age: 'Enter 10 or more.',
    });
    expect(
      toSubmission(fields, {
        'How was it?': 'Good',
        Age: '42',
        Agree: true,
        Comments: '',
      }),
    ).toEqual({ 'How was it?': 'Good', Age: 42, Agree: true });
  });
});
