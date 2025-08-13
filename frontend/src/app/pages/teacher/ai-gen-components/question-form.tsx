import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, X } from "lucide-react";

export const QuestionEditForm = ({ question, onSave, onCancel }: {
  question: any;
  onSave: (edited: any) => void;
  onCancel: () => void;
}) => {


    // Normalize question object to handle both flat and nested (with .question and .solution)
    const typeMap: Record<string, string> = {
      SOL: 'SELECT_ONE_IN_LOT',
      MUL: 'SELECT_MANY_IN_LOT',
      // Add more mappings if needed
    };

    const normalized = React.useMemo(() => {
      if ('question' in question && typeof question.question === 'object') {
        const mappedType = typeMap[question.question.type] || question.question.type;
        return {
          ...question.question,
          type: mappedType,
          solution: question.solution,
        };
      }
      // If already flat, also map type
      return {
        ...question,
        type: typeMap[question.type] || question.type,
      };
    }, [question]);

    const initialOptions = React.useMemo(() => {
      if (normalized.solution) {
        // Handle both correctLotItem (single correct) and correctLotItems (multiple correct)
        const correct = normalized.solution.correctLotItems
          ? normalized.solution.correctLotItems.map((opt: any) => ({ text: opt.text, explaination: opt.explaination, correct: true }))
          : normalized.solution.correctLotItem
            ? [{ text: normalized.solution.correctLotItem.text, explaination: normalized.solution.correctLotItem.explaination, correct: true }]
            : [];
        const incorrect = normalized.solution.incorrectLotItems
          ? normalized.solution.incorrectLotItems.map((opt: any) => ({ text: opt.text, explaination: opt.explaination, correct: false }))
          : [];
        // Combine (correct first, then incorrect)
        return [...correct, ...incorrect];
      }
      // fallback: if options array exists (for generated questions)
      if (Array.isArray(normalized.options)) {
        let correctIndices: number[] = [];
        if (normalized.type === 'SELECT_ONE_IN_LOT' && typeof normalized.correctAnswer === 'number') {
          correctIndices = [normalized.correctAnswer];
        } else if (normalized.type === 'SELECT_MANY_IN_LOT' && Array.isArray(normalized.correctAnswer)) {
          correctIndices = normalized.correctAnswer;
        }
        return normalized.options.map((opt: string, idx: number) => ({
          text: opt,
          explaination: '',
          correct: correctIndices.includes(idx),
        }));
      }
      return [];
    }, [normalized]);

    const [questionText, setQuestionText] = React.useState(normalized.text || normalized.question || '');
    const [options, setOptions] = React.useState(initialOptions);

    // Sync state with normalized question
    React.useEffect(() => {
      setQuestionText(normalized.text || normalized.question || '');
      setOptions(initialOptions);
    }, [normalized, initialOptions]);

    const handleOptionText = (idx: number, value: string) => setOptions(opts => opts.map((o, i) => i === idx ? { ...o, text: value } : o));
    const handleOptionExplain = (idx: number, value: string) => setOptions(opts => opts.map((o, i) => i === idx ? { ...o, explaination: value } : o));
    const handleCorrect = (idx: number, checked: boolean) => {
      setOptions(opts => opts.map((o, i) =>
        normalized.type === 'SELECT_ONE_IN_LOT'
          ? { ...o, correct: i === idx }
          : i === idx ? { ...o, correct: checked } : o
      ));
    };
    const handleAddOption = () => setOptions(opts => [...opts, { text: '', explaination: '', correct: false }]);
    const handleRemoveOption = (idx: number) => setOptions(opts => opts.filter((_, i) => i !== idx));

    const canSave = questionText.trim() && options.length >= 2 && options.every(o => o.text.trim() && o.explaination.trim()) && options.some(o => o.correct);

    const buildSolution = () => {
      const correctOpts = options.filter(o => o.correct).map(o => ({ text: o.text, explaination: o.explaination }));
      const incorrectOpts = options.filter(o => !o.correct).map(o => ({ text: o.text, explaination: o.explaination }));
      if (normalized.type === 'SELECT_ONE_IN_LOT') {
        return {
          correctLotItem: correctOpts[0] || { text: '', explaination: '' },
          incorrectLotItems: incorrectOpts,
        };
      } else if (normalized.type === 'SELECT_MANY_IN_LOT') {
        return {
          correctLotItems: correctOpts,
          incorrectLotItems: incorrectOpts,
        };
      }
      return undefined;
    };

    return (
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <Label htmlFor="question-text">Question Text</Label>
          <Textarea
            id="question-text"
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            placeholder="Enter question text"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Options</Label>
          <div className="space-y-2 mt-2 max-h-[50vh] overflow-y-auto pr-2">
            {options.map((option, idx) => (
              <div key={idx} className="flex flex-col gap-1 border rounded p-2 bg-background">
                <div className="flex items-center gap-2">
                  {normalized.type === 'SELECT_ONE_IN_LOT' ? (
                    <input type="radio" checked={option.correct} onChange={() => handleCorrect(idx, true)} />
                  ) : (
                    <input type="checkbox" checked={option.correct} onChange={e => handleCorrect(idx, e.target.checked)} />
                  )}
                  <Input
                    value={option.text}
                    onChange={e => handleOptionText(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveOption(idx)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <Textarea
                  value={option.explaination}
                  onChange={e => handleOptionExplain(idx, e.target.value)}
                  placeholder="Explanation for this option (why correct/incorrect)"
                  className="mt-1"
                  rows={2}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddOption} className="w-full"><Plus className="h-4 w-4 mr-2" />Add Option</Button>
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <Button onClick={() => {
            const solution = buildSolution();
            onSave({ text: questionText, solution });
          }} className="flex-1" disabled={!canSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    );
  };