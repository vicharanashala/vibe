import { useMemo, useState } from 'react';
import { Grip, ListChecks, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { AssessmentQuestion, AssessmentQuestionType } from '@/types/assessment.types';

interface RendererProps {
  question: AssessmentQuestion;
  answer?: unknown;
  onAnswerChange?: (value: unknown) => void;
}

function renderDropdownBlanks(questionText: string, dropdownOptions?: Record<string, string[]>) {
  const parts = questionText.split(/(\{\{[^}]+\}\})/g).filter(Boolean);
  return parts.map((part, index) => {
    const match = part.match(/\{\{(.*?)\}\}/);
    if (!match) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }
    const blankKey = match[1];
    const options = dropdownOptions?.[blankKey] ?? [];
    return (
      <span key={`${blankKey}-${index}`} className="inline-flex items-center gap-2">
        <span className="font-medium text-foreground">{part}</span>
        <select className="rounded-md border border-border bg-background px-2 py-1 text-sm">
          <option value="">Select</option>
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </span>
    );
  });
}

function McqRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const selected = answer as number | undefined;
  return (
    <div className="grid gap-2">
      <RadioGroup
        value={selected?.toString()}
        onValueChange={value => onAnswerChange?.(Number(value))}
      >
        {question.content.options?.map((option, index) => (
          <label key={`${question.id}-${option}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <RadioGroupItem value={index.toString()} id={`${question.id}-${index}`} />
            <span>{option}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function TrueFalseRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const selected = answer as number | undefined;
  return (
    <div className="flex gap-2">
      {[0, 1].map(optionIndex => (
        <Button
          key={`${question.id}-${optionIndex}`}
          type="button"
          variant={selected === optionIndex ? 'default' : 'outline'}
          onClick={() => onAnswerChange?.(optionIndex)}
          className="min-w-24"
        >
          {question.content.options?.[optionIndex] ?? (optionIndex === 0 ? 'True' : 'False')}
        </Button>
      ))}
    </div>
  );
}

function MultipleResponseRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const selection = (answer as number[] | undefined) ?? [];
  const toggle = (index: number) => {
    const next = selection.includes(index) ? selection.filter(item => item !== index) : [...selection, index];
    onAnswerChange?.(next);
  };

  return (
    <div className="grid gap-2">
      {question.content.options?.map((option, index) => (
        <label key={`${question.id}-${option}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <Checkbox checked={selection.includes(index)} onCheckedChange={() => toggle(index)} />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function DragAndDropRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const [items, setItems] = useState(question.content.dragItems ?? []);
  const selected = (answer as string[] | undefined) ?? items;
  const moveItem = (from: number, to: number) => {
    const next = [...selected];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setItems(next);
    onAnswerChange?.(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {selected.map((item, index) => (
        <div key={`${question.id}-${item}-${index}`} draggable className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm" onDragStart={() => {}}
          onDrop={() => moveItem(index, index)}
        >
          <span className="flex items-center gap-2">
            <Grip className="h-4 w-4 text-muted-foreground" />
            {item}
          </span>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => moveItem(index, Math.max(0, index - 1))}>Up</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => moveItem(index, Math.min(selected.length - 1, index + 1))}>Down</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DropdownBlankRenderer({ question }: RendererProps) {
  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {renderDropdownBlanks(question.questionText, question.content.dropdownOptions)}
      </div>
    </div>
  );
}

const registry: Record<AssessmentQuestionType, (props: RendererProps) => JSX.Element> = {
  MCQ: McqRenderer,
  TRUE_FALSE: TrueFalseRenderer,
  MULTIPLE_RESPONSE: MultipleResponseRenderer,
  DRAG_AND_DROP: DragAndDropRenderer,
  DROPDOWN_BLANK: DropdownBlankRenderer,
};

export function AssessmentQuestionRenderer({ question, answer, onAnswerChange }: RendererProps) {
  const Renderer = useMemo(() => registry[question.type], [question.type]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquareQuote className="h-4 w-4" />
        {question.questionText}
      </div>
      <Renderer question={question} answer={answer} onAnswerChange={onAnswerChange} />
    </div>
  );
}
