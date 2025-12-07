import React, { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, CheckCircle, Circle } from "lucide-react";
import { useCreateQuestion, useAddQuestionToBank } from '@/hooks/hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

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
interface parameterItem {
    name: string;
    possibleValues: string;
    type: string; 
    id: string; // Add unique ID for better tracking
}


type PRIORITIES = "LOW" | "MEDIUM" | "HIGH"

interface OptionWithSelection extends LotItem {
    isCorrect: boolean;
}

type QuestionType = 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'DESCRIPTIVE' | 'NUMERIC_ANSWER_TYPE';

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
        options: [] as OptionWithSelection[],
        priority: 'LOW' as PRIORITIES,
        decimalPrecision: 0,
        upperLimit: 0,
        lowerLimit: 0,
        value: 0,
        parameters:[] as parameterItem[],
        expression: "",
        solutionText: ""
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

    /*Functions to handle parameters change */

    const renderParameterControls = (fieldId: string) => {
        if (!questionForm.isParameterized) return null;
        
        return (
            <div className="flex md:flex-row flex-col gap-2 mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertTagAtCursor(fieldId, "<NumExprTex></NumExprTex>")}
                >
                    Add NumExprTex
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertTagAtCursor(fieldId, "<NumExpr></NumExpr>")}
                >
                    Add Num Expr
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => insertTagAtCursor(fieldId, "<QParam></QParam>")}
                >
                    Add Question param
                </Button>
            </div>
        );
    };
    
    const addParameter = () => {
        setQuestionForm(prev => ({
            ...prev,
            parameters: [...prev.parameters, {
                name: '',
                possibleValues: '',
                type: '',
                id: generateId(),
            }]
        }));
    };

    const removeParamter = (id: string) => {
        setQuestionForm(prev => ({
            ...prev,
            parameters: prev.parameters.filter(option => option.id !== id)
        }));
    };

     const updateParameter = (
  id: string,
  field: 'name' | 'possibleValues' | 'type',
  value: string
) => {
  setQuestionForm(prev => ({
    ...prev,
    parameters: prev.parameters.map(option =>
      option.id === id
        ? {
            ...option,
            [field]:
              field === 'possibleValues'
                ? value.split(',').map(v => v.trim()) // convert "1,2,3" → ["1","2","3"]
                : value,
          }
        : option
    ),
  }));
};

    const handleTypeChange = (newType: QuestionType) => {
        setQuestionForm(prev => {
            let updatedOptions = [...prev.options];

            if ( newType == "DESCRIPTIVE" || newType=="NUMERIC_ANSWER_TYPE" ) {
                return {
                    ...prev,
                    type: newType,
                    options: []
                }
            }

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
            priority: 'LOW',
            decimalPrecision: 0,
            parameters:[],
            upperLimit: 0,
            lowerLimit: 0,
            value: 0,
            expression: "",
            solutionText: ""
        });
    };

    /*Function to handle adding tags*/

const insertTagAtCursor = (fieldId: string, tag: string) => {
    const element = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!element) return;

    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;

  // If the tag has a closing part like <X></X>, place caret inside it.
  // Otherwise place caret after the inserted text.
  const caretOffsetInsideTag = (() => {
    const closingIdx = tag.indexOf("</");
    return closingIdx !== -1 ? closingIdx : tag.length;
  })();

  // 1) options array: id format "option-<optionId>"
  if (fieldId.startsWith("option-")) {
    const optionId = fieldId.replace("option-", "");
    setQuestionForm((prev: any) => {
      const updatedOptions = prev.options.map((opt: any) => {
        if (opt.id !== optionId) return opt;
        const cur = opt.text ?? "";
        const newText = cur.slice(0, start) + tag + cur.slice(end);
        return { ...opt, text: newText };
      });
      return { ...prev, options: updatedOptions };
    });

    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) {
        const pos = start + caretOffsetInsideTag;
        el.selectionStart = el.selectionEnd = pos;
        el.focus();
      }
    });

    return;
  }

  // 2) top-level mapping: map element ids to state keys
  const idToStateKey: Record<string, string> = {
    questionText: "text", // <--- important mapping
    hint: "hint",
    solutionText: "solutionText",
    // add more mappings if you use different ids
  };

  const stateKey = idToStateKey[fieldId] ?? fieldId; // fallback to same name

  setQuestionForm((prev: any) => {
    const currentValue = (prev as any)[stateKey] ?? "";
    const newValue = currentValue.slice(0, start) + tag + currentValue.slice(end);
    return { ...prev, [stateKey]: newValue };
  });

  // restore caret inside tag after render
  requestAnimationFrame(() => {
    const el = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) {
      const pos = start + caretOffsetInsideTag;
      el.selectionStart = el.selectionEnd = pos;
      el.focus();
    }
  });
};






    /*Function to handle create question*/

    const handleCreateQuestion = async () => {

        const correctOptions = questionForm.options.filter(option => option.isCorrect && option.text.trim());
        const incorrectOptions = questionForm.options.filter(option => !option.isCorrect && option.text.trim());

        const isSolOrSml = questionForm.type === "SELECT_ONE_IN_LOT" || questionForm.type === "SELECT_MANY_IN_LOT"

        // Validation
        if (isSolOrSml && correctOptions.length === 0) {
            toast.error('Please select at least one correct answer.');
            return;
        }

        if (isSolOrSml && incorrectOptions.length === 0) {
            toast.error('Please add at least one incorrect option.');
            return;
        }

        try {
            // Prepare the question data based on type
            const questionData = {
                text: questionForm.text,
                type: questionForm.type,
                isParameterized: questionForm.isParameterized,
                parameters: questionForm.isParameterized?questionForm.parameters:[],
                hint: questionForm.hint || undefined,
                timeLimitSeconds: questionForm.timeLimitSeconds,
                points: questionForm.points,
                priority: questionForm.priority,
                incorrectLotItems: incorrectOptions.map(({ text, explaination }) => ({ 
                    text, 
                    explaination: explaination.trim() || "Sorry! You are wrong!" 
                })),
                ...(questionForm.type === 'SELECT_ONE_IN_LOT'
                    ? { correctLotItem: { text: correctOptions[0].text, explaination: correctOptions[0].explaination.trim() || "Congratulations! You are correct!" } }
                    : { correctLotItems: correctOptions.map(({ text, explaination }) => ({ text, explaination: explaination.trim() || "Congratulations! You are correct!" })) }
                ),
                decimalPrecision: questionForm.decimalPrecision  || 0,
                upperLimit: questionForm.upperLimit  || 0,
                lowerLimit: questionForm.lowerLimit  || 0,
                value: questionForm.value  || 0,
                expression: questionForm.expression  || "",
                solutionText: questionForm.solutionText  || "",
            };

           if (questionData.type=="NUMERIC_ANSWER_TYPE" && questionData.lowerLimit >= questionData.upperLimit) {
                toast.error("Lower limit cannot be greater than or equal to upper limit.");
                return;
            }

            console.log('Creating question:', questionData);

            let solutionData: any = {};

            if (questionData.type === "SELECT_ONE_IN_LOT" || questionData.type === "SELECT_MANY_IN_LOT") {
                solutionData.incorrectLotItems = questionData.incorrectLotItems;

                if ("correctLotItem" in questionData) {
                    solutionData.correctLotItem = questionData.correctLotItem;
                } else if ("correctLotItems" in questionData) {
                    solutionData.correctLotItems = questionData.correctLotItems;
                }
            }

            // For numeric questions
            else if (questionData.type === "NUMERIC_ANSWER_TYPE") {
                solutionData = {
                    decimalPrecision: questionData.decimalPrecision,
                    upperLimit: questionData.upperLimit,
                    lowerLimit: questionData.lowerLimit,
                    value: questionData.value,
                    expression: questionData.expression,
                };
            }
            else if (questionData.type === "DESCRIPTIVE") {
                solutionData = {
                    solutionText: questionData.solutionText ,
                };
            }
            const data = await createQuestion.mutateAsync({
                body: {
                    question: {
                        text: questionData.text,
                        type: questionData.type,
                        isParameterized: questionData.isParameterized,
                        parameters: questionData.isParameterized
                            ? questionForm.parameters.map(param => ({
                                name: param.name,
                                possibleValues: typeof param.possibleValues === "string"
                                    ? param.possibleValues.split(',').map(v => v.trim())
                                    : param.possibleValues,
                                type: param.type as "string" | "number"
                            }))
                            : [],
                        hint: questionData.hint,
                        timeLimitSeconds: questionData.timeLimitSeconds,
                        points: questionData.points,
                        priority: questionData.priority
                    },
                    solution: solutionData
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
            const err: any = error;
            const serverMessage = err?.response?.data?.message || err?.response?.message ||err?.data?.message || err?.message;
            const friendlyMessage = serverMessage;
            toast.error(friendlyMessage);
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
                    <DialogContent className="w-full max-[425px]:w-[95vw] max-w-sm xl:max-w-5xl lg:max-w-3xl sm:max-w-2xl mx-auto px-4 max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
                        <DialogHeader className="mb-3 text-left flex-shrink-0">
                            <DialogTitle>Create New Question</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 mt-4 flex-1 overflow-y-auto">
                            {/* Basic Question Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base md:text-lg">Question Details</CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Label htmlFor="isParameterized" className="mb-0">Is Parameterized?</Label>
                                        <Switch
                                            id="isParameterized"
                                            checked={questionForm.isParameterized}
                                            onCheckedChange={(checked) =>
                                                setQuestionForm(prev => ({ ...prev, isParameterized: !!checked }))
                                            }
                                        />
                                    </div>
                                    </div>

                                    {/* <div>
                                        <Label htmlFor="questionText" className='mb-3'>Question Text *</Label>
                                        {renderParameterControls("questionText")}
                                        <Textarea
                                            id="questionText"
                                            placeholder="Enter your question here..."
                                            value={questionForm.text}
                                            onChange={(e) => setQuestionForm(prev => ({ ...prev, text: e.target.value }))}
                                            className="min-h-[80px]"
                                        />
                                    </div> */}
                                  <div>
                                    <Label htmlFor="questionText" className="mb-3">Question Text *</Label>
                                    {renderParameterControls("questionText")}
                                    
                                    <Textarea
                                        id="questionText"
                                        placeholder={`Enter your question here...\\n will show as a new line`}
                                        value={questionForm.text.replace(/\\n/g, '\n')}
                                        onChange={(e) => {
                                        // Convert actual newline to literal '\n' before storing
                                        const updatedText = e.target.value.replace(/\n/g, '\\n');
                                        setQuestionForm(prev => ({ ...prev, text: updatedText }));
                                        }}
                                        className="min-h-[120px] whitespace-pre-wrap"
                                    />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 </div>                       <div>
                                            <Label className='mb-3'>Question Type</Label>
                                            <RadioGroup
                                                value={questionForm.type}
                                                onValueChange={(value: QuestionType) => handleTypeChange(value)}
                                                className="mt-2 grid md:grid-cols-2 grid-cols-1 gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="SELECT_ONE_IN_LOT" id="single" />
                                                    <Label htmlFor="single" className="cursor-pointer">Select One Answer</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="SELECT_MANY_IN_LOT" id="multiple" />
                                                    <Label htmlFor="multiple" className="cursor-pointer">Select Multiple Answers</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="NUMERIC_ANSWER_TYPE" id="nat" />
                                                    <Label htmlFor="nat" className="cursor-pointer">Numerical Answer</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="DESCRIPTIVE" id="das" />
                                                    <Label htmlFor="das" className="cursor-pointer">Descriptive Answer</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <div>
                                            <Label htmlFor="hint" className='mb-3'>Hint *</Label>
                                            {renderParameterControls("hint")}
                                            <Input
                                                id="hint"
                                                placeholder="Enter a hint for students..."
                                                value={questionForm.hint}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, hint: e.target.value }))}
                                            />
                                        </div>
                                    

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="timeLimit" className='mb-3'>Time Limit (seconds) *</Label>
                                        <Input
                                        id="timeLimit"
                                        type="number"
                                        min="1"
                                        value={questionForm.timeLimitSeconds}
                                        onChange={(e) => setQuestionForm(prev => ({ ...prev, timeLimitSeconds: parseInt(e.target.value) || 60 }))}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="points" className='mb-3'>Points *</Label>
                                        <Input
                                        id="points"
                                        type="number"
                                        min="1"
                                        value={questionForm.points}
                                        onChange={(e) => setQuestionForm(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                                        />
                                    </div>
</div>
                                    <div className="col-span-1 lg:col-span-2 overflow-hidden transition-all duration-300 ease-in-out transform flex flex-wrap gap-4 items-end mt-4"
                                        >
                                        <div className="flex-1 xl:min-w-[150px] min-w-full">
                                            <Label htmlFor="priority" className="mb-3">Priority</Label>
                                            <Select
                                            value={questionForm.priority}
                                            
                                            onValueChange={(value: PRIORITIES) => setQuestionForm(prev => ({ ...prev, priority: value }))}
                                            >
                                            <SelectTrigger className={`${
                                                questionForm.type === "NUMERIC_ANSWER_TYPE" || questionForm.type === "DESCRIPTIVE"
                                                ? "w-full"
                                                : "w-[25%]"
                                            }`}>
                                                <SelectValue placeholder="Select priority"  />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="LOW">Low</SelectItem>
                                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                                <SelectItem value="HIGH">High</SelectItem>
                                            </SelectContent>
                                            </Select>
                                        </div>

                                        {questionForm.type === "NUMERIC_ANSWER_TYPE" && (
                                            <>
                                            <div className="flex-1 min-w-[120px]">
                                                <Label htmlFor="decimalPrecision" className="mb-3">Decimal Precision</Label>
                                                <Input
                                                id="decimalPrecision"
                                                type="number"
                                                min="0"
                                                value={questionForm.decimalPrecision}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, decimalPrecision: parseInt(e.target.value) || 0 }))}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-[120px]">
                                                <Label htmlFor="lowerLimit" className="mb-3">Lower Limit</Label>
                                                <Input
                                                id="lowerLimit"
                                                type="number"
                                                value={questionForm.lowerLimit}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, lowerLimit: parseFloat(e.target.value) || 0 }))}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-[120px]">
                                                <Label htmlFor="upperLimit" className="mb-3">Upper Limit</Label>
                                                <Input
                                                id="upperLimit"
                                                type="number"
                                                value={questionForm.upperLimit}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, upperLimit: parseFloat(e.target.value) || 100 }))}
                                                />
                                            </div>
                                            
                                            <div className="flex-1 min-w-[120px]">
                                                <Label htmlFor="value" className="mb-3">Value *</Label>
                                                <Input
                                                id="value"
                                                type="number"
                                                value={questionForm.value}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                                                />
                                            </div>
                                            {/* <div className="flex-1 min-w-[120px]">
                                                <Label htmlFor="expression" className="mb-3">Expression</Label>
                                                <Input
                                                id="expression"
                                                value={questionForm.expression}
                                                placeholder='Enter expression...'
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, expression: e.target.value || "" }))}
                                                />
                                            </div> */}
                                            </>
                                        )}

                                        {questionForm.type === "DESCRIPTIVE" && (
                                            <div className="flex-1 min-w-[250px]">
                                            <Label htmlFor="solutionText" className="mb-3">Solution Text *</Label>
                                            {renderParameterControls("solutionText")}
                                            <Input
                                                id="solutionText"
                                                type="text"
                                                placeholder='Enter solution text...'
                                                value={questionForm.solutionText}
                                                onChange={(e) => setQuestionForm(prev => ({ ...prev, solutionText: e.target.value }))}
                                            />
                                            </div>
                                        )}
                                        </div>
                                    
                                </CardContent>
                            </Card>

                            {questionForm.isParameterized && (
                                <Card>
                                    <CardHeader className='px-4'>
                                        <CardTitle className="text-base md:text-lg">Parameters</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            {`Enter the values for each parameter used in the question text.`}
                                        </p>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {questionForm.parameters?.map((option) => (
                                            <div key={option.id} className={`border rounded-lg p-4 space-y-3`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3 flex-1">
                                                       
                                                        <div className="flex-1 space-y-2">
                                                            <Label className="text-sm text-gray-600">
                                                       Name:
                                                    </Label>
                                                            <Input
                                                                placeholder="Name"
                                                                value={option.name}
                                                                onChange={(e) => updateParameter(option.id, 'name', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeParamter(option.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div>
                                                    <Label className="text-sm text-gray-600">
                                                       Value:
                                                    </Label>
                                                    <Textarea
                                                        placeholder={'Enter comma separated values...'
                                                        }
                                                        value={option.possibleValues}
                                                        onChange={(e) => updateParameter(option.id, 'possibleValues', e.target.value)}
                                                        className="mt-1"
                                                    />
                                                    <Label className="text-sm text-gray-600">
                                                       Type:
                                                    </Label>
                                                    <Textarea
                                                        placeholder={'string or number'
                                                        }
                                                        value={option.type}
                                                        onChange={(e) => updateParameter(option.id, 'type', e.target.value)}
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {questionForm.parameters?.length === 0 && (
                                            <div className="text-center py-8 text-muted-foreground text-sm md:text-base">
                                               {` No parameters added yet. Click "Add Parameter" to get started.`}
                                            </div>
                                        )}

                                        <Button
                                            variant="outline"
                                            onClick={addParameter}
                                            className="w-full"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Parameter
                                        </Button>

                                        {/* Validation Messages */}
                                        {/* {questionForm.options.length > 0 && (
                                            <div className="text-sm space-y-1">
                                                {questionForm.options.filter(o => o.isCorrect).length === 0 && (
                                                    <p className="text-red-600">⚠️ Please select at least one correct answer</p>
                                                )}
                                                {(questionForm.type === 'SELECT_MANY_IN_LOT' || questionForm.type === 'SELECT_ONE_IN_LOT') && questionForm.options.filter((opt)=> opt?.explaination== "").length !==0 &&
                                                    <p className="text-red-600">⚠️ Please provide an explanation for all answer options.</p>
                                                }
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
                                        )} */}
                                    </CardContent>
                                </Card>
                            )}

                            <div
                             className={`transition-all duration-300 ease-in-out transform ${
                                questionForm.type !== "DESCRIPTIVE" && questionForm.type !== "NUMERIC_ANSWER_TYPE"
                                ? "translate-y-0 opacity-100 max-h-[2000px]"
                                : "-translate-y-5 opacity-0 max-h-0"
                            } overflow-hidden`}
                            >
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
                                    <CardContent className="px-4 space-y-4">
                                        {questionForm.options.map((option) => (
                                            <div key={option.id}  className={`border rounded-lg p-4 space-y-3 ${option.isCorrect ? 'bg-green-500/10 border-green-500/20' : 'border-gray-200'
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
                                                            {renderParameterControls(`option-${option.id}`)}
                                                            <Input
                                                            id={`option-${option.id}`}
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
                                                        Explanation (Optional) {option.isCorrect ? '(Why this is correct)' : '(Why this is incorrect)'}
                                                    </Label>
                                                    <Textarea
                                                        placeholder={option.isCorrect
                                                            ? "Explain why this answer is correct... ('Congratulations! You are correct!')"
                                                            : "Explain why this answer is incorrect... ('Sorry! You are wrong!')"
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
                        </div>

                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t flex-shrink-0">
                            <Button variant="outline" onClick={() => {
                                setShowCreateQuestionDialog(false);
                                resetForm();
                            }}>
                                Cancel
                            </Button>
                            <Button
                            onClick={handleCreateQuestion}
                            disabled={
                                createQuestion.isPending ||
                                !questionForm.text.trim() ||
                                !questionForm.hint.trim() ||
                                !questionForm.timeLimitSeconds ||
                                !questionForm.points ||
                                !questionForm.priority ||

                                (questionForm.type === "DESCRIPTIVE" && !questionForm.solutionText.trim()) ||

                                (questionForm.type === "NUMERIC_ANSWER_TYPE" &&
                                (
                                questionForm.decimalPrecision === undefined ||
                                questionForm.lowerLimit === undefined ||
                                questionForm.upperLimit === undefined)
                                ) ||

                                (questionForm.type !== "DESCRIPTIVE" && questionForm.type !== "NUMERIC_ANSWER_TYPE" &&
                                (questionForm.options.filter(o => o.isCorrect).length === 0 ||
                                questionForm.options.filter(o => !o.isCorrect).length === 0)
                                )
                            }
                            >
                            {createQuestion.isPending ? "Creating Question...":"Create Question"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default CreateQuestionDialog;