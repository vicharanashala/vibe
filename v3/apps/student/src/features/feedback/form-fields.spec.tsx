import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { FeedbackFormFields } from './feedback-form';
import { blankField, type FormField, type FormValues } from './form-schema';

const fields: FormField[] = [
  { ...blankField('heading'), label: 'About the video', help: 'A few quick questions.' },
  { ...blankField('scale'), label: 'How useful?', min: 1, max: 5, minLabel: 'Not useful', maxLabel: 'Very useful' },
  { ...blankField('radio'), label: 'Hardest part?', options: ['Theory', 'Code'], other: true },
];

function Harness({ onValues }: { onValues: (v: FormValues) => void }) {
  const [values, setValues] = useState<FormValues>({});
  return (
    <FeedbackFormFields
      cards
      fields={fields}
      values={values}
      onChange={(name, v) =>
        setValues((prev) => {
          const next = { ...prev, [name]: v };
          onValues(next);
          return next;
        })
      }
    />
  );
}

describe('new field kinds in the student form', () => {
  it('shows a heading as a heading, not a numbered question', () => {
    render(<Harness onValues={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'About the video' })).toBeInTheDocument();
    expect(screen.getByText('A few quick questions.')).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument();
  });

  it('shows a scale with labelled ends and stores the number', async () => {
    let values: FormValues = {};
    render(<Harness onValues={(v) => (values = v)} />);
    expect(screen.getByText('1 = Not useful')).toBeInTheDocument();
    expect(screen.getByText('5 = Very useful')).toBeInTheDocument();
    await userEvent.click(screen.getByText('4', { exact: true }));
    expect(values['How useful?']).toBe(4);
  });

  it('shows a text box when Other is picked', async () => {
    let values: FormValues = {};
    render(<Harness onValues={(v) => (values = v)} />);
    expect(screen.queryByPlaceholderText('Please specify')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Other', { exact: true }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Hardest part?: other (please specify)' }), 'Debugging');
    expect(values).toMatchObject({ 'Hardest part?': 'Other', 'Hardest part? (other)': 'Debugging' });
  });
});
