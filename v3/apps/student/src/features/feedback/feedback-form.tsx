import { CheckCircle2Icon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

import {
  fieldName,
  isAnswered,
  type FormField,
  type FormValues,
} from './form-schema';

/**
 * Renders a feedback form from its fields. Shared by the student lesson and
 * the studio editor's preview, so teachers see exactly what students get.
 */
export function FeedbackFormFields({
  fields,
  values,
  onChange,
  errors = {},
  disabled,
  idPrefix = 'fb',
  cards,
}: {
  fields: FormField[];
  values: FormValues;
  onChange: (name: string, value: unknown) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  idPrefix?: string;
  /** One card per question with "1 of n" (the student lesson); plain fields otherwise. */
  cards?: boolean;
}) {
  return (
    <FieldGroup className={cards ? 'gap-4' : 'gap-8'}>
      {fields.map((f, i) => {
        const node = renderField(f, i);
        if (!cards) return node;
        const answered = isAnswered(
          f,
          values[fieldName(f) || `Question ${i + 1}`],
        );
        return (
          <Card
            key={f.key}
            data-invalid={!!errors[fieldName(f)] || undefined}
            className="gap-4 px-5 py-5 data-invalid:ring-destructive/40 sm:px-6"
          >
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className={answered ? 'text-primary' : undefined}>
                Question {i + 1} of {fields.length}
              </span>
              {answered && (
                <CheckCircle2Icon
                  className="size-3.5 text-primary"
                  aria-label="Answered"
                />
              )}
            </p>
            {node}
          </Card>
        );
      })}
    </FieldGroup>
  );

  function renderField(f: FormField, i: number) {
    // `name` is where the answer is stored; the label is what students read.
    const name = fieldName(f) || `Question ${i + 1}`;
    const id = `${idPrefix}-${i}`;
    const error = errors[name];
    const value = values[name];
    const label = (
      <>
        {f.label.trim() || `Question ${i + 1}`}
        {f.required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </>
    );
    const help = f.help ? <FieldDescription>{f.help}</FieldDescription> : null;
    const err = error ? <FieldError>{error}</FieldError> : null;

    if (f.kind === 'radio' || f.kind === 'rating') {
      const scale =
        f.kind === 'rating'
          ? Array.from({ length: f.max ?? 5 }, (_, n) => String(n + 1))
          : f.options;
      return (
        <FieldSet key={f.key} data-invalid={!!error || undefined}>
          <FieldLegend variant="label">{label}</FieldLegend>
          {help}
          <RadioGroup
            value={typeof value === 'string' ? value : ''}
            onValueChange={(v) => onChange(name, v)}
            disabled={disabled}
            aria-invalid={!!error || undefined}
            className={
              f.kind === 'rating'
                ? 'grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-2'
                : undefined
            }
          >
            {scale.map((opt, oi) =>
              f.kind === 'rating' ? (
                <FieldLabel
                  key={opt}
                  htmlFor={`${id}-${oi}`}
                  className="w-auto! transition-colors has-data-checked:border-primary has-data-checked:bg-primary has-data-checked:text-primary-foreground"
                >
                  <Field
                    orientation="horizontal"
                    className="relative h-11 p-0!"
                  >
                    <RadioGroupItem
                      value={opt}
                      id={`${id}-${oi}`}
                      className="sr-only"
                    />
                    <FieldTitle className="absolute inset-0 h-full w-full items-center justify-center text-base tabular-nums">
                      {opt}
                    </FieldTitle>
                  </Field>
                </FieldLabel>
              ) : (
                <Field key={opt} orientation="horizontal">
                  <RadioGroupItem value={opt} id={`${id}-${oi}`} />
                  <FieldLabel htmlFor={`${id}-${oi}`} className="font-normal">
                    {opt}
                  </FieldLabel>
                </Field>
              ),
            )}
          </RadioGroup>
          {f.kind === 'rating' && (
            <FieldDescription className="flex justify-between text-xs">
              <span>1 = lowest</span>
              <span>{f.max ?? 5} = highest</span>
            </FieldDescription>
          )}
          {err}
        </FieldSet>
      );
    }

    if (f.kind === 'checkboxes') {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <FieldSet key={f.key} data-invalid={!!error || undefined}>
          <FieldLegend variant="label">{label}</FieldLegend>
          {help}
          <FieldGroup data-slot="checkbox-group" className="gap-3">
            {f.options.map((opt, oi) => (
              <Field key={opt} orientation="horizontal">
                <Checkbox
                  id={`${id}-${oi}`}
                  checked={selected.includes(opt)}
                  disabled={disabled}
                  onCheckedChange={(c) =>
                    onChange(
                      name,
                      c
                        ? [...selected, opt]
                        : selected.filter((s) => s !== opt),
                    )
                  }
                />
                <FieldLabel htmlFor={`${id}-${oi}`} className="font-normal">
                  {opt}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
          {err}
        </FieldSet>
      );
    }

    if (f.kind === 'checkbox') {
      return (
        <Field
          key={f.key}
          orientation="horizontal"
          data-invalid={!!error || undefined}
        >
          <Checkbox
            id={id}
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(c) => onChange(name, c === true)}
            aria-invalid={!!error || undefined}
          />
          <FieldContent>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {help}
            {err}
          </FieldContent>
        </Field>
      );
    }

    return (
      <Field key={f.key} data-invalid={!!error || undefined}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {help}
        {f.kind === 'textarea' ? (
          <Textarea
            id={id}
            rows={4}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={f.placeholder || 'Your answer'}
            disabled={disabled}
            aria-invalid={!!error || undefined}
          />
        ) : f.kind === 'select' ? (
          <NativeSelect
            id={id}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(name, e.target.value)}
            disabled={disabled}
            aria-invalid={!!error || undefined}
          >
            <NativeSelectOption value="">
              {f.placeholder || 'Choose…'}
            </NativeSelectOption>
            {f.options.map((opt) => (
              <NativeSelectOption key={opt} value={opt}>
                {opt}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <Input
            id={id}
            type={
              f.kind === 'number'
                ? 'number'
                : f.kind === 'email'
                  ? 'email'
                  : f.kind === 'url'
                    ? 'url'
                    : f.kind === 'tel'
                      ? 'tel'
                      : f.kind === 'date'
                        ? 'date'
                        : 'text'
            }
            min={f.kind === 'number' ? f.min : undefined}
            max={f.kind === 'number' ? f.max : undefined}
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder={
              f.placeholder ||
              (f.kind === 'url'
                ? 'https://'
                : f.kind === 'date'
                  ? undefined
                  : 'Your answer')
            }
            disabled={disabled}
            aria-invalid={!!error || undefined}
            className="max-w-md"
          />
        )}
        {err}
      </Field>
    );
  }
}
