import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AssessmentQuestion, AssessmentQuestionType } from '@/types/assessment.types';
import { createAssessmentQuestion } from '@/utils/assessmentQuestions';

interface AssessmentQuestionComposerProps {
  value: AssessmentQuestion;
  onChange: (next: AssessmentQuestion) => void;
}

const questionTypes: AssessmentQuestionType[] = ['MCQ', 'TRUE_FALSE', 'MULTIPLE_RESPONSE', 'DRAG_AND_DROP', 'DROPDOWN_BLANK'];

export function AssessmentQuestionComposer({ value, onChange }: AssessmentQuestionComposerProps) {
  const [draft, setDraft] = useState<AssessmentQuestion>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const emit = (next: AssessmentQuestion) => {
    setDraft(next);
    onChange(next);
  };

  const typeOptions = useMemo(() => draft.content.options ?? [], [draft.content.options]);
  const dragItems = useMemo(() => draft.content.dragItems ?? [], [draft.content.dragItems]);

  const updateType = (type: AssessmentQuestionType) => {
    const next = createAssessmentQuestion(type);
    next.id = draft.id;
    next.questionText = draft.questionText || next.questionText;
    emit(next);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background/70 p-4 shadow-sm">
      <div className="grid gap-2">
        <Label>Question Type</Label>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={draft.type}
          onChange={event => updateType(event.target.value as AssessmentQuestionType)}
        >
          {questionTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label>Question text</Label>
        <Textarea
          value={draft.questionText}
          onChange={event => emit({...draft, questionText: event.target.value})}
          placeholder="Prompt for the learner"
        />
      </div>

      {(draft.type === 'MCQ' || draft.type === 'MULTIPLE_RESPONSE') && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const nextOptions = [...(draft.content.options ?? []), `Option ${typeOptions.length + 1}`];
                emit({...draft, content: {...draft.content, options: nextOptions, correctAnswers: draft.content.correctAnswers ?? []}});
              }}
            >
              <Plus className="mr-1 h-3 w-3" /> Add option
            </Button>
          </div>
          {typeOptions.map((option, index) => (
            <div key={`${draft.id}-${index}`} className="flex items-center gap-2">
              <Input
                value={option}
                onChange={event => {
                  const nextOptions = [...typeOptions];
                  nextOptions[index] = event.target.value;
                  emit({...draft, content: {...draft.content, options: nextOptions}});
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const nextOptions = typeOptions.filter((_, itemIndex) => itemIndex !== index);
                  const nextCorrect = (draft.content.correctAnswers ?? []).filter(value => Number(value) !== index);
                  emit({...draft, content: {...draft.content, options: nextOptions, correctAnswers: nextCorrect}});
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {draft.type === 'TRUE_FALSE' && (
        <div className="grid gap-2">
          <Label>Correct answer</Label>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={String((draft.content.correctAnswers?.[0] ?? 0))}
            onChange={event => emit({...draft, content: {...draft.content, correctAnswers: [Number(event.target.value)]}})}
          >
            <option value="0">True</option>
            <option value="1">False</option>
          </select>
        </div>
      )}

      {draft.type === 'DRAG_AND_DROP' && (
        <div className="grid gap-2">
          <Label>Draggable items</Label>
          {dragItems.map((item, index) => (
            <div key={`${draft.id}-drag-${index}`} className="flex items-center gap-2">
              <Input
                value={item}
                onChange={event => {
                  const nextItems = [...dragItems];
                  nextItems[index] = event.target.value;
                  emit({...draft, content: {...draft.content, dragItems: nextItems}});
                }}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => {
                const nextItems = dragItems.filter((_, itemIndex) => itemIndex !== index);
                emit({...draft, content: {...draft.content, dragItems: nextItems}});
              }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => emit({...draft, content: {...draft.content, dragItems: [...dragItems, `Item ${dragItems.length + 1}`]}})}>
            <Plus className="mr-1 h-3 w-3" /> Add drag item
          </Button>
        </div>
      )}

      {draft.type === 'DROPDOWN_BLANK' && (
        <div className="grid gap-2">
          <Label>Blank options</Label>
          {Object.entries(draft.content.dropdownOptions ?? {}).map(([blankKey, options]) => (
            <div key={blankKey} className="space-y-2 rounded-lg border border-border p-3">
              <div className="text-sm font-medium">{blankKey}</div>
              {options.map((option, optionIndex) => (
                <Input
                  key={`${blankKey}-${optionIndex}`}
                  value={option}
                  onChange={event => {
                    const nextOptions = [...(draft.content.dropdownOptions?.[blankKey] ?? [])];
                    nextOptions[optionIndex] = event.target.value;
                    const nextDropdown = {...(draft.content.dropdownOptions ?? {}), [blankKey]: nextOptions};
                    emit({...draft, content: {...draft.content, dropdownOptions: nextDropdown}});
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
