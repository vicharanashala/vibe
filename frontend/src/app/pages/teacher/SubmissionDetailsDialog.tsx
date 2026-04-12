import React from 'react';
import { User, FileText, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SubmissionDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    submission: any | null;
}

export const SubmissionDetailsDialog: React.FC<SubmissionDetailsDialogProps> = ({ isOpen, onClose, submission }) => {

    if (!submission) return null;

    const username = submission.userInfo?.firstName || 'Anonymous';
    const formFields = submission.formFields || {};
    const hasFormFields = Object.keys(formFields).length > 0;
    //   const fullFeedback = typeof submission.feedback === 'string' ? submission.feedback : JSON.stringify(submission.feedback, null, 2);
    const renderFormFields = () => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(formFields).map(([key, value]) => {
                    const displayValue = typeof value === 'object'
                        ? JSON.stringify(value, null, 2)
                        : (value === null || value === undefined ? 'N/A' : String(value));
                    const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Simple title case

                    return (
                        <div key={key} className="space-y-1">
                            <Label className="text-xs font-medium uppercase text-muted-foreground">{displayKey}</Label>
                            <p className={`text-sm ${displayValue.includes('N/A') ? 'text-muted-foreground' : 'font-medium'}`}>
                                {displayValue}
                            </p>
                        </div>
                    );
                })}
                {!hasFormFields && (
                    <p className="col-span-full text-center text-muted-foreground py-4">No form fields submitted</p>
                )}
            </div>
        );
    };

    const fullFeedback = typeof submission.feedback === 'string'
        ? submission.feedback
        : JSON.stringify(submission.feedback, null, 2);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-muted">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Submission Details
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* User Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                User Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-xs font-medium uppercase text-muted-foreground">Username</Label>
                                <p className="font-medium">{username}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-medium uppercase text-muted-foreground">Email</Label>
                                <p>{submission.userInfo?.email || 'N/A'}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-medium uppercase text-muted-foreground">Submitted At</Label>
                                <p>{new Date(submission.submittedAt).toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submission Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Submission Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium">Item Type</Label>
                                <Badge variant="outline">{submission.itemType || 'FEEDBACK'}</Badge>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">Item Name</Label>
                                <p className="font-medium">{submission.itemName || 'N/A'}</p>
                            </div>
                            {/* <div>
                <Label className="text-sm font-medium">Status</Label>
                <Badge variant="default">{submission.status || 'Submitted'}</Badge>
              </div> */}
                        </CardContent>
                    </Card>


                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Student Feedback Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose max-w-none">
                                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-gray-200 [&::-webkit-scrollbar-thumb]:bg-gray200 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:hover:bg-muted">
                                    {fullFeedback || 'No feedback provided'}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Form Fields Details */}
                    {hasFormFields && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Form Fields Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {renderFormFields()}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};