import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, CheckCircle, Circle, ArrowLeft, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCourseStore } from '@/store/course-store';
import { useCreateItem, useCreateQuestionBank, useCreateQuestion, useAddQuestionToBank } from "@/hooks/hooks";
import { toast } from "sonner";

interface QuizWizardProps {
    quizWizardOpen: boolean;
    setQuizWizardOpen: (open: boolean) => void;
}

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
    allowSkip: boolean;
}

interface QuestionOption {
    id: string;
    text: string;
    explaination: string;
    isCorrect: boolean;
}

interface Question {
    id: string;
    text: string;
    type: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT';
    hint: string;
    timeLimitSeconds: number;
    points: number;
    options: QuestionOption[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

const QuizWizardModal: React.FC<QuizWizardProps> = ({ quizWizardOpen, setQuizWizardOpen }) => {
    const course = useCourseStore().currentCourse;
    const [currentStep, setCurrentStep] = useState(1);
    const { mutateAsync: createItem, isPending } = useCreateItem();
    const { mutateAsync: createQuestionBank } = useCreateQuestionBank();
    const { mutateAsync: createQuestion } = useCreateQuestion();
    const { mutateAsync: addQuestionToBank } = useAddQuestionToBank();

    // Quiz settings form
    const [quizSettingsForm, setQuizSettingsForm] = useState<QuizSettingsForm>({
        name: '',
        description: '',
        passThreshold: 0.7,
        maxAttempts: 3,
        quizType: 'NO_DEADLINE',
        approximateTimeToComplete: '00:30:00',
        allowPartialGrading: true,
        allowHint: true,
        showCorrectAnswersAfterSubmission: true,
        showExplanationAfterSubmission: true,
        showScoreAfterSubmission: true,
        questionVisibility: 5,
        releaseTime: new Date().toISOString().slice(0, 16),
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        allowSkip: false
    });

    // Questions state
    const [questions, setQuestions] = useState<Question[]>([]);
    const [questionBankName, setQuestionBankName] = useState('');
    const [currentQuestion, setCurrentQuestion] = useState<Question>({
        id: '',
        text: '',
        type: 'SELECT_ONE_IN_LOT',
        hint: '',
        timeLimitSeconds: 60,
        points: 5,
        options: [],
        priority: 'LOW'
    });

    // Helper functions
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const addOption = () => {
        setCurrentQuestion(prev => ({
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
        setCurrentQuestion(prev => ({
            ...prev,
            options: prev.options.filter(option => option.id !== id)
        }));
    };

    const updateOption = (id: string, field: 'text' | 'explaination', value: string) => {
        setCurrentQuestion(prev => ({
            ...prev,
            options: prev.options.map(option =>
                option.id === id ? { ...option, [field]: value } : option
            )
        }));
    };

    const toggleOptionCorrectness = (id: string) => {
        setCurrentQuestion(prev => ({
            ...prev,
            options: prev.options.map(option => {
                if (option.id === id) {
                    if (prev.type === 'SELECT_ONE_IN_LOT') {
                        return { ...option, isCorrect: true };
                    }
                    return { ...option, isCorrect: !option.isCorrect };
                } else if (prev.type === 'SELECT_ONE_IN_LOT') {
                    return { ...option, isCorrect: false };
                }
                return option;
            })
        }));
    };

    const addQuestion = () => {
        if (!currentQuestion.text.trim()) {
            toast.error("Please enter a question text");
            return;
        }
        if (currentQuestion.options.length < 2) {
            toast.error("Please add at least 2 options");
            return;
        }
        if (!currentQuestion.options.some(opt => opt.isCorrect)) {
            toast.error("Please mark at least one option as correct");
            return;
        }

        const newQuestion = { ...currentQuestion, id: generateId() };
        setQuestions(prev => [...prev, newQuestion]);
        
        // Reset current question
        setCurrentQuestion({
            id: '',
            text: '',
            type: 'SELECT_ONE_IN_LOT',
            hint: '',
            timeLimitSeconds: 60,
            points: 5,
            options: [],
            priority: 'LOW'
        });
        
        toast.success("Question added successfully");
    };

    const removeQuestion = (id: string) => {
        setQuestions(prev => prev.filter(q => q.id !== id));
    };

    const canProceedToStep2 = () => {
        return quizSettingsForm.name.trim() && quizSettingsForm.description.trim();
    };

    const canCreateQuiz = () => {
        return questions.length > 0 && questionBankName.trim();
    };

    const handleCreateQuiz = async () => {
        if (!course?.versionId || !course?.moduleId || !course?.sectionId) {
            console.error('Missing course context');
            return;
        }

        if (!canCreateQuiz()) {
            toast.error("Please add at least one question and provide a question bank name");
            return;
        }

        try {
            toast.info("Creating quiz...");

            // Step 1: Create question bank
            console.log('Creating question bank...');
            const questionBankResult = await createQuestionBank({
                body: {
                    title: questionBankName,
                    description: `Question bank for ${quizSettingsForm.name}`,
                    courseId: course.courseId,
                    courseVersionId: course.versionId,
                    questions: []
                }
            });

            const questionBankId = questionBankResult.questionBankId;
            console.log('Question bank created successfully with ID:', questionBankId);

            // Step 2: Create questions and add to bank
            for (const question of questions) {
                // Validate question has correct options before creating
                const correctOptions = question.options.filter(opt => opt.isCorrect);
                const incorrectOptions = question.options.filter(opt => !opt.isCorrect);
                
                if (correctOptions.length === 0) {
                    toast.error(`Question "${question.text}" must have at least one correct answer`);
                    continue;
                }
                
                if (question.options.length < 2) {
                    toast.error(`Question "${question.text}" must have at least 2 options`);
                    continue;
                }

                // Create a simple question matching the test structure exactly
                const questionData = {
                    text: question.text,
                    type: question.type,
                    points: question.points,
                    timeLimitSeconds: question.timeLimitSeconds,
                    isParameterized: false,
                    hint: question.hint || '',
                    priority: question.priority,
                    parameters: [] // Add empty parameters array as required by backend
                };

                // Create solution exactly matching test structure
                let solution;
                if (question.type === 'SELECT_ONE_IN_LOT') {
                    const correctOption = correctOptions[0]; // Take first correct option
                    
                    solution = {
                        correctLotItem: {
                            text: correctOption.text,
                            explaination: correctOption.explaination || 'No explanation provided'
                        },
                        incorrectLotItems: incorrectOptions.map(opt => ({
                            text: opt.text,
                            explaination: opt.explaination || 'No explanation provided'
                        }))
                    };
                } else { // SELECT_MANY_IN_LOT
                    solution = {
                        correctLotItems: correctOptions.map(opt => ({
                            text: opt.text,
                            explaination: opt.explaination || 'No explanation provided'
                        })),
                        incorrectLotItems: incorrectOptions.map(opt => ({
                            text: opt.text,
                            explaination: opt.explaination || 'No explanation provided'
                        }))
                    };
                }

                try {
                    const requestBody = {
                        question: questionData,
                        solution: solution
                    };
                    
                    console.log('Creating question with body:', JSON.stringify(requestBody, null, 2));
                    
                    const questionResult = await createQuestion({
                        body: requestBody
                    });
                    console.log('Question created successfully with ID:', questionResult.questionId);

                    await addQuestionToBank({
                        params: { path: { questionBankId, questionId: questionResult.questionId } }
                    });
                    console.log('Question added to bank successfully');
                } catch (error: any) {
                    console.error('Failed to create question:', error);
                    console.error('Question data that failed:', questionData);
                    console.error('Solution data that failed:', solution);
                    
                    // Log more detailed error information
                    if (error?.response?.data) {
                        console.error('API Error Response:', error.response.data);
                    }
                    if (error?.message) {
                        console.error('Error Message:', error.message);
                    }
                    // Log the specific validation errors
                    if (error?.errors && Array.isArray(error.errors)) {
                        console.error('Validation Errors:');
                        error.errors.forEach((validationError: any, index: number) => {
                            console.error(`Error ${index + 1}:`, JSON.stringify(validationError, null, 2));
                            
                            // If there are nested children errors, log them too
                            if (validationError.children && Array.isArray(validationError.children)) {
                                console.error(`Error ${index + 1} - Nested validation errors:`, JSON.stringify(validationError.children, null, 2));
                            }
                        });
                    }
                    
                    toast.error(`Failed to create question: ${question.text}. Check console for details.`);
                    throw error; // Re-throw to stop the quiz creation process
                }
            }

            // Step 3: Create quiz with populated question bank
            const quizDetails = {
                passThreshold: quizSettingsForm.passThreshold,
                maxAttempts: quizSettingsForm.maxAttempts,
                quizType: quizSettingsForm.quizType,
                approximateTimeToComplete: quizSettingsForm.approximateTimeToComplete,
                allowPartialGrading: quizSettingsForm.allowPartialGrading,
                allowHint: quizSettingsForm.allowHint,
                showCorrectAnswersAfterSubmission: quizSettingsForm.showCorrectAnswersAfterSubmission,
                showExplanationAfterSubmission: quizSettingsForm.showExplanationAfterSubmission,
                showScoreAfterSubmission: quizSettingsForm.showScoreAfterSubmission,
                questionVisibility: quizSettingsForm.questionVisibility,
                releaseTime: new Date(quizSettingsForm.releaseTime).toISOString(),
                deadline: quizSettingsForm.quizType === 'DEADLINE' && quizSettingsForm.deadline 
                    ? new Date(quizSettingsForm.deadline).toISOString() 
                    : undefined, 
                questionBankRefs: [{
                    bankId: questionBankId,
                    count: questions.length, // Use the actual number of questions we created
                    difficulty: undefined, // No difficulty filter
                    tags: undefined, // No tag filter
                    type: undefined // No type filter
                }], // Populated with actual question bank reference
                allowSkip: quizSettingsForm.allowSkip
            };

            console.log('Creating quiz with question bank ID:', questionBankId);
            await createItem({
                params: {
                    path: {
                        versionId: course.versionId,
                        moduleId: course.moduleId,
                        sectionId: course.sectionId
                    }
                },
                body: {
                    name: quizSettingsForm.name,
                    description: quizSettingsForm.description,
                    type: "QUIZ",
                    quizDetails
                }
            });

            toast.success("Quiz created successfully with questions!");
            setQuizWizardOpen(false);
            
            // Reset state
            setCurrentStep(1);
            setQuestions([]);
            setQuestionBankName('');
            
        } catch (error) {
            console.error('Failed to create quiz:', error);
            toast.error("Failed to create quiz. Please try again.");
        }
    };

    return (
        <Dialog open={quizWizardOpen} onOpenChange={setQuizWizardOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        Create New Quiz - Step {currentStep} of 2
                    </DialogTitle>
                </DialogHeader>

                {currentStep === 1 && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Quiz Settings</h3>
                        
                        {/* Basic Quiz Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Quiz Name *</Label>
                                <Input
                                    id="name"
                                    value={quizSettingsForm.name}
                                    onChange={(e) => setQuizSettingsForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter quiz name"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="description">Description *</Label>
                                <Textarea
                                    id="description"
                                    value={quizSettingsForm.description}
                                    onChange={(e) => setQuizSettingsForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Enter quiz description"
                                />
                            </div>
                        </div>

                        {/* Quiz Configuration */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-lg">Quiz Configuration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="passThreshold">Pass Threshold (%)</Label>
                                    <Input
                                        id="passThreshold"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={Math.round(quizSettingsForm.passThreshold * 100)}
                                        onChange={(e) => setQuizSettingsForm(prev => ({ ...prev, passThreshold: parseInt(e.target.value) / 100 || 0 }))}
                                    />
                                    <p className="text-xs text-muted-foreground">Minimum percentage required to pass (0-100%)</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="maxAttempts">Max Attempts</Label>
                                    <Input
                                        id="maxAttempts"
                                        type="number"
                                        min="-1"
                                        value={quizSettingsForm.maxAttempts}
                                        onChange={(e) => setQuizSettingsForm(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) || 0 }))}
                                    />
                                    <p className="text-xs text-muted-foreground">Maximum attempts allowed (-1 for unlimited)</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="quizType">Quiz Type</Label>
                                    <Select
                                        value={quizSettingsForm.quizType}
                                        onValueChange={(value: 'DEADLINE' | 'NO_DEADLINE') => 
                                            setQuizSettingsForm(prev => ({ ...prev, quizType: value }))
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

                                <div className="space-y-2">
                                    <Label htmlFor="timeToComplete">Approximate Time (HH:MM:SS)</Label>
                                    <Input
                                        id="timeToComplete"
                                        value={quizSettingsForm.approximateTimeToComplete}
                                        onChange={(e) => setQuizSettingsForm(prev => ({ ...prev, approximateTimeToComplete: e.target.value }))}
                                        placeholder="HH:MM:SS"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="questionVisibility">Questions Visible to Students</Label>
                                    <Input
                                        id="questionVisibility"
                                        type="number"
                                        min="1"
                                        value={quizSettingsForm.questionVisibility}
                                        onChange={(e) => setQuizSettingsForm(prev => ({ ...prev, questionVisibility: parseInt(e.target.value) || 1 }))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Time Settings */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-lg">Time Settings</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="releaseTime">Release Time</Label>
                                    <Input
                                        id="releaseTime"
                                        type="datetime-local"
                                        value={quizSettingsForm.releaseTime}
                                        onChange={(e) => setQuizSettingsForm(prev => ({ ...prev, releaseTime: e.target.value }))}
                                    />
                                </div>

                                {quizSettingsForm.quizType === 'DEADLINE' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="deadline">Deadline</Label>
                                        <Input
                                            id="deadline"
                                            type="datetime-local"
                                            value={quizSettingsForm.deadline}
                                            onChange={(e) => setQuizSettingsForm(prev => ({ ...prev, deadline: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Student Experience */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-lg">Student Experience</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="allowPartialGrading">Allow Partial Grading</Label>
                                            <p className="text-xs text-muted-foreground">Enable partial credit for multi-select questions</p>
                                        </div>
                                        <Switch
                                            id="allowPartialGrading"
                                            checked={quizSettingsForm.allowPartialGrading}
                                            onCheckedChange={(checked) => setQuizSettingsForm(prev => ({ ...prev, allowPartialGrading: checked }))}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="allowHint">Allow Hints</Label>
                                            <p className="text-xs text-muted-foreground">Let students see hints for questions</p>
                                        </div>
                                        <Switch
                                            id="allowHint"
                                            checked={quizSettingsForm.allowHint}
                                            onCheckedChange={(checked) => setQuizSettingsForm(prev => ({ ...prev, allowHint: checked }))}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="allowSkip">Allow Skips</Label>
                                            <p className="text-xs text-muted-foreground">Allow students to skip quiz after 5 attempts</p>
                                        </div>
                                        <Switch
                                            id="allowSkip"
                                            checked={quizSettingsForm.allowSkip}
                                            onCheckedChange={(checked) => setQuizSettingsForm(prev => ({ ...prev, allowSkip: checked }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="showCorrectAnswers">Show Correct Answers</Label>
                                            <p className="text-xs text-muted-foreground">Display correct answers after submission</p>
                                        </div>
                                        <Switch
                                            id="showCorrectAnswers"
                                            checked={quizSettingsForm.showCorrectAnswersAfterSubmission}
                                            onCheckedChange={(checked) => setQuizSettingsForm(prev => ({ ...prev, showCorrectAnswersAfterSubmission: checked }))}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="showExplanations">Show Explanations</Label>
                                            <p className="text-xs text-muted-foreground">Display explanations after submission</p>
                                        </div>
                                        <Switch
                                            id="showExplanations"
                                            checked={quizSettingsForm.showExplanationAfterSubmission}
                                            onCheckedChange={(checked) => setQuizSettingsForm(prev => ({ ...prev, showExplanationAfterSubmission: checked }))}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="showScore">Show Score</Label>
                                            <p className="text-xs text-muted-foreground">Display score immediately after submission</p>
                                        </div>
                                        <Switch
                                            id="showScore"
                                            checked={quizSettingsForm.showScoreAfterSubmission}
                                            onCheckedChange={(checked) => setQuizSettingsForm(prev => ({ ...prev, showScoreAfterSubmission: checked }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setQuizWizardOpen(false)}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={() => setCurrentStep(2)}
                                disabled={!canProceedToStep2()}
                            >
                                Next: Add Questions <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Add Questions</h3>
                            <div className="text-sm text-muted-foreground">
                                Questions added: {questions.length}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="questionBankName">Question Bank Name *</Label>
                                <Input
                                    id="questionBankName"
                                    value={questionBankName}
                                    onChange={(e) => setQuestionBankName(e.target.value)}
                                    placeholder="Enter question bank name"
                                />
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Create New Question</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="questionText">Question Text *</Label>
                                        <Textarea
                                            id="questionText"
                                            value={currentQuestion.text}
                                            onChange={(e) => setCurrentQuestion(prev => ({ ...prev, text: e.target.value }))}
                                            placeholder="Enter your question"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Question Type</Label>
                                            <Select
                                                value={currentQuestion.type}
                                                onValueChange={(value: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT') => 
                                                    setCurrentQuestion(prev => ({ ...prev, type: value }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SELECT_ONE_IN_LOT">Single Choice</SelectItem>
                                                    <SelectItem value="SELECT_MANY_IN_LOT">Multiple Choice</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="points">Points</Label>
                                            <Input
                                                id="points"
                                                type="number"
                                                min="1"
                                                value={currentQuestion.points}
                                                onChange={(e) => setCurrentQuestion(prev => ({ ...prev, points: parseInt(e.target.value) || 5 }))}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="timeLimit">Time Limit (seconds)</Label>
                                            <Input
                                                id="timeLimit"
                                                type="number"
                                                min="10"
                                                value={currentQuestion.timeLimitSeconds}
                                                onChange={(e) => setCurrentQuestion(prev => ({ ...prev, timeLimitSeconds: parseInt(e.target.value) || 60 }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="hint">Hint (Optional)</Label>
                                        <Input
                                            id="hint"
                                            value={currentQuestion.hint}
                                            onChange={(e) => setCurrentQuestion(prev => ({ ...prev, hint: e.target.value }))}
                                            placeholder="Enter a helpful hint"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label>Answer Options *</Label>
                                            <Button type="button" onClick={addOption} size="sm">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add Option
                                            </Button>
                                        </div>

                                        {currentQuestion.options.map((option, index) => (
                                            <div key={option.id} className="border rounded-lg p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        {currentQuestion.type === 'SELECT_ONE_IN_LOT' ? (
                                                            <RadioGroup
                                                                value={option.isCorrect ? option.id : ''}
                                                                onValueChange={() => toggleOptionCorrectness(option.id)}
                                                            >
                                                                <RadioGroupItem value={option.id} />
                                                            </RadioGroup>
                                                        ) : (
                                                            <Checkbox
                                                                checked={option.isCorrect}
                                                                onCheckedChange={() => toggleOptionCorrectness(option.id)}
                                                            />
                                                        )}
                                                        <Label>Option {index + 1}</Label>
                                                        {option.isCorrect && <CheckCircle className="h-4 w-4 text-green-600" />}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeOption(option.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                <div>
                                                    <Input
                                                        value={option.text}
                                                        onChange={(e) => updateOption(option.id, 'text', e.target.value)}
                                                        placeholder="Enter option text"
                                                    />
                                                </div>

                                                <div>
                                                    <Input
                                                        value={option.explaination}
                                                        onChange={(e) => updateOption(option.id, 'explaination', e.target.value)}
                                                        placeholder="Enter explanation (optional)"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Button onClick={addQuestion} className="w-full">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Question
                                    </Button>
                                </CardContent>
                            </Card>

                            {questions.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Added Questions ({questions.length})</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {questions.map((question, index) => (
                                                <div key={question.id} className="flex items-center justify-between p-3 border rounded">
                                                    <div>
                                                        <div className="font-medium">
                                                            {index + 1}. {question.text.substring(0, 60)}
                                                            {question.text.length > 60 && '...'}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {question.type === 'SELECT_ONE_IN_LOT' ? 'Single Choice' : 'Multiple Choice'} • 
                                                            {question.points} points • 
                                                            {question.options.length} options
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeQuestion(question.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setCurrentStep(1)}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Settings
                            </Button>
                            <div className="space-x-2">
                                <Button variant="outline" onClick={() => setQuizWizardOpen(false)}>
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleCreateQuiz}
                                    disabled={!canCreateQuiz() || isPending}
                                >
                                    {isPending ? 'Creating...' : 'Create Quiz'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default QuizWizardModal;