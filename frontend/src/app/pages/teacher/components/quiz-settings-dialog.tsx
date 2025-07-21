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

interface QuizSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizSettingsForm: QuizSettingsForm;
  setQuizSettingsForm: (form: QuizSettingsForm) => void;
  onSave: () => void;
  isSaving: boolean;
}

const QuizSettingsDialog: React.FC<QuizSettingsDialogProps> = ({
  open,
  onOpenChange,
  quizSettingsForm,
  setQuizSettingsForm,
  onSave,
  isSaving
}) => {
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
                  onChange={(e) => setQuizSettingsForm({ ...quizSettingsForm, name: e.target.value })}
                  placeholder="Enter quiz name"
                />
              </div>
              <div>
                <Label htmlFor="quizDescription">Description</Label>
                <Textarea
                  id="quizDescription"
                  value={quizSettingsForm.description}
                  onChange={(e) => setQuizSettingsForm({ ...quizSettingsForm, description: e.target.value })}
                  placeholder="Enter quiz description"
                  rows={3}
                />
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
                  onChange={(e) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    passThreshold: parseInt(e.target.value) / 100
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum percentage required to pass (0-100%)
                </p>
              </div>
              <div>
                <Label htmlFor="maxAttempts">Max Attempts</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  min="-1"
                  value={quizSettingsForm.maxAttempts}
                  onChange={(e) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    maxAttempts: parseInt(e.target.value)
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum attempts allowed
                </p>
              </div>
              <div>
                <Label htmlFor="quizType">Quiz Type</Label>
                <Select
                  value={quizSettingsForm.quizType}
                  onValueChange={(value: 'DEADLINE' | 'NO_DEADLINE') =>
                    setQuizSettingsForm({ ...quizSettingsForm, quizType: value })
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
                  onChange={(e) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    approximateTimeToComplete: e.target.value
                  })}
                  placeholder="00:30:00"
                />
              </div>
              <div>
                <Label htmlFor="questionVisibility">Questions Visible to Students</Label>
                <Input
                  id="questionVisibility"
                  type="number"
                  min="1"
                  value={quizSettingsForm.questionVisibility}
                  onChange={(e) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    questionVisibility: parseInt(e.target.value)
                  })}
                />
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
                  onChange={(e) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    releaseTime: e.target.value
                  })}
                />
              </div>
              {quizSettingsForm.quizType === 'DEADLINE' && (
                <div>
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={quizSettingsForm.deadline}
                    onChange={(e) => setQuizSettingsForm({
                      ...quizSettingsForm,
                      deadline: e.target.value
                    })}
                  />
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
                  onCheckedChange={(checked) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    allowPartialGrading: checked
                  })}
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
                  onCheckedChange={(checked) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    allowHint: checked
                  })}
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
                  onCheckedChange={(checked) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    showCorrectAnswersAfterSubmission: checked
                  })}
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
                  onCheckedChange={(checked) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    showExplanationAfterSubmission: checked
                  })}
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
                  onCheckedChange={(checked) => setQuizSettingsForm({
                    ...quizSettingsForm,
                    showScoreAfterSubmission: checked
                  })}
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
            onClick={onSave}
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
