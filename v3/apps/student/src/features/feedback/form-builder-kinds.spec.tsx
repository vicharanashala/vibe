import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { FormBuilder } from './form-builder';
import { blankField, fieldsToSchema, type FormField } from './form-schema';

function Harness({ allowOther, start = [] as FormField[], onFields }: { allowOther?: boolean; start?: FormField[]; onFields: (f: FormField[]) => void }) {
  const [fields, setFields] = useState<FormField[]>(start);
  return (
    <FormBuilder
      allowOther={allowOther}
      fields={fields}
      initialActiveKey={start[0]?.key ?? null}
      onChange={(next) => {
        setFields(next);
        onFields(next);
      }}
    />
  );
}

describe('form builder: new kinds', () => {
  it('adds a linear scale with a range and end labels', async () => {
    let fields: FormField[] = [];
    render(<Harness onFields={(f) => (fields = f)} />);
    await userEvent.click(screen.getByRole('button', { name: /Add question/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Linear scale/ }));
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'How useful?' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Label for 1 (optional)'), { target: { value: 'Not useful' } });
    fireEvent.change(screen.getByLabelText('Label for 10 (optional)'), { target: { value: 'Very useful' } });
    expect(fields[0]).toMatchObject({ kind: 'scale', label: 'How useful?', min: 1, max: 10, minLabel: 'Not useful', maxLabel: 'Very useful' });
  });

  it('adds a section heading, which can’t be required', async () => {
    let fields: FormField[] = [];
    render(<Harness onFields={(f) => (fields = f)} />);
    await userEvent.click(screen.getByRole('button', { name: /Add question/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Section heading/ }));
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'About the video' } });
    expect(screen.queryByRole('switch', { name: 'Required' })).not.toBeInTheDocument();
    expect(fields[0]).toMatchObject({ kind: 'heading', label: 'About the video', required: false });
  });

  it('offers "Other (please specify)" on multiple choice only when allowed', async () => {
    const radio = { ...blankField('radio'), label: 'Hardest part?' };
    let fields: FormField[] = [];
    const { unmount } = render(<Harness start={[radio]} onFields={(f) => (fields = f)} />);
    expect(screen.queryByRole('switch', { name: /Add “Other/ })).not.toBeInTheDocument();
    unmount();
    render(<Harness allowOther start={[radio]} onFields={(f) => (fields = f)} />);
    await userEvent.click(screen.getByRole('switch', { name: /Add “Other/ }));
    expect(fields[0].other).toBe(true);
    expect(fieldsToSchema(fields).jsonSchema.properties?.['Hardest part? (other)']).toBeDefined();
  });
});
