import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface QuizSettingsForm {
  name: string;
  description: string;
  passThreshold: number;
  maxAttempts: number;
  quizType: 'DEADLINE' | 'NO_DEADLINE';
  approximateTimeToComplete: string;
  allowPartialGrading: boolean;
  allowHint: boolean;
  showCorrectAnswersAfterSubmission: boolean;
  showExplanationAfterSubmission: boolean;
  showScoreAfterSubmission: boolean;
  questionVisibility: number;
  releaseTime: string;
  deadline: string;
}

interface ValidationErrors {
  name?: string;
  description?: string;
  passThreshold?: string;
  maxAttempts?: string;
  approximateTimeToComplete?: string;
  questionVisibility?: string;
  releaseTime?: string;
  deadline?: string;
}

interface QuizSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizSettingsForm: QuizSettingsForm;
  setQuizSettingsForm: (form: QuizSettingsForm) => void;
  onSave: () => void;
  isSaving: boolean;
}

const validateForm = (form: QuizSettingsForm): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name validation (required, non-empty string)
  if (!form.name || form.name.trim() === '') {
    errors.name = 'Quiz name is required';
  }

  // Description validation (required, non-empty string)
  if (!form.description || form.description.trim() === '') {
    errors.description = 'Quiz description is required';
  }

  // Pass threshold validation (0-1 range)
  if (form.passThreshold < 0 || form.passThreshold > 1) {
    errors.passThreshold = 'Pass threshold must be between 0 and 1';
  }

  // Max attempts validation (minimum -1)
  if (form.maxAttempts < -1) {
    errors.maxAttempts = 'Max attempts must be -1 or greater';
  }

  // Approximate time validation (HH:MM:SS format)
  const timeRegex = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;
  if (!form.approximateTimeToComplete || !timeRegex.test(form.approximateTimeToComplete)) {
    errors.approximateTimeToComplete = 'Time must be in HH:MM:SS format';
  }

  // Question visibility validation (minimum 1)
  if (form.questionVisibility < 1) {
    errors.questionVisibility = 'Question visibility must be at least 1';
  }

  // Release time validation (required)
  if (!form.releaseTime) {
    errors.releaseTime = 'Release time is required';
  }

  // Deadline validation (required if quiz type is DEADLINE)
  if (form.quizType === 'DEADLINE' && !form.deadline) {
    errors.deadline = 'Deadline is required for deadline-based quizzes';
  }

  // Validate deadline is after release time
  if (form.releaseTime && form.deadline && form.quizType === 'DEADLINE') {
    const releaseDate = new Date(form.releaseTime);
    const deadlineDate = new Date(form.deadline);
    if (deadlineDate <= releaseDate) {
      errors.deadline = 'Deadline must be after release time';
    }
  }

  return errors;
};

const QuizSettingsDialog: React.FC<QuizSettingsDialogProps> = ({
  open,
  onOpenChange,
  quizSettingsForm,
  setQuizSettingsForm,
  onSave,
  isSaving
}) => {
  const [validationErrors, setValidationErrors] = React.useState<ValidationErrors>({});

  const handleSave = () => {
    const errors = validateForm(quizSettingsForm);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      onSave();
    }
  };

  const handleFieldChange = (field: keyof QuizSettingsForm, value: any) => {
    setQuizSettingsForm({ ...quizSettingsForm, [field]: value });
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors({ ...validationErrors, [field]: undefined });
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quiz Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="quizName">Quiz Name</Label>
                <Input
                  id="quizName"
                  value={quizSettingsForm.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Enter quiz name"
                  className={validationErrors.name ? 'border-red-500' : ''}
                />
                {validationErrors.name && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="quizDescription">Description</Label>
                <Textarea
                  id="quizDescription"
                  value={quizSettingsForm.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Enter quiz description"
                  rows={3}
                  className={validationErrors.description ? 'border-red-500' : ''}
                />
                {validationErrors.description && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Quiz Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quiz Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="passThreshold">Pass Threshold (%)</Label>
                <Input
                  id="passThreshold"
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(quizSettingsForm.passThreshold * 100)}
                  onChange={(e) => handleFieldChange('passThreshold', parseInt(e.target.value) / 100)}
                  className={validationErrors.passThreshold ? 'border-red-500' : ''}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum percentage required to pass (0-100%)
                </p>
                {validationErrors.passThreshold && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.passThreshold}</p>
                )}
              </div>
              <div>
                <Label htmlFor="maxAttempts">Max Attempts</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  min="-1"
                  value={quizSettingsForm.maxAttempts}
                  onChange={(e) => handleFieldChange('maxAttempts', parseInt(e.target.value))}
                  className={validationErrors.maxAttempts ? 'border-red-500' : ''}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum attempts allowed (-1 for unlimited)
                </p>
                {validationErrors.maxAttempts && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.maxAttempts}</p>
                )}
              </div>
              <div>
                <Label htmlFor="quizType">Quiz Type</Label>
                <Select
                  value={quizSettingsForm.quizType}
                  onValueChange={(value: 'DEADLINE' | 'NO_DEADLINE') =>
                    handleFieldChange('quizType', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_DEADLINE">No Deadline</SelectItem>
                    <SelectItem value="DEADLINE">With Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="approximateTime">Approximate Time (HH:MM:SS)</Label>
                <Input
                  id="approximateTime"
                  value={quizSettingsForm.approximateTimeToComplete}
                  onChange={(e) => handleFieldChange('approximateTimeToComplete', e.target.value)}
                  placeholder="00:30:00"
                  className={validationErrors.approximateTimeToComplete ? 'border-red-500' : ''}
                />
                {validationErrors.approximateTimeToComplete && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.approximateTimeToComplete}</p>
                )}
              </div>
              <div>
                <Label htmlFor="questionVisibility">Questions Visible to Students</Label>
                <Input
                  id="questionVisibility"
                  type="number"
                  min="1"
                  value={quizSettingsForm.questionVisibility}
                  onChange={(e) => handleFieldChange('questionVisibility', parseInt(e.target.value))}
                  className={validationErrors.questionVisibility ? 'border-red-500' : ''}
                />
                {validationErrors.questionVisibility && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.questionVisibility}</p>
                )}
              </div>
            </div>
          </div>

          {/* Time Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Time Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="releaseTime">Release Time</Label>
                <Input
                  id="releaseTime"
                  type="datetime-local"
                  value={quizSettingsForm.releaseTime}
                  onChange={(e) => handleFieldChange('releaseTime', e.target.value)}
                  className={validationErrors.releaseTime ? 'border-red-500' : ''}
                />
                {validationErrors.releaseTime && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.releaseTime}</p>
                )}
              </div>
              {quizSettingsForm.quizType === 'DEADLINE' && (
                <div>
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={quizSettingsForm.deadline}
                    onChange={(e) => handleFieldChange('deadline', e.target.value)}
                    className={validationErrors.deadline ? 'border-red-500' : ''}
                  />
                  {validationErrors.deadline && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.deadline}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Student Experience */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Student Experience</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allowPartialGrading">Allow Partial Grading</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable partial credit for multi-select questions
                  </p>
                </div>
                <Switch
                  id="allowPartialGrading"
                  checked={quizSettingsForm.allowPartialGrading}
                  onCheckedChange={(checked) => handleFieldChange('allowPartialGrading', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allowHint">Allow Hints</Label>
                  <p className="text-xs text-muted-foreground">
                    Let students see hints for questions
                  </p>
                </div>
                <Switch
                  id="allowHint"
                  checked={quizSettingsForm.allowHint}
                  onCheckedChange={(checked) => handleFieldChange('allowHint', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showCorrectAnswers">Show Correct Answers</Label>
                  <p className="text-xs text-muted-foreground">
                    Display correct answers after submission
                  </p>
                </div>
                <Switch
                  id="showCorrectAnswers"
                  checked={quizSettingsForm.showCorrectAnswersAfterSubmission}
                  onCheckedChange={(checked) => handleFieldChange('showCorrectAnswersAfterSubmission', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showExplanations">Show Explanations</Label>
                  <p className="text-xs text-muted-foreground">
                    Display explanations after submission
                  </p>
                </div>
                <Switch
                  id="showExplanations"
                  checked={quizSettingsForm.showExplanationAfterSubmission}
                  onCheckedChange={(checked) => handleFieldChange('showExplanationAfterSubmission', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showScore">Show Score</Label>
                  <p className="text-xs text-muted-foreground">
                    Display score immediately after submission
                  </p>
                </div>
                <Switch
                  id="showScore"
                  checked={quizSettingsForm.showScoreAfterSubmission}
                  onCheckedChange={(checked) => handleFieldChange('showScoreAfterSubmission', checked)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuizSettingsDialog;
export type { QuizSettingsForm };
