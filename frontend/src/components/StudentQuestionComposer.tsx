import {useEffect, useState} from 'react';
import {Paperclip, Plus, Trash2, X} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import type {
  StudentQuestionOptionInput,
  StudentQuestionSubmissionPayload,
} from '@/types/student-question.types';

const MAX_OPTIONS = 8;
const MIN_OPTIONS = 2;
const MAX_IMAGE_FILE_SIZE = 512 * 1024;
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function createEmptyOption(): StudentQuestionOptionInput {
  return {text: '', imageUrl: ''};
}

function createInitialPayload(): StudentQuestionSubmissionPayload {
  return {
    questionType: 'SELECT_ONE_IN_LOT',
    questionText: '',
    questionImageUrl: '',
    options: [createEmptyOption(), createEmptyOption()],
    correctOptionIndex: 0,
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
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
  const [payload, setPayload] = useState<StudentQuestionSubmissionPayload>(createInitialPayload);

  useEffect(() => {
    if (isOpen) {
      setPayload(createInitialPayload());
    }
  }, [isOpen]);

  const updateOption = (index: number, patch: Partial<StudentQuestionOptionInput>) => {
    setPayload(current => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? {...option, ...patch} : option,
      ),
    }));
  };

  const addOption = () => {
    setPayload(current => {
      if (current.options.length >= MAX_OPTIONS) {
        return current;
      }

      return {
        ...current,
        options: [...current.options, createEmptyOption()],
      };
    });
  };

  const removeOption = (index: number) => {
    setPayload(current => {
      if (current.options.length <= MIN_OPTIONS) {
        return current;
      }

      const nextOptions = current.options.filter((_, optionIndex) => optionIndex !== index);
      const nextCorrectIndex =
        current.correctOptionIndex === index
          ? 0
          : current.correctOptionIndex > index
            ? current.correctOptionIndex - 1
            : current.correctOptionIndex;

      return {
        ...current,
        options: nextOptions,
        correctOptionIndex: nextCorrectIndex,
      };
    });
  };

  const handleImageUpload = async (
    file: File | undefined,
    apply: (imageUrl: string) => void,
  ) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      toast.error('Image must be 512 KB or smaller.');
      return;
    }

    try {
      apply(await fileToDataUrl(file));
    } catch (error: any) {
      toast.error(error?.message || 'Unable to read image file.');
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    payload.questionText.trim().length < 10 ||
    payload.options.length < MIN_OPTIONS ||
    payload.options.some(option => !option.text?.trim());

  return (
    <div className="grid gap-3">
      {/* Question prompt */}
      <div className="grid gap-1.5">
        <Label htmlFor="student-question-text" className="text-sm font-medium">
          Question prompt
        </Label>
        <div className="flex gap-2">
          <Textarea
            id="student-question-text"
            placeholder="Write the MCQ prompt students should answer"
            className="min-h-[72px] flex-1 resize-none text-sm"
            value={payload.questionText}
            onChange={event =>
              setPayload(current => ({...current, questionText: event.target.value}))
            }
          />
          <div className="flex flex-col gap-1">
            <Label
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Attach question image"
            >
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async event => {
                  await handleImageUpload(event.target.files?.[0], imageUrl => {
                    setPayload(current => ({...current, questionImageUrl: imageUrl}));
                  });
                  event.target.value = '';
                }}
              />
            </Label>
            {payload.questionImageUrl?.trim() && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-destructive"
                title="Remove question image"
                onClick={() => setPayload(current => ({...current, questionImageUrl: ''}))}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {payload.questionImageUrl?.trim() && (
          <img
            src={payload.questionImageUrl}
            alt="Question image preview"
            className="max-h-28 w-full rounded-md border object-contain"
          />
        )}
      </div>

      {/* Options */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Options{' '}
            <span className="text-xs font-normal text-muted-foreground">— select the correct answer</span>
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
            Add
          </Button>
        </div>

        {payload.options.map((option, index) => (
          <div key={`option-${index}`} className="grid gap-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {OPTION_LABELS[index]}
              </span>
              <Input
                placeholder="Option text (required)"
                className="h-8 flex-1 text-sm"
                value={option.text || ''}
                onChange={event => updateOption(index, {text: event.target.value})}
              />
              <input
                type="radio"
                name="student-question-correct-option"
                checked={payload.correctOptionIndex === index}
                onChange={() => setPayload(current => ({...current, correctOptionIndex: index}))}
                className="h-4 w-4 shrink-0 accent-primary"
                title="Mark as correct answer"
              />
              <Label
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Attach option image"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async event => {
                    await handleImageUpload(event.target.files?.[0], imageUrl => {
                      updateOption(index, {imageUrl});
                    });
                    event.target.value = '';
                  }}
                />
              </Label>
              {option.imageUrl?.trim() && (
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-destructive"
                  title="Remove option image"
                  onClick={() => updateOption(index, {imageUrl: ''})}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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
            {option.imageUrl?.trim() && (
              <img
                src={option.imageUrl}
                alt={`Option ${OPTION_LABELS[index]} image preview`}
                className="ml-8 max-h-24 rounded-md border object-contain"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSubmit(payload)}
          disabled={isSubmitDisabled}
        >
          {isSubmitting ? 'Submitting...' : 'Submit MCQ'}
        </Button>
      </div>
    </div>
  );
}