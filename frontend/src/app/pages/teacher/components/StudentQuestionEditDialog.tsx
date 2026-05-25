import {useEffect, useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import type {
  StudentQuestionListItem,
  UpdateStudentQuestionPayload,
} from '@/types/student-question.types';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface EditState {
  questionText: string;
  options: {text: string}[];
  correctOptionIndex: number;
}

function stateFromQuestion(question: StudentQuestionListItem): EditState {
  return {
    questionText: question.questionText,
    options: question.options.map(o => ({text: o.text})),
    correctOptionIndex: question.correctOptionIndex,
  };
}

interface StudentQuestionEditDialogProps {
  isOpen: boolean;
  question: StudentQuestionListItem | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: UpdateStudentQuestionPayload) => Promise<void> | void;
}

export default function StudentQuestionEditDialog({
  isOpen,
  question,
  isSubmitting,
  onCancel,
  onSubmit,
}: StudentQuestionEditDialogProps) {
  const [state, setState] = useState<EditState | null>(null);

  useEffect(() => {
    if (isOpen && question) {
      setState(stateFromQuestion(question));
    } else if (!isOpen) {
      setState(null);
    }
  }, [isOpen, question]);

  if (!state) return null;

  const updateOption = (index: number, text: string) => {
    setState(current => current && ({
      ...current,
      options: current.options.map((option, i) => (i === index ? {text} : option)),
    }));
  };

  const addOption = () => {
    setState(current => {
      if (!current) return current;
      if (current.options.length >= MAX_OPTIONS) return current;
      return {...current, options: [...current.options, {text: ''}]};
    });
  };

  const removeOption = (index: number) => {
    setState(current => {
      if (!current) return current;
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

  const trimmedQuestion = state.questionText.trim();
  const invalid =
    trimmedQuestion.length < 10 ||
    trimmedQuestion.length > 300 ||
    state.options.length < MIN_OPTIONS ||
    state.options.some(option => !option.text?.trim());

  const buildPayload = (status?: 'APPROVED'): UpdateStudentQuestionPayload => ({
    questionText: state.questionText,
    options: state.options.map(o => ({text: o.text.trim()})),
    correctOptionIndex: state.correctOptionIndex,
    ...(status ? {status} : {}),
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!isSubmitting && !open) {
          onCancel();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit student MCQ</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-question-text" className="text-sm font-medium">
              Question prompt
            </Label>
            <Textarea
              id="edit-question-text"
              className="min-h-[80px] resize-none text-sm"
              maxLength={300}
              value={state.questionText}
              onChange={event =>
                setState(current => current && ({...current, questionText: event.target.value}))
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
                disabled={state.options.length >= MAX_OPTIONS || isSubmitting}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add option
              </Button>
            </div>

            {state.options.map((option, index) => (
              <div key={`edit-option-${index}`} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {OPTION_LABELS[index]}
                </span>
                <Input
                  className="h-8 flex-1 text-sm"
                  maxLength={150}
                  value={option.text}
                  onChange={event => updateOption(index, event.target.value)}
                  disabled={isSubmitting}
                />
                <input
                  type="radio"
                  name="edit-correct-option"
                  checked={state.correctOptionIndex === index}
                  onChange={() =>
                    setState(current => current && ({...current, correctOptionIndex: index}))
                  }
                  className="h-4 w-4 shrink-0 accent-primary"
                  title="Mark as correct answer"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                  onClick={() => removeOption(index)}
                  disabled={state.options.length <= MIN_OPTIONS || isSubmitting}
                  title="Remove option"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSubmit(buildPayload())}
            disabled={invalid || isSubmitting}
          >
            Save
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(buildPayload('APPROVED'))}
            disabled={invalid || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save and Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
