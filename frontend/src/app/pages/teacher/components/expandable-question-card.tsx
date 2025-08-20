import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Save,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  useQuestionById,
  useUpdateQuestion,
} from '@/hooks/hooks';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
const toPriority = (value: any): Priority =>
  value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' ? value : 'LOW';

interface QuestionFormData {
  question: {
    text: string;
    type: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'ORDER_THE_LOTS' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE';
    isParameterized: boolean;
    parameters?: Array<{
      name: string;
      possibleValues: string[];
      type: 'number' | 'string';
    }>;
    hint?: string;
    timeLimitSeconds: number;
    points: number;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  solution: any; // This would be the appropriate solution type based on question type
}

const QUESTION_TYPES = [
  { value: 'SELECT_ONE_IN_LOT', label: 'Single Choice' },
  { value: 'SELECT_MANY_IN_LOT', label: 'Multiple Choice' },
  { value: 'ORDER_THE_LOTS', label: 'Order The Items' },
  { value: 'NUMERIC_ANSWER_TYPE', label: 'Numeric Answer' },
  { value: 'DESCRIPTIVE', label: 'Descriptive Answer' }
];



// Expandable Question Card Component
interface EditableOption {
  _id: string;
  text: string;
  explaination?: string;
  isCorrect: boolean;
}

interface ExpandableQuestionCardProps {
  questionId: string;
  onDelete: () => void;
  onDuplicate: () => void;
}

const ExpandableQuestionCard: React.FC<ExpandableQuestionCardProps> = ({
  questionId,
  onDelete,
  onDuplicate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableOptions, setEditableOptions] = useState<EditableOption[]>([]);
  
  const [editForm, setEditForm] = useState<QuestionFormData>({
    question: {
      text: '',
      type: 'SELECT_ONE_IN_LOT',
      isParameterized: false,
      timeLimitSeconds: 60,
      points: 1,
      priority: 'LOW'
    },
    solution: {}
  });

  const { data: question, refetch: refetchQuestion } = useQuestionById(questionId);
  const updateQuestion = useUpdateQuestion();
  console.log('Question data:', question);

  // Initialize edit form when question data is loaded
  useEffect(() => {
    if (question && !isEditing) {
      setEditForm({
        question: {
          text: question.text || '',
          type: question.type || 'SELECT_ONE_IN_LOT',
          isParameterized: question.isParameterized || false,
          parameters: question.parameters || [],
          hint: question.hint || '',
          timeLimitSeconds: question.timeLimitSeconds || 60,
          points: question.points || 1,
          priority: toPriority((question as any).priority)
        },
        solution: {
          // Map backend solution fields to frontend format
          correctLotItem: question.correctLotItem,
          incorrectLotItems: question.incorrectLotItems,
          correctLotItems: question.correctLotItems,
          ordering: question.ordering,
          solutionText: question.solutionText,
          decimalPrecision: question.decimalPrecision,
          upperLimit: question.upperLimit,
          lowerLimit: question.lowerLimit,
          value: question.value,
          expression: question.expression
        }
      });
    }
  }, [question, isEditing]);

  const handleStartEdit = () => {
    if (question) {
      const initialOptions = [];
      
      // For single choice questions
      if (question.correctLotItem) {
        initialOptions.push({ ...question.correctLotItem, isCorrect: true });
      }
      
      // For multiple choice questions
      if (question.correctLotItems && question.correctLotItems.length > 0) {
        initialOptions.push(...question.correctLotItems.map(item => ({ ...item, isCorrect: true })));
      }
      
      // Add incorrect options
      if (question.incorrectLotItems && question.incorrectLotItems.length > 0) {
        initialOptions.push(...question.incorrectLotItems.map(item => ({ ...item, isCorrect: false })));
      }
      
      // Ensure all options have unique IDs
      setEditableOptions(initialOptions.map((opt, index) => ({
        ...opt,
        _id: opt._id || `option-${index}-${Date.now()}`
      })));

      setIsEditing(true);
      setEditForm({
        question: {
          text: question.text || '',
          type: question.type || 'SELECT_ONE_IN_LOT',
          isParameterized: question.isParameterized || false,
          parameters: question.parameters || [],
          hint: question.hint || '',
          timeLimitSeconds: question.timeLimitSeconds || 60,
          points: question.points || 1,
          priority: toPriority((question as any).priority)
        },
        solution: {
          correctLotItem: question.correctLotItem,
          incorrectLotItems: question.incorrectLotItems,
          correctLotItems: question.correctLotItems,
          ordering: question.ordering,
          solutionText: question.solutionText,
          decimalPrecision: question.decimalPrecision,
          upperLimit: question.upperLimit,
          lowerLimit: question.lowerLimit,
          value: question.value,
          expression: question.expression
        }
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditableOptions([]);
    if (question) {
      // Reset form to original question data from details
      const details = question as any || {};
      setEditForm({
        question: {
          text: details.text || '',
          type: details.type || 'SELECT_ONE_IN_LOT',
          isParameterized: details.isParameterized || false,
          parameters: details.parameters || [],
          hint: details.hint || '',
          timeLimitSeconds: details.timeLimitSeconds || 60,
          points: details.points || 1,
          priority: toPriority((details as any).priority)
        },
        solution: {
          // Map backend solution fields to frontend format
          correctLotItem: details.correctLotItem,
          incorrectLotItems: details.incorrectLotItems,
          correctLotItems: details.correctLotItems,
          ordering: details.ordering,
          solutionText: details.solutionText,
          decimalPrecision: details.decimalPrecision,
          upperLimit: details.upperLimit,
          lowerLimit: details.lowerLimit,
          value: details.value,
          expression: details.expression
        }
      });
    }
  };

  const handleSaveEdit = async () => {
    try {
      const cleanLotItem = (item: any) => {
        if (!item) return item;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, isCorrect, ...rest } = item;
        return rest;
      };
      
      const correctOptions = editableOptions.filter(opt => opt.isCorrect);
      const incorrectOptions = editableOptions.filter(opt => !opt.isCorrect);
      let solutionForBackend: any = {};

      if (editForm.question.type === 'SELECT_ONE_IN_LOT') {
        solutionForBackend.correctLotItem = correctOptions.length > 0 ? cleanLotItem(correctOptions[0]) : undefined;
        solutionForBackend.incorrectLotItems = incorrectOptions.map(cleanLotItem);
      } else if (editForm.question.type === 'SELECT_MANY_IN_LOT') {
        solutionForBackend.correctLotItems = correctOptions.map(cleanLotItem);
        solutionForBackend.incorrectLotItems = incorrectOptions.map(cleanLotItem);
      } else {
        solutionForBackend = { ...editForm.solution };
      }

      await updateQuestion.mutateAsync({
        params: { path: { questionId } },
        body: {
          question: {
            text: editForm.question.text,
            type: editForm.question.type,
            isParameterized: editForm.question.isParameterized,
            parameters: editForm.question.parameters,
            hint: editForm.question.hint,
            timeLimitSeconds: editForm.question.timeLimitSeconds,
            points: editForm.question.points,
            priority: editForm.question.priority
          },
          solution: solutionForBackend
        }
      });

      console.log('Successfully updated question:', questionId);
      setIsEditing(false);
      setEditableOptions([]);
      await refetchQuestion();
      toast.success("Question has been updated successfully.");

    } catch (error) {
      console.error('Failed to update question:', error);
      toast.error("Failed to update the question. Please try again.");
    }
  };

  // Helper functions for managing options
  const updateOption = (optionId: string, updates: { text?: string; explaination?: string }) => {
    setEditableOptions(
      editableOptions.map(opt =>
        opt._id === optionId ? { ...opt, ...updates } : opt
      )
    );
  };

  const setSingleCorrectOption = (selectedOptionId: string) => {
    setEditableOptions(
      editableOptions.map(opt => ({
        ...opt,
        isCorrect: opt._id === selectedOptionId
      }))
    );
  };

  const toggleCorrectOption = (optionId: string, isCorrect: boolean) => {
    setEditableOptions(
      editableOptions.map(opt =>
        opt._id === optionId ? { ...opt, isCorrect: isCorrect } : opt
      )
    );
  };

  const removeOption = (optionId: string) => {
    setEditableOptions(editableOptions.filter(opt => opt._id !== optionId));
  };

  const addNewOption = () => {
    const newOption = {
      _id: `option-${Date.now()}`,
      text: '',
      explaination: '',
      isCorrect: false
    };
    setEditableOptions([...editableOptions, newOption]);
  };

  const renderEditForm = () => (
    <div className="space-y-6 mt-6 p-6 border rounded-lg bg-muted/30">
      <div className="grid grid-cols-1 gap-6">
        {/* Question Type */}
        <div>
          <Label htmlFor="questionType" className="text-sm font-medium">Question Type</Label>
          <Select
            value={editForm.question.type}
            onValueChange={(value: QuestionFormData['question']['type']) => {
              setEditForm({ ...editForm, question: { ...editForm.question, type: value } });
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Question Text */}
        <div>
          <Label htmlFor="questionText" className="text-sm font-medium">Question Text</Label>
          <Textarea
            id="questionText"
            placeholder="Enter your question here..."
            value={editForm.question.text || ''}
            onChange={(e) => setEditForm({
              ...editForm,
              question: { ...editForm.question, text: e.target.value }
            })}
            className="mt-1 min-h-[100px]"
            rows={4}
          />
        </div>

        {/* Hint field */}
        <div>
          <Label htmlFor="hint" className="text-sm font-medium">Hint (Optional)</Label>
          <Textarea
            id="hint"
            placeholder="Enter a hint for this question..."
            value={editForm.question.hint || ''}
            onChange={(e) => setEditForm({
              ...editForm,
              question: { ...editForm.question, hint: e.target.value }
            })}
            className="mt-1"
            rows={2}
          />
        </div>

        {/* Answer Options for Multiple Choice */}
        {(editForm.question.type === 'SELECT_ONE_IN_LOT' || editForm.question.type === 'SELECT_MANY_IN_LOT') && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Answer Options</Label>
            <div className="space-y-3">
              {editForm.question.type === 'SELECT_ONE_IN_LOT' ? (
                <RadioGroup
                  value={editableOptions.find(opt => opt.isCorrect)?._id || ''}
                  onValueChange={setSingleCorrectOption}
                  className="space-y-3"
                >
                  {editableOptions.map((option, index) => (
                    <div key={option._id} className="space-y-2 p-4 border rounded-lg bg-background">
                      <div className="flex gap-3 items-start">
                        <span className="text-sm text-muted-foreground font-medium min-w-[20px] mt-2">
                          {index + 1}.
                        </span>
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder={`Option ${index + 1}`}
                            value={option.text}
                            onChange={(e) => updateOption(option._id, { text: e.target.value })}
                            className="flex-1"
                          />
                          <Input
                            placeholder="explaination (optional)"
                            value={option.explaination}
                            onChange={(e) => updateOption(option._id, { explaination: e.target.value })}
                            className="flex-1 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value={option._id}
                              id={`correct-${option._id}`}
                            />
                            <Label htmlFor={`correct-${option._id}`} className="text-sm text-green-700 dark:text-green-400">
                              Correct
                            </Label>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeOption(option._id)}
                            className="text-destructive hover:text-destructive"
                            disabled={editableOptions.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-3">
                  {editableOptions.map((option, index) => (
                    <div key={option._id} className="space-y-2 p-4 border rounded-lg bg-background">
                      <div className="flex gap-3 items-start">
                        <span className="text-sm text-muted-foreground font-medium min-w-[20px] mt-2">
                          {index + 1}.
                        </span>
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder={`Option ${index + 1}`}
                            value={option.text}
                            onChange={(e) => updateOption(option._id, { text: e.target.value })}
                            className="flex-1"
                          />
                          <Input
                            placeholder="explaination (optional)"
                            value={option.explaination}
                            onChange={(e) => updateOption(option._id, { explaination: e.target.value })}
                            className="flex-1 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`correct-${option._id}`}
                              checked={option.isCorrect}
                              onCheckedChange={(checked) => toggleCorrectOption(option._id, checked as boolean)}
                            />
                            <Label htmlFor={`correct-${option._id}`} className="text-sm text-green-700 dark:text-green-400">
                              Correct
                            </Label>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeOption(option._id)}
                            className="text-destructive hover:text-destructive"
                            disabled={editableOptions.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={addNewOption}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </div>
          </div>
        )}

        {/* Numeric Answer Type Fields */}
        {editForm.question.type === 'NUMERIC_ANSWER_TYPE' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lowerLimit" className="text-sm font-medium">Lower Limit</Label>
                <Input
                  id="lowerLimit"
                  type="number"
                  value={editForm?.solution?.lowerLimit || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    solution: { ...editForm.solution, lowerLimit: parseFloat(e.target.value) }
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="upperLimit" className="text-sm font-medium">Upper Limit</Label>
                <Input
                  id="upperLimit"
                  type="number"
                  value={editForm?.solution?.upperLimit || ''}
                  onChange={(e) => setEditForm({
                    ...editForm,
                    solution: { ...editForm.solution, upperLimit: parseFloat(e.target.value) }
                  })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="decimalPrecision" className="text-sm font-medium">Decimal Precision</Label>
              <Input
                id="decimalPrecision"
                type="number"
                min="0"
                value={editForm?.solution?.decimalPrecision || ''}
                onChange={(e) => setEditForm({
                  ...editForm,
                  solution: { ...editForm.solution, decimalPrecision: parseInt(e.target.value) }
                })}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Descriptive Answer Fields */}
        {editForm.question.type === 'DESCRIPTIVE' && (
          <div>
            <Label htmlFor="solutionText" className="text-sm font-medium">Expected Answer/Solution</Label>
            <Textarea
              id="solutionText"
              placeholder="Enter the expected answer or solution..."
              value={editForm?.solution?.solutionText || ''}
              onChange={(e) => setEditForm({
                ...editForm,
                solution: { ...editForm.solution, solutionText: e.target.value }
              })}
              className="mt-1"
              rows={3}
            />
          </div>
        )}

        {/* Points and Time Limit */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="points" className="text-sm font-medium">Points</Label>
            <Input
              id="points"
              type="number"
              min="1"
              value={editForm.question.points || ''}
              onChange={(e) => setEditForm({
                ...editForm,
                question: { ...editForm.question, points: parseInt(e.target.value) }
              })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="timeLimit" className="text-sm font-medium">Time Limit (seconds)</Label>
            <Input
              id="timeLimit"
              type="number"
              min="1"
              value={editForm.question.timeLimitSeconds || ''}
              onChange={(e) => setEditForm({
                ...editForm,
                question: { ...editForm.question, timeLimitSeconds: parseInt(e.target.value) }
              })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="priority" className='text-sm font-medium mb-1'>Priority</Label>
            <Select
              value={editForm.question.priority}
              onValueChange={(value) =>
                setEditForm(prev => ({
                  ...prev,
                  question: { ...prev.question, priority: toPriority(value) },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Parameterized Question */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="isParameterized"
            checked={editForm.question.isParameterized || false}
            onChange={(e) => setEditForm({
              ...editForm,
              question: { ...editForm.question, isParameterized: e.target.checked }
            })}
            className="rounded"
          />
          <Label htmlFor="isParameterized" className="text-sm cursor-pointer">
            Is Parameterized Question
          </Label>
        </div>
      </div>
    </div>
  );

  const renderQuestionContent = () => {
    if (!question) return <div className="text-sm text-muted-foreground">Loading question...</div>;

    return (
      <div className="space-y-4 p-4">
        <div>
          <h4 className="font-medium text-sm mb-2">Question:</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{question.text || 'No question text'}</p>
        </div>

        {question.hint && (
          <div>
            <h4 className="font-medium text-sm mb-2">Hint:</h4>
            <p className="text-sm text-muted-foreground italic">{question.hint}</p>
          </div>
        )}

        {(question.type === 'SELECT_ONE_IN_LOT' || question.type === 'SELECT_MANY_IN_LOT') && (
          <div>
            <h4 className="font-medium text-sm mb-3">Options:</h4>
            <div className="space-y-2">
              {/* Combine and display all options with their status */}
              {(() => {
                const allOptions: Array<{
                  text: string;
                  isCorrect: boolean;
                  explaination?: string;
                }> = [];

                // Add correct options
                if (question.type === 'SELECT_ONE_IN_LOT' && question.correctLotItem) {
                  allOptions.push({
                    text: question.correctLotItem.text,
                    isCorrect: true,
                    explaination: question.correctLotItem.explaination
                  });
                }

                if (question.type === 'SELECT_MANY_IN_LOT' && question.correctLotItems) {
                  question.correctLotItems.forEach((item: any) => {
                    allOptions.push({
                      text: item.text,
                      isCorrect: true,
                      explaination: item.explaination
                    });
                  });
                }

                // Add incorrect options
                if (question.incorrectLotItems) {
                  question.incorrectLotItems.forEach((item: any) => {
                    allOptions.push({
                      text: item.text,
                      isCorrect: false,
                      explaination: item.explaination
                    });
                  });
                }

                return allOptions.map((option, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${option.isCorrect ? 'bg-green-500/10 border-green-500/20' : 'bg-muted/50 border-border'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-sm text-muted-foreground font-medium min-w-[20px]">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <span className={`text-sm font-medium ${option.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                            {option.text}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${option.isCorrect ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}
                          >
                            {option.isCorrect ? 'Correct' : 'Incorrect'}
                          </Badge>
                        </div>
                        {option.explaination && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {option.explaination}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {question.type === 'NUMERIC_ANSWER_TYPE' && (
          <div>
            <h4 className="font-medium text-sm mb-2">Answer Range:</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              {question.value && <p>Expected Value: {question.value}</p>}
              {question.expression && <p>Expression: {question.expression}</p>}
              {question.lowerLimit !== undefined && question.upperLimit !== undefined && (
                <p>Range: {question.lowerLimit} - {question.upperLimit}</p>
              )}
              {question.decimalPrecision !== undefined && (
                <p>Decimal Precision: {question.decimalPrecision}</p>
              )}
            </div>
          </div>
        )}

        {question.type === 'DESCRIPTIVE' && question.solutionText && (
          <div>
            <h4 className="font-medium text-sm mb-2">Expected Answer:</h4>
            <p className="text-sm text-muted-foreground">{question.solutionText}</p>
          </div>
        )}

        {question.type === 'ORDER_THE_LOTS' && question.ordering && (
          <div>
            <h4 className="font-medium text-sm mb-3">Correct Order:</h4>
            <div className="space-y-2">
              {question.ordering.map((order: any, index: number) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded border">
                  <span className="text-sm text-muted-foreground font-medium min-w-[20px]">{order.order}.</span>
                  <span className="text-sm flex-1 text-muted-foreground">
                    {order.lotItem.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6 text-xs text-muted-foreground pt-3 border-t">
          {question.points && (
            <span className="font-medium">Points: {question.points}</span>
          )}
          {question.timeLimitSeconds && (
            <span className="font-medium">Time Limit: {question.timeLimitSeconds}s</span>
          )}
          {question.isParameterized && (
            <span className="font-medium text-blue-600">Parameterized</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-l-4 border-l-transparent hover:border-l-primary">
      <CardContent className="p-0">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <div className="p-6 cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge variant="outline" className="font-medium">
                        {question?.type?.replace(/_/g, ' ') || 'Unknown'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      ID: {questionId.slice(-8)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {(question as any)?.text || 'Question text not available'}
                  </p>
                  
                  {/* Quick info */}
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    {(question as any)?.points && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {(question as any).points} pts
                      </span>
                    )}
                    {(question as any)?.timeLimitSeconds && (
                      <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded">
                        {(question as any).timeLimitSeconds}s
                      </span>
                    )}
                    {(question as any)?.lotItems && (
                      <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                        {(question as any).lotItems.length} options
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 ml-6" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={onDuplicate} title="Duplicate" className="h-8 w-8 p-0">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onDelete} 
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="border-t bg-muted/20">
              {isEditing ? renderEditForm() : renderQuestionContent()}
              
              <div className="flex justify-end gap-3 p-6 bg-background border-t">
                {isEditing ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancelEdit}
                      disabled={updateQuestion.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSaveEdit}
                      disabled={updateQuestion.isPending}
                    >
                      {updateQuestion.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Question
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default ExpandableQuestionCard;
