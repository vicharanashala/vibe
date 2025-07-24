import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Edit, Trash2, Plus, Search, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Types
interface QuizMetadata {
  passThreshold: number;
  maxAttempts: number;
  quizType: 'DEADLINE' | 'NO_DEADLINE';
  releaseTime?: Date;
  deadline?: Date;
  approximateTimeToComplete: string;
  allowPartialGrading: boolean;
  allowHint: boolean;
  showCorrectAnswersAfterSubmission: boolean;
  showExplanationAfterSubmission: boolean;
  showScoreAfterSubmission: boolean;
  questionVisibility: number;
}

interface LotItem {
  text: string;
  explaination?: string;
  _id: string | { buffer: Uint8Array };
}

interface QuizQuestion {
  id: string;
  type: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE' | 'ORDER_THE_LOTS';
  question: string;
  options?: string[];
  lotItems?: LotItem[];
  correctAnswerIndex?: number;
  correctAnswerIndexes?: number[];
  points: number;
  timeLimit?: number;
  hint?: string;
  solution?: any;
  decimalPrecision?: number;
  expression?: string;
}

interface Quiz {
  _id: string;
  title: string;
  description?: string;
  metadata: QuizMetadata;
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
  courseId: string;
}

type QuizModalProps = {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  onQuizCreated?: (quiz: Quiz) => void;
};

const questionTypes = [
  "SELECT_ONE_IN_LOT",
  "SELECT_MANY_IN_LOT", 
  "NUMERIC_ANSWER_TYPE",
  "DESCRIPTIVE",
  "ORDER_THE_LOTS",
] as const;

export default function QuizModal({ isOpen, onClose, courseId, onQuizCreated }: QuizModalProps) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);

  // Form states
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [metadata, setMetadata] = useState<QuizMetadata>({
    passThreshold: 50,
    maxAttempts: 3,
    quizType: 'NO_DEADLINE',
    questionVisibility: 1,
    approximateTimeToComplete: "30",
    allowPartialGrading: false,
    allowHint: true,
    showCorrectAnswersAfterSubmission: false,
    showExplanationAfterSubmission: false,
    showScoreAfterSubmission: true,
  });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Load quizzes on mount
  useEffect(() => {
    if (isOpen && mode === 'list') {
      loadQuizzes();
    }
  }, [isOpen, mode, courseId]);

  // Always fetch quiz details when expandedQuizId changes
  useEffect(() => {
    if (expandedQuizId) {
      loadQuizDetails(expandedQuizId);
    }
  }, [expandedQuizId]);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/quizzes`);
      if (response.ok) {
        const data = await response.json();
        setQuizzes(data.quizzes || []);
      }
    } catch (error) {
      console.error('Failed to load quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizDetails = async (quizId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}`);
      if (response.ok) {
        const quiz = await response.json();
        setSelectedQuiz(quiz);
        setQuizTitle(quiz.title);
        setQuizDescription(quiz.description || "");
        setMetadata(quiz.metadata);
        setQuestions(quiz.questions || []);
      }
    } catch (error) {
      console.error('Failed to load quiz details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!quizTitle.trim()) {
      alert("Please enter a quiz title");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quizTitle,
          description: quizDescription,
          metadata,
          questions
        })
      });

      if (response.ok) {
        const newQuiz = await response.json();
        onQuizCreated?.(newQuiz);
        resetForm();
        setMode('list');
        loadQuizzes();
      }
    } catch (error) {
      console.error('Failed to create quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuiz = async () => {
    if (!selectedQuiz) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/quizzes/${selectedQuiz._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quizTitle,
          description: quizDescription,
          metadata,
          questions
        })
      });

      if (response.ok) {
        setMode('list');
        loadQuizzes();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to update quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm("Are you sure you want to delete this quiz?")) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadQuizzes();
      }
    } catch (error) {
      console.error('Failed to delete quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQuizTitle("");
    setQuizDescription("");
    setQuestions([]);
    setSelectedQuiz(null);
    setMetadata({
      passThreshold: 50,
      maxAttempts: 3,
      quizType: 'NO_DEADLINE',
      questionVisibility: 1,
      approximateTimeToComplete: "30",
      allowPartialGrading: false,
      allowHint: true,
      showCorrectAnswersAfterSubmission: false,
      showExplanationAfterSubmission: false,
      showScoreAfterSubmission: true,
    });
  };

  const handleTimeLimitChange = (index: number, newTime: number) => {
    const updated = [...questions];
    updated[index].timeLimit = newTime * 60;
    setQuestions(updated);
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const addSampleQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: `q_${Date.now()}`,
      type: 'SELECT_ONE_IN_LOT',
      question: 'Sample Question',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswerIndex: 0,
      points: 1,
      timeLimit: 60,
    };
    setQuestions([...questions, newQuestion]);
  };

  const filteredQuizzes = quizzes.filter(quiz =>
    quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quiz.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleQuizExpansion = (quizId: string) => {
    if (expandedQuizId === quizId) {
      setExpandedQuizId(null);
    } else {
      setExpandedQuizId(quizId);
      loadQuizDetails(quizId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] bg-white flex flex-col rounded-xl shadow-lg px-6 py-4 overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <DialogTitle className="text-2xl font-semibold">
            {mode === 'list' ? 'Quiz Manager' : mode === 'create' ? 'Create Quiz' : 'Edit Quiz'}
          </DialogTitle>
          <div className="flex gap-2">
            {mode !== 'list' && (
              <Button variant="outline" onClick={() => { setMode('list'); resetForm(); }}>
                Back to List
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {mode === 'list' && (
            <div className="space-y-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search quizzes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={() => setMode('create')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quiz
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading quizzes...
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredQuizzes.map((quiz) => (
                    <Card key={quiz._id} className="border rounded-lg bg-gradient-to-br from-background to-muted/50">
                      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            onClick={() => toggleQuizExpansion(quiz._id)}
                            className="flex items-center gap-2 hover:bg-gray-100 rounded p-1"
                          >
                            {expandedQuizId === quiz._id ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <div className="text-left">
                              <CardTitle className="font-semibold text-lg">{quiz.title}</CardTitle>
                              {quiz.description && (
                                <CardDescription className="text-sm text-muted-foreground mt-1">{quiz.description}</CardDescription>
                              )}
                            </div>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedQuiz(quiz);
                              setQuizTitle(quiz.title);
                              setQuizDescription(quiz.description || "");
                              setMetadata(quiz.metadata);
                              setQuestions(quiz.questions || []);
                              setMode('edit');
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteQuiz(quiz._id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      {expandedQuizId === quiz._id && selectedQuiz && (
                        <CardContent className="pt-0">
                          <Separator className="my-3" />
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                            <div>
                              <Badge variant="outline">Pass Threshold</Badge>
                              <span className="ml-2">{selectedQuiz.metadata.passThreshold}%</span>
                            </div>
                            <div>
                              <Badge variant="outline">Max Attempts</Badge>
                              <span className="ml-2">{selectedQuiz.metadata.maxAttempts}</span>
                            </div>
                            <div>
                              <Badge variant="outline">Quiz Type</Badge>
                              <span className="ml-2">{selectedQuiz.metadata.quizType}</span>
                            </div>
                            <div>
                              <Badge variant="outline">Questions</Badge>
                              <span className="ml-2">{selectedQuiz.questions?.length || 0}</span>
                            </div>
                          </div>
                          <Separator className="my-3" />
                          {selectedQuiz.questions && selectedQuiz.questions.length > 0 && (
                            <div className="space-y-3">
                              <h4 className="font-medium mb-2">Questions:</h4>
                              {selectedQuiz.questions.map((question, index) => (
                                <Card
                                  key={question.id}
                                  className="border bg-white dark:bg-card"
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <Badge variant="outline">
                                          Q{index + 1}: {question.type.replace(/_/g, ' ')}
                                        </Badge>
                                        <Badge variant="outline">
                                          {question.points} pts
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {question.timeLimit ? `${Math.round(question.timeLimit / 60)} min` : 'No limit'}
                                      </div>
                                    </div>
                                    <div className="mt-2 text-base font-medium">
                                      {question.question}
                                    </div>
                                    {question.hint && (
                                      <div className="mt-2 text-sm text-blue-700 bg-blue-50 rounded p-2">
                                        <strong>Hint:</strong> {question.hint}
                                      </div>
                                    )}
                                    {question.options && question.options.length > 0 && (
                                      <div className="mt-2">
                                        <div className="text-sm font-medium mb-1">Options:</div>
                                        <ul className="list-disc ml-6 text-sm">
                                          {question.options.map((opt: any, idx: number) => (
                                            <li
                                              key={idx}
                                              className={
                                                question.correctAnswerIndex === idx
                                                  ? "text-green-600 font-semibold"
                                                  : question.correctAnswerIndexes?.includes(idx)
                                                  ? "text-green-600 font-semibold"
                                                  : ""
                                              }
                                            >
                                              {typeof opt === "string" ? opt : opt.text}
                                              {question.correctAnswerIndex === idx && " (Correct)"}
                                              {question.correctAnswerIndexes?.includes(idx) && " (Correct)"}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {question.solution && (
                                      <div className="mt-2 text-sm">
                                        <span className="font-medium">Solution:</span>
                                        <pre className="bg-gray-100 p-2 rounded text-xs">
                                          {JSON.stringify(question.solution, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}

                  {filteredQuizzes.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No quizzes found matching your search.' : 'No quizzes created yet.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(mode === 'create' || mode === 'edit') && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-4">Basic Information</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Quiz Title</Label>
                    <Input
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="Enter quiz title"
                    />
                  </div>
                  <div>
                    <Label>Description (Optional)</Label>
                    <Textarea
                      value={quizDescription}
                      onChange={(e) => setQuizDescription(e.target.value)}
                      placeholder="Enter quiz description"
                    />
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-4">Quiz Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Pass Threshold (%)</Label>
                    <Input
                      type="number"
                      value={metadata.passThreshold}
                      onChange={(e) => setMetadata({...metadata, passThreshold: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>Max Attempts</Label>
                    <Input
                      type="number"
                      value={metadata.maxAttempts}
                      onChange={(e) => setMetadata({...metadata, maxAttempts: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>Quiz Type</Label>
                    <Select 
                      value={metadata.quizType} 
                      onValueChange={(value) => setMetadata({...metadata, quizType: value as 'DEADLINE' | 'NO_DEADLINE'})}
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
                    <Label>Est. Time (minutes)</Label>
                    <Input
                      value={metadata.approximateTimeToComplete}
                      onChange={(e) => setMetadata({...metadata, approximateTimeToComplete: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={metadata.allowHint} 
                      onCheckedChange={(checked) => setMetadata({...metadata, allowHint: checked})}
                    />
                    <Label>Allow Hints</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={metadata.allowPartialGrading} 
                      onCheckedChange={(checked) => setMetadata({...metadata, allowPartialGrading: checked})}
                    />
                    <Label>Allow Partial Grading</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={metadata.showScoreAfterSubmission} 
                      onCheckedChange={(checked) => setMetadata({...metadata, showScoreAfterSubmission: checked})}
                    />
                    <Label>Show Score After Submission</Label>
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Questions ({questions.length})</h3>
                  <Button onClick={addSampleQuestion} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sample Question
                  </Button>
                </div>

                {questions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No questions added yet. Click "Add Sample Question" to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questions.map((q, index) => (
                      <div key={q.id} className="border border-gray-300 p-4 rounded-md bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold">
                            {index + 1}. {q.question} ({q.type})
                          </h4>
                          <button
                            className="text-red-600 hover:underline"
                            onClick={() => handleDeleteQuestion(q.id)}
                          >
                            Delete
                          </button>
                        </div>

                        {q.hint && (
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Hint:</strong> {q.hint}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <strong>Time Limit (minutes):</strong>
                          <Input
                            type="number"
                            min={1}
                            className="w-24 h-8"
                            value={Math.round((q.timeLimit || 60) / 60)}
                            onChange={(e) => handleTimeLimitChange(index, parseInt(e.target.value) || 1)}
                          />
                        </div>

                        {q.options && q.options.length > 0 && (
                          <div>
                            <p className="font-medium mb-1">Options:</p>
                            <ul className="list-disc ml-6">
                              {q.options.map((opt: any, idx: number) => (
                                <li
                                  key={idx}
                                  className={
                                    q.correctAnswerIndex === idx || q.correctAnswerIndexes?.includes(idx)
                                      ? "text-green-600 font-semibold"
                                      : ""
                                  }
                                >
                                  {typeof opt === "string" ? opt : opt.text}
                                  {q.correctAnswerIndex === idx && " (Correct)"}
                                  {q.correctAnswerIndexes?.includes(idx) && " (Correct)"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setMode('list'); resetForm(); }}>
                  Cancel
                </Button>
                <Button
                  onClick={mode === 'create' ? handleCreateQuiz : handleUpdateQuiz}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {mode === 'create' ? 'Create Quiz' : 'Update Quiz'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}