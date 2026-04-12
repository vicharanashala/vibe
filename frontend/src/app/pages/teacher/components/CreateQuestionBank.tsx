import React, { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useCreateQuestionBank, useAddQuestionBankToQuiz, type AddQuestionBankBody } from '@/hooks/hooks';
import { useCourseStore } from '@/store/course-store';

interface CreateQuestionBankDialogProps {
    showCreateBankDialog: boolean;
    setShowCreateBankDialog: (value: boolean) => void;
    quizId?: string;
    questionBanks?: any[];
    onRequestEditBank?: (bankId: string) => void;
}

interface QuestionBankForm {
    title: string;
    description: string;
    tags: string[];
    points: number;
}

const CreateQuestionBankDialog: React.FC<CreateQuestionBankDialogProps> = ({
    showCreateBankDialog,
    setShowCreateBankDialog,
    quizId,
}) => {
    const course = useCourseStore().currentCourse;
    const createQuestionBank = useCreateQuestionBank();
    const addQuestionBankToQuiz = useAddQuestionBankToQuiz();

    // Form state
    const [bankForm, setBankForm] = useState<QuestionBankForm>({
        title: '',
        description: '',
        tags: [],
        points: 5
    });
    const [count, setCount] = useState(3);
    const [currentTag, setCurrentTag] = useState('');

    // Reset form when dialog closes
    const handleDialogChange = (open: boolean) => {
        setShowCreateBankDialog(open);
        if (!open) {
            setBankForm({ title: '', description: '', tags: [], points: 5 });
            setCurrentTag('');
        }
    };

    // Add tag functionality
    const handleAddTag = () => {
        if (currentTag.trim() && !bankForm.tags.includes(currentTag.trim())) {
            setBankForm({ ...bankForm, tags: [...bankForm.tags, currentTag.trim()] });
            setCurrentTag('');
        }
    };

    // Remove tag functionality
    const handleRemoveTag = (tagToRemove: string) => {
        setBankForm({
            ...bankForm,
            tags: bankForm.tags.filter(tag => tag !== tagToRemove)
        });
    };

    // Handle tag input on Enter key
    const handleTagKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    // Create question bank
    const handleCreateQuestionBank = async () => {
        if (!course?.courseId || !course?.versionId) {
            console.error('Course information is missing');
            return;
        }

        if (!bankForm.title.trim()) {
            console.error('Title is required');
            return;
        }

        try {
            const questionBankData = {
                courseId: course.courseId,
                courseVersionId: course.versionId,
                title: bankForm.title.trim(),
                description: bankForm.description.trim(),
                tags: bankForm.tags,
                points: bankForm.points,
                questions: [] // Empty array as requested
            };

            const data = await createQuestionBank.mutateAsync({ body: questionBankData });
            await addQuestionBankToQuiz.mutateAsync({
                params: { path: { quizId: quizId || "" } },
                body: {
                    bankId: data.questionBankId,
                    count: count || 3
                }
            });
            // Close dialog and reset form
            handleDialogChange(false);
        } catch (error) {
            console.error('Failed to create question bank:', error);
        }
    };

    return (
        <div className="p-4 border-b rounded ">
            <div className="flex items-center justify-between ">
                <div>
                    <h3 className="font-bold text-lg">Question Banks</h3>
                </div>
                <Dialog open={showCreateBankDialog} onOpenChange={handleDialogChange}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-full max-[425px]:w-[95vw] max-w-sm sm:max-w-[500px] mx-auto px-4 max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
                        <DialogHeader className="mb-3 text-left flex-shrink-0">
                            <DialogTitle>Create Question Bank</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 mt-5 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                            {/* Title Field */}
                            <div className="space-y-2">
                                <Label htmlFor="bankTitle mb-3">Title *</Label>
                                <Input
                                    id="bankTitle"
                                    value={bankForm.title}
                                    onChange={(e) => setBankForm({ ...bankForm, title: e.target.value })}
                                    placeholder="Enter question bank title"
                                    className="w-full"
                                />
                            </div>

                            {/* Description Field */}
                            <div className="space-y-2">
                                <Label htmlFor="bankDescription">Description *</Label>
                                <Textarea
                                    id="bankDescription"
                                    value={bankForm.description}
                                    onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })}
                                    placeholder="Enter question bank description"
                                    className="w-full resize-none"
                                    rows={3}
                                />
                            </div>

                            {/* Tags Field */}
                            <div className="space-y-2">
                                <Label htmlFor="bankTags">Tags</Label>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Input
                                            id="bankTags"
                                            value={currentTag}
                                            onChange={(e) => setCurrentTag(e.target.value)}
                                            onKeyPress={handleTagKeyPress}
                                            placeholder="Enter a tag"
                                            className="flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAddTag}
                                            disabled={!currentTag.trim() || bankForm.tags.includes(currentTag.trim())}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Display Tags */}
                                    {bankForm.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {bankForm.tags.map((tag, index) => (
                                                <Badge
                                                    key={index}
                                                    variant="secondary"
                                                    className="flex items-center gap-1"
                                                >
                                                    {tag}
                                                    <X
                                                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                                                        onClick={() => handleRemoveTag(tag)}
                                                    />
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Points Field */}
                            <div className="space-y-2">
                                <Label htmlFor="bankPoints">Points per Question *</Label>
                                <Input
                                    id="bankPoints"
                                    type="number"
                                    value={bankForm.points}
                                    onChange={(e) => setBankForm({ ...bankForm, points: parseInt(e.target.value) || 1 })}
                                    min={1}
                                    className="w-full"
                                    placeholder="Enter points for each question"
                                />
                            </div>

                            {/* Count Field */}
                            <div className="space-y-2">
                                <Label htmlFor="questionCount">Number of Questions from this bank to select randomly for this quiz</Label>
                                <Input
                                    id="questionCount"
                                    type="number"
                                    value={count}
                                    onChange={(e) => setCount(Number(e.target.value))}
                                    min={1}
                                    className="w-full"
                                    placeholder="Enter number of questions to add"
                                />
                            </div>

                            {/* Error Display */}
                            {createQuestionBank.error && (
                                <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                                    {createQuestionBank.error}
                                </div>
                            )}
                        </div>

                        {/* Dialog Actions */}
                        <div className="flex justify-end gap-2 mt-6 flex-shrink-0 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => handleDialogChange(false)}
                                disabled={createQuestionBank.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateQuestionBank}
                                disabled={createQuestionBank.isPending || !bankForm.title.trim()}
                            >
                                {createQuestionBank.isPending ? 'Creating...' : 'Create Question Bank'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default CreateQuestionBankDialog;