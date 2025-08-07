import React, { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, CheckCircle, Circle } from "lucide-react";
import { useCreateQuestion, useAddQuestionToBank } from '@/hooks/hooks';

interface CreateQuestionDialogProps {
    showCreateQuestionDialog: boolean;
    setShowCreateQuestionDialog: (value: boolean) => void;
    selectedBankId?: string;
}

interface LotItem {
    text: string;
    explaination: string;
    id: string; // Add unique ID for better tracking
}

interface OptionWithSelection extends LotItem {
    isCorrect: boolean;
}

type QuestionType = 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT';

const CreateQuestionDialog: React.FC<CreateQuestionDialogProps> = ({
    showCreateQuestionDialog,
    setShowCreateQuestionDialog,
    selectedBankId
}) => {
    const [questionForm, setQuestionForm] = useState({
        text: '',
        type: 'SELECT_ONE_IN_LOT' as QuestionType,
        isParameterized: false,
        hint: '',
        timeLimitSeconds: 60,
        points: 5,
        options: [] as OptionWithSelection[], // Unified options array
    });

    const createQuestion = useCreateQuestion();
    const addQuestionToBank = useAddQuestionToBank();

    // Generate unique ID for new options
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const addOption = () => {
        setQuestionForm(prev => ({
            ...prev,
            options: [...prev.options, {
                id: generateId(),
                text: '',
                explaination: '',
                isCorrect: false
            }]
        }));
    };

    const removeOption = (id: string) => {
        setQuestionForm(prev => ({
            ...prev,
            options: prev.options.filter(option => option.id !== id)
        }));
    };

    const updateOption = (id: string, field: 'text' | 'explaination', value: string) => {
        setQuestionForm(prev => ({
            ...prev,
            options: prev.options.map(option =>
                option.id === id ? { ...option, [field]: value } : option
            )
        }));
    };

    const toggleOptionCorrectness = (id: string) => {
        setQuestionForm(prev => ({
            ...prev,
            options: prev.options.map(option => {
                if (option.id === id) {
                    // For SELECT_ONE_IN_LOT, uncheck other options when selecting one
                    if (prev.type === 'SELECT_ONE_IN_LOT') {
                        return { ...option, isCorrect: true };
                    }
                    // For SELECT_MANY_IN_LOT, toggle the current option
                    return { ...option, isCorrect: !option.isCorrect };
                } else if (prev.type === 'SELECT_ONE_IN_LOT') {
                    // Uncheck other options for single-select
                    return { ...option, isCorrect: false };
                }
                return option;
            })
        }));
    };

    const handleTypeChange = (newType: QuestionType) => {
        setQuestionForm(prev => {
            let updatedOptions = [...prev.options];

            // When switching from SELECT_ONE_IN_LOT to SELECT_MANY_IN_LOT
            if (prev.type === 'SELECT_ONE_IN_LOT' && newType === 'SELECT_MANY_IN_LOT') {
                // Keep all options as they are - correctness is already set
            }

            // When switching from SELECT_MANY_IN_LOT to SELECT_ONE_IN_LOT
            if (prev.type === 'SELECT_MANY_IN_LOT' && newType === 'SELECT_ONE_IN_LOT') {
                // Keep only the first correct option as selected, unselect others
                let foundFirst = false;
                updatedOptions = updatedOptions.map(option => {
                    if (option.isCorrect && !foundFirst) {
                        foundFirst = true;
                        return option; // Keep this one selected
                    }
                    return { ...option, isCorrect: false }; // Unselect others
                });
            }

            return {
                ...prev,
                type: newType,
                options: updatedOptions
            };
        });
    };

    const resetForm = () => {
        setQuestionForm({
            text: '',
            type: 'SELECT_ONE_IN_LOT',
            isParameterized: false,
            hint: '',
            timeLimitSeconds: 60,
            points: 5,
            options: [],
        });
    };

    const handleCreateQuestion = async () => {

        const correctOptions = questionForm.options.filter(option => option.isCorrect && option.text.trim());
        const incorrectOptions = questionForm.options.filter(option => !option.isCorrect && option.text.trim());

        // Validation
        if (correctOptions.length === 0) {
            alert('Please select at least one correct answer.');
            return;
        }

        if (incorrectOptions.length === 0) {
            alert('Please add at least one incorrect option.');
            return;
        }

        try {
            // Prepare the question data based on type
            const questionData = {
                text: questionForm.text,
                type: questionForm.type,
                isParameterized: questionForm.isParameterized,
                parameters: questionForm.isParameterized ? [] : [],
                hint: questionForm.hint || undefined,
                timeLimitSeconds: questionForm.timeLimitSeconds,
                points: questionForm.points,
                incorrectLotItems: incorrectOptions.map(({ text, explaination }) => ({ text, explaination })),
                ...(questionForm.type === 'SELECT_ONE_IN_LOT'
                    ? { correctLotItem: { text: correctOptions[0].text, explaination: correctOptions[0].explaination } }
                    : { correctLotItems: correctOptions.map(({ text, explaination }) => ({ text, explaination })) }
                )
            };

            console.log('Creating question:', questionData);

            const data = await createQuestion.mutateAsync({
                body: {
                    question: {
                        text: questionData.text,
                        type: questionData.type,
                        isParameterized: questionData.isParameterized,
                        parameters: questionData.parameters,
                        hint: questionData.hint,
                        timeLimitSeconds: questionData.timeLimitSeconds,
                        points: questionData.points
                    },
                    solution: {
                        correctLotItems: questionData.correctLotItems,
                        incorrectLotItems: questionData.incorrectLotItems,
                        correctLotItem: questionData.correctLotItem
                    }
                }
            });
            await addQuestionToBank.mutateAsync({
                params: {
                    path: {
                        questionId: data?.questionId,
                        questionBankId: selectedBankId || ''
                    }
                }
            });
            console.log('Question created successfully:', data);
            resetForm();
            setShowCreateQuestionDialog(false);
        } catch (error) {
            console.error('Failed to create question:', error);
        }
    };

    return (
        <div className="p-4 border-b">
            <div className="flex items-center justify-end">
                <Dialog open={showCreateQuestionDialog} onOpenChange={setShowCreateQuestionDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Question
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New Question</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 mt-4">
                            {/* Basic Question Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base md:text-lg">Question Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="questionText" className='mb-3'>Question Text</Label>
                                        <Textarea
                                            id="questionText"
                                            placeholder="Enter your question here..."
                                            value={questionForm.text}
                                            onChange={(e) => setQuestionForm(prev => ({ ...prev, text: e.target.value }))}
                                            className="min-h-[80px]"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label className='mb-3'>Question Type</Label>
                                            <RadioGroup
                                                value={questionForm.type}
                                                onValueChange={(value: QuestionType) => handleTypeChange(value)}
                                                className="mt-2"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="SELECT_ONE_IN_LOT" id="single" />
                                                    <Label htmlFor="single" className="cursor-pointer">Select One Answer</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="SELECT_MANY_IN_LOT" id="multiple" />
                                                    <Label htmlFor="multiple" className="cursor-pointer">Select Multiple Answers</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <div>
                                            <Label htmlFor="hint" className='mb-3'>Hint</Label>
                                            <Input
                                                id="hint"
                                                placeholder="Enter a hint for students..."
                                                value={questionForm.hint}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, hint: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="timeLimit" className='mb-3'>Time Limit (seconds)</Label>
                                            <Input
                                                id="timeLimit"
                                                type="number"
                                                min="1"
                                                value={questionForm.timeLimitSeconds}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, timeLimitSeconds: parseInt(e.target.value) || 60 }))}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="points" className='mb-3'>Points</Label>
                                            <Input
                                                id="points"
                                                type="number"
                                                min="1"
                                                value={questionForm.points}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Answer Options */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base md:text-lg">Answer Options</CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        {questionForm.type === 'SELECT_ONE_IN_LOT'
                                            ? 'Select the radio button next to the correct answer'
                                            : 'Check all correct answers (at least one required)'
                                        }
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {questionForm.options.map((option) => (
                                        <div key={option.id} className={`border rounded-lg p-4 space-y-3 ${option.isCorrect ? 'bg-green-500/10 border-green-500/20' : 'border-gray-200'
                                            }`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3 flex-1">
                                                    {questionForm.type === 'SELECT_ONE_IN_LOT' ? (
                                                        <div
                                                            className="cursor-pointer"
                                                            onClick={() => toggleOptionCorrectness(option.id)}
                                                        >
                                                            {option.isCorrect ? (
                                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                            ) : (
                                                                <Circle className="h-5 w-5 text-gray-400" />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Checkbox
                                                            checked={option.isCorrect}
                                                            onCheckedChange={() => toggleOptionCorrectness(option.id)}
                                                        />
                                                    )}
                                                    <div className="flex-1 space-y-2">
                                                        <Input
                                                            placeholder="Enter answer option..."
                                                            value={option.text}
                                                            onChange={(e) => updateOption(option.id, 'text', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeOption(option.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div>
                                                <Label className="text-sm text-gray-600">
                                                    Explanation {option.isCorrect ? '(Why this is correct)' : '(Why this is incorrect)'}
                                                </Label>
                                                <Textarea
                                                    placeholder={option.isCorrect
                                                        ? "Explain why this answer is correct..."
                                                        : "Explain why this answer is incorrect..."
                                                    }
                                                    value={option.explaination}
                                                    onChange={(e) => updateOption(option.id, 'explaination', e.target.value)}
                                                    className="mt-1"
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {questionForm.options.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground text-sm md:text-base">
                                            No options added yet. Click "Add Option" to get started.
                                        </div>
                                    )}

                                    <Button
                                        variant="outline"
                                        onClick={addOption}
                                        className="w-full"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Option
                                    </Button>

                                    {/* Validation Messages */}
                                    {questionForm.options.length > 0 && (
                                        <div className="text-sm space-y-1">
                                            {questionForm.options.filter(o => o.isCorrect).length === 0 && (
                                                <p className="text-red-600">⚠️ Please select at least one correct answer</p>
                                            )}
                                            {questionForm.options.filter(o => !o.isCorrect).length === 0 && (
                                                <p className="text-red-600">⚠️ Please add at least one incorrect option</p>
                                            )}
                                            {questionForm.type === 'SELECT_MANY_IN_LOT' &&
                                                questionForm.options.filter(o => o.isCorrect).length >= 1 &&
                                                questionForm.options.filter(o => !o.isCorrect).length >= 1 && (
                                                    <p className="text-green-600">✓ Question is ready to create</p>
                                                )}
                                            {questionForm.type === 'SELECT_ONE_IN_LOT' &&
                                                questionForm.options.filter(o => o.isCorrect).length === 1 &&
                                                questionForm.options.filter(o => !o.isCorrect).length >= 1 && (
                                                    <p className="text-green-600">✓ Question is ready to create</p>
                                                )}
                                            {!questionForm.hint.trim() && (
                                                <p className="text-red-600">⚠️ Hint is recommended for better clarity</p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                            <Button variant="outline" onClick={() => {
                                setShowCreateQuestionDialog(false);
                                resetForm();
                            }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateQuestion}
                                disabled={
                                    !questionForm.text.trim() ||
                                    questionForm.options.filter(o => o.isCorrect).length === 0 ||
                                    questionForm.options.filter(o => !o.isCorrect).length === 0
                                    // questionForm.options.some(o => !o.text.trim())
                                }
                            >
                                Create Question
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default CreateQuestionDialog;