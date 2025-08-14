import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCourseStore } from '@/store/course-store';
import { useCreateItem } from "@/hooks/hooks";
import QuizSettingsDialog, { QuizSettingsForm } from './quiz-settings-dialog';

interface QuizWizardProps {
    quizWizardOpen: boolean;
    setQuizWizardOpen: (open: boolean) => void;
}

const QuizWizardModal: React.FC<QuizWizardProps> = ({ quizWizardOpen, setQuizWizardOpen }) => {
    const course = useCourseStore().currentCourse;
    const [showQuizSettings, setShowQuizSettings] = useState(false);
    const { mutateAsync: createItem, isPending, error } = useCreateItem();

    // Default quiz settings form
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
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    });

    const handleCreateQuiz = async () => {
        if (!course?.versionId || !course?.moduleId || !course?.sectionId) {
            console.error('Missing course context');
            return;
        }

        try {
            // Convert form data to the required format
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
                questionBankRefs: [],
            };

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

            // Close dialogs on success
            setShowQuizSettings(false);
            setQuizWizardOpen(false);
        } catch (error) {
            console.error('Failed to create quiz:', error);
        }
    };

    return (
        <>
            <Dialog open={quizWizardOpen} onOpenChange={setQuizWizardOpen}>

                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create New Quiz</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Set up a new quiz for your students. Configure the quiz settings and parameters.
                        </p>
                        <div className="flex flex-col gap-2">
                            <Button 
                                onClick={() => setShowQuizSettings(true)}
                                className="w-full"
                            >
                                Configure Quiz Settings
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => setQuizWizardOpen(false)}
                                className="w-full"
                            >
                                Cancel
                            </Button>
                        </div>
                        {error && (
                            <p className="text-sm text-red-600">
                                Error: {error}
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <QuizSettingsDialog
                open={showQuizSettings}
                onOpenChange={setShowQuizSettings}
                quizSettingsForm={quizSettingsForm}
                setQuizSettingsForm={setQuizSettingsForm}
                onSave={handleCreateQuiz}
                isSaving={isPending}
            />
        </>
    );
};

export default QuizWizardModal;