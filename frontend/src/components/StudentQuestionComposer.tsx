import {useEffect, useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import type {
  StudentQuestionOptionInput,
  StudentQuestionSubmissionPayload,
} from '@/types/student-question.types';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function emptyOption(): StudentQuestionOptionInput {
  return {text: ''};
}

function initialPayload(): StudentQuestionSubmissionPayload {
  return {
    questionType: 'SELECT_ONE_IN_LOT',
    questionText: '',
    options: [emptyOption(), emptyOption()],
    correctOptionIndex: 0,
  };
}

interface StudentQuestionComposerProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: StudentQuestionSubmissionPayload) => Promise<void> | void;
}

export default function StudentQuestionComposer({
  isOpen,
  isSubmitting,
  onCancel,
  onSubmit,
}: StudentQuestionComposerProps) {
  const [payload, setPayload] = useState<StudentQuestionSubmissionPayload>(initialPayload);

  useEffect(() => {
    if (isOpen) {
      setPayload(initialPayload());
    }
  }, [isOpen]);

  const updateOption = (index: number, text: string) => {
    setPayload(current => ({
      ...current,
      options: current.options.map((option, i) => (i === index ? {text} : option)),
    }));
  };

  const addOption = () => {
    setPayload(current => {
      if (current.options.length >= MAX_OPTIONS) return current;
      return {...current, options: [...current.options, emptyOption()]};
    });
  };

  const removeOption = (index: number) => {
    setPayload(current => {
      if (current.options.length <= MIN_OPTIONS) return current;
      const nextOptions = current.options.filter((_, i) => i !== index);
      const nextCorrect =
        current.correctOptionIndex === index
          ? 0
          : current.correctOptionIndex > index
            ? current.correctOptionIndex - 1
            : current.correctOptionIndex;
      return {...current, options: nextOptions, correctOptionIndex: nextCorrect};
    });
  };

  const trimmedQuestion = payload.questionText.trim();
  const disabled =
    isSubmitting ||
    trimmedQuestion.length < 10 ||
    trimmedQuestion.length > 300 ||
    payload.options.length < MIN_OPTIONS ||
    payload.options.some(option => !option.text?.trim());

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="student-question-text" className="text-sm font-medium">
          Question prompt
        </Label>
        <Textarea
          id="student-question-text"
          placeholder="Write the MCQ prompt students should answer (10-300 characters)"
          className="min-h-[80px] resize-none text-sm"
          maxLength={300}
          value={payload.questionText}
          onChange={event =>
            setPayload(current => ({...current, questionText: event.target.value}))
          }
        />
        <p className="text-xs text-muted-foreground">
          {trimmedQuestion.length}/300 characters
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Options{' '}
            <span className="text-xs font-normal text-muted-foreground">
              — select the correct answer
            </span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={addOption}
            disabled={payload.options.length >= MAX_OPTIONS}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add option
          </Button>
        </div>

        {payload.options.map((option, index) => (
          <div key={`option-${index}`} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {OPTION_LABELS[index]}
            </span>
            <Input
              placeholder="Option text"
              className="h-8 flex-1 text-sm"
              maxLength={150}
              value={option.text}
              onChange={event => updateOption(index, event.target.value)}
            />
            <input
              type="radio"
              name="student-question-correct-option"
              checked={payload.correctOptionIndex === index}
              onChange={() =>
                setPayload(current => ({...current, correctOptionIndex: index}))
              }
              className="h-4 w-4 shrink-0 accent-primary"
              title="Mark as correct answer"
            />
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
              onClick={() => removeOption(index)}
              disabled={payload.options.length <= MIN_OPTIONS}
              title="Remove option"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSubmit(payload)}
          disabled={disabled}
        >
          {isSubmitting ? 'Submitting...' : 'Submit MCQ'}
        </Button>
      </div>
    </div>
  );
}
