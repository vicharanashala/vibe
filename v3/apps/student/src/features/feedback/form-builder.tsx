import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CircleDotIcon,
  CopyIcon,
  HashIcon,
  LinkIcon,
  ListIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  StarIcon,
  TextIcon,
  ToggleLeftIcon,
  TrashIcon,
  TypeIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { FeedbackFormFields } from '@/features/feedback/feedback-form';
import {
  blankField,
  fieldKey,
  KIND_LABELS,
  type FieldKind,
  type FormField,
} from '@/features/feedback/form-schema';

const KIND_ICONS: Record<FieldKind, LucideIcon> = {
  rating: StarIcon,
  text: TypeIcon,
  textarea: TextIcon,
  radio: CircleDotIcon,
  checkboxes: CheckSquareIcon,
  select: ListIcon,
  checkbox: ToggleLeftIcon,
  number: HashIcon,
  email: MailIcon,
  url: LinkIcon,
  tel: PhoneIcon,
  date: CalendarIcon,
};
const KIND_ORDER: FieldKind[] = [
  'rating',
  'text',
  'textarea',
  'radio',
  'checkboxes',
  'select',
  'checkbox',
  'number',
  'email',
  'url',
  'tel',
  'date',
];
const HAS_OPTIONS: FieldKind[] = ['radio', 'select', 'checkboxes'];
const HAS_PLACEHOLDER: FieldKind[] = [
  'text',
  'textarea',
  'number',
  'email',
  'url',
  'tel',
  'select',
];

/**
 * Question-card form builder shared by feedback forms and course registration
 * forms. Like Google Forms: one question open for editing, the others shown as
 * live previews. Fields are stored with features/feedback/form-schema.ts.
 */
export function FormBuilder({
  fields,
  onChange,
  initialActiveKey = null,
  kinds = KIND_ORDER,
}: {
  fields: FormField[];
  onChange: (next: FormField[]) => void;
  initialActiveKey?: string | null;
  /** Question types on offer (e.g. registration forms support fewer). */
  kinds?: FieldKind[];
}) {
  const [activeKey, setActiveKey] = useState<string | null>(initialActiveKey);

  function patch(key: string, change: Partial<FormField>) {
    onChange(fields.map((f) => (f.key === key ? { ...f, ...change } : f)));
  }
  function move(i: number, d: -1 | 1) {
    const next = [...fields];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  }

  return (
    <>
      <div className="grid gap-4">
        {fields.map((f, i) => (
          <FieldCard
            key={f.key}
            kinds={kinds}
            active={activeKey === f.key}
            onActivate={() => setActiveKey(f.key)}
            field={f}
            index={i}
            count={fields.length}
            onChange={(change) => patch(f.key, change)}
            onMove={(d) => move(i, d)}
            onDuplicate={() =>
              // A copy is a new question, so it gets its own stored key.
              onChange([
                ...fields.slice(0, i + 1),
                {
                  ...f,
                  key: fieldKey(),
                  name: undefined,
                  label: `${f.label} (copy)`,
                },
                ...fields.slice(i + 1),
              ])
            }
            onDelete={() => onChange(fields.filter((x) => x.key !== f.key))}
          />
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="lg"
              className="mt-4 w-full border-dashed text-muted-foreground"
            />
          }
        >
          <PlusIcon aria-hidden /> Add question
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          {kinds.map((k) => {
            const Icon = KIND_ICONS[k];
            return (
              <DropdownMenuItem
                key={k}
                onClick={() => {
                  const added = blankField(k);
                  onChange([...fields, added]);
                  setActiveKey(added.key);
                  setTimeout(
                    () =>
                      document.getElementById(`${added.key}-label`)?.focus(),
                    50,
                  );
                }}
              >
                <Icon /> {KIND_LABELS[k]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function FieldCard({
  kinds,
  field: f,
  index,
  count,
  active,
  onActivate,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  kinds: FieldKind[];
  active: boolean;
  onActivate: () => void;
  field: FormField;
  index: number;
  count: number;
  onChange: (patch: Partial<FormField>) => void;
  onMove: (d: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const Icon = KIND_ICONS[f.kind];
  const n = index + 1;

  if (!active) {
    return (
      <Card
        aria-label={`Question ${n}`}
        onClick={onActivate}
        className="cursor-pointer gap-3 px-5 py-4 transition-shadow hover:ring-primary/40 sm:px-6"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {n}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="size-3.5" aria-hidden /> {KIND_LABELS[f.kind]}
          </span>
          {f.required && <Badge variant="outline">Required</Badge>}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
          >
            <PencilIcon aria-hidden /> Edit
          </Button>
        </div>
        <div className="pointer-events-none" aria-hidden>
          {f.label.trim() ? (
            <FeedbackFormFields
              fields={[{ ...f, required: false }]}
              values={{}}
              onChange={() => undefined}
              disabled
              idPrefix={`mini-${f.key}`}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Untitled question
            </p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      aria-label={`Question ${n}`}
      className="gap-0 py-0 ring-2 ring-primary/40"
    >
      <CardHeader className="flex flex-wrap items-center gap-2 border-b py-3 [.border-b]:pb-3">
        <Badge className="tabular-nums">{n}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="gap-1.5" />}
          >
            <Icon aria-hidden /> {KIND_LABELS[f.kind]}{' '}
            <ChevronDownIcon className="opacity-60" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {kinds.map((k) => {
              const KIcon = KIND_ICONS[k];
              return (
                <DropdownMenuItem
                  key={k}
                  onClick={() => {
                    const base = blankField(k);
                    onChange({
                      kind: k,
                      options: HAS_OPTIONS.includes(k)
                        ? f.options.length
                          ? f.options
                          : base.options
                        : [],
                      min: base.min,
                      max: base.max,
                    });
                  }}
                >
                  <KIcon /> {KIND_LABELS[k]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <CardAction className="ml-auto flex items-center gap-3 self-center">
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel
              htmlFor={`${f.key}-req`}
              className="font-normal text-muted-foreground"
            >
              Required
            </FieldLabel>
            <Switch
              id={`${f.key}-req`}
              checked={f.required}
              onCheckedChange={(c) => onChange({ required: c === true })}
            />
          </Field>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Question ${n}: actions`}
                />
              }
            >
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={index === 0}
                onClick={() => onMove(-1)}
              >
                <ArrowUpIcon /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === count - 1}
                onClick={() => onMove(1)}
              >
                <ArrowDownIcon /> Move down
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <CopyIcon /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <TrashIcon /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="py-5">
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor={`${f.key}-label`}>Question</FieldLabel>
            <Input
              id={`${f.key}-label`}
              value={f.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="What do you want to ask?"
              className="text-base"
            />
          </Field>
          <Field>
            <FieldLabel
              htmlFor={`${f.key}-help`}
              className="font-normal text-muted-foreground"
            >
              Help text (optional)
            </FieldLabel>
            <Input
              id={`${f.key}-help`}
              value={f.help}
              onChange={(e) => onChange({ help: e.target.value })}
              placeholder="Shown under the question"
            />
          </Field>

          {HAS_PLACEHOLDER.includes(f.kind) && (
            <Field>
              <FieldLabel
                htmlFor={`${f.key}-ph`}
                className="font-normal text-muted-foreground"
              >
                Placeholder (optional)
              </FieldLabel>
              <Input
                id={`${f.key}-ph`}
                value={f.placeholder}
                onChange={(e) => onChange({ placeholder: e.target.value })}
                placeholder="Example text inside the empty field"
              />
            </Field>
          )}

          {HAS_OPTIONS.includes(f.kind) && (
            <FieldSet>
              <FieldLegend variant="label">Options</FieldLegend>
              <div className="grid gap-2">
                {f.options.map((opt, oi) => (
                  <InputGroup key={oi}>
                    <InputGroupAddon>
                      <InputGroupText className="w-4 justify-center tabular-nums">
                        {oi + 1}
                      </InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      value={opt}
                      onChange={(e) =>
                        onChange({
                          options: f.options.map((o, j) =>
                            j === oi ? e.target.value : o,
                          ),
                        })
                      }
                      placeholder={`Option ${oi + 1}`}
                      aria-label={`Question ${n}, option ${oi + 1}`}
                    />
                    {f.options.length > 2 && (
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          size="icon-xs"
                          aria-label={`Remove option ${oi + 1}`}
                          onClick={() =>
                            onChange({
                              options: f.options.filter((_, j) => j !== oi),
                            })
                          }
                        >
                          <XIcon />
                        </InputGroupButton>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() =>
                  onChange({
                    options: [...f.options, `Option ${f.options.length + 1}`],
                  })
                }
              >
                <PlusIcon aria-hidden /> Add option
              </Button>
            </FieldSet>
          )}

          {f.kind === 'rating' && (
            <Field className="w-48">
              <FieldLabel htmlFor={`${f.key}-scale`}>Scale</FieldLabel>
              <NativeSelect
                id={`${f.key}-scale`}
                value={String(f.max ?? 5)}
                onChange={(e) =>
                  onChange({ min: 1, max: Number(e.target.value) })
                }
              >
                {[3, 5, 7, 10].map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    1 to {m}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          {f.kind === 'number' && (
            <div className="grid grid-cols-2 gap-3 sm:w-80">
              <Field>
                <FieldLabel htmlFor={`${f.key}-min`}>Minimum</FieldLabel>
                <Input
                  id={`${f.key}-min`}
                  type="number"
                  value={f.min ?? ''}
                  onChange={(e) =>
                    onChange({
                      min:
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  placeholder="None"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${f.key}-max`}>Maximum</FieldLabel>
                <Input
                  id={`${f.key}-max`}
                  type="number"
                  value={f.max ?? ''}
                  onChange={(e) =>
                    onChange({
                      max:
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  placeholder="None"
                />
              </Field>
            </div>
          )}
          {f.kind === 'checkbox' && (
            <FieldDescription>
              Students see one tick box next to the question, e.g. “I watched
              the whole video”.
            </FieldDescription>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
