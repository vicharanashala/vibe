import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle, Download, FileText, Lightbulb, Loader2, Sparkles, Upload } from "lucide-react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { useGenerateAIQuestions } from "@/hooks/hooks";
import { TranscriptResponse } from "@/types/ai.types";
import * as Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { ScrollArea } from "./ui/scroll-area";

interface QuestionUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId?: string;
  sectionId?: string;
}

type Step = "input" | "generating" | "response" | "csv-preview" | "csv-confirm" | "uploading" | "complete";

export const QuestionUploadDialog = ({
  open,
  onOpenChange,
  moduleId,
  sectionid
}: QuestionUploadDialogProps) => {
  const [step, setStep] = useState<Step>("input");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [textContent, setTextContent] = useState("");
  const [selectedTxtFile, setSelectedTxtFile] = useState<File | null>(null);
  const [isDraggingTxt, setIsDraggingTxt] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [llmResponse, setLlmResponse] = useState<TranscriptResponse[]>([]);
  const [generatedCSV, setGeneratedCSV] = useState<string>("");
  const [customCSVFile, setCustomCSVFile] = useState<File | null>(null);
  const [useCustomCSV, setUseCustomCSV] = useState(false);
  const [generalError, setGeneralError] = useState("")

  const { mutateAsync: generateQuestions, data, error: generateQuestionsError, isPending } = useGenerateAIQuestions();


  const resetDialog = () => {
    setStep("input");
    setYoutubeUrl("");
    setTextContent("");
    setSelectedTxtFile(null);
    setLlmResponse([]);
    setGeneratedCSV("");
    setCustomCSVFile(null);
    setUseCustomCSV(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetDialog, 300);
  };

  const handleTxtFileUpload = (file: File) => {
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      setSelectedTxtFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setTextContent(e.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      toast.error("Please upload a valid .txt file");
    }
  };

  useEffect(()=> {
    setGeneralError("")
  }, [step])

  const handleCsvFileUpload = (file: File) => {
    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      setCustomCSVFile(file);
      setUseCustomCSV(true);
    } else {
      toast.error("Please upload a valid CSV file");
    }
  };

const handleGenerateLLMResponse = async () => {
  setGeneralError(""); // Clear previous errors

  if (!textContent.trim()) {
    setGeneralError("Please enter text or upload a file.");
    return;
  }

  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

  if (!youtubeUrl) {
    setUrlError("YouTube URL is required. Please provide a valid URL.");
    return;
  } else if (!youtubeRegex.test(youtubeUrl)) {
    setUrlError(
      "Please provide a valid YouTube URL (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)"
    );
    return;
  } else {
    setUrlError("");
  }

  try {
    setStep("generating");

    const response = await generateQuestions({
      body: { text: textContent }
    });

    toast.success("Question generation completed");
    setLlmResponse(response.response);
    setStep("response");
  } catch (err: any) {
    console.error("Generation error:", err);

    // Extract nested error if available
    const message =
      err?.response?.data?.error ||
      err?.message ||
      "Failed to generate questions. Please try again.";

    setGeneralError(message);
    toast.error(message);

    setStep("input"); // go back to input screen on error
  }
};

//     // Simulate LLM processing delay
//     await new Promise((resolve) => setTimeout(resolve, 2000));

//     // Mock LLM response
// //     const mockResponse = `Based on the provided content, I've identified the following key topics and concepts:

// // **Main Topics:**
// // 1. Introduction to the subject matter
// // 2. Core principles and fundamentals
// // 3. Practical applications and examples
// // 4. Advanced concepts and best practices

// // **Key Concepts Extracted:**
// // - Concept A: This is the foundational principle that underlies all other topics
// // - Concept B: An important methodology discussed in detail
// // - Concept C: Real-world application scenarios
// // - Concept D: Best practices and recommendations

// // **Suggested Question Categories:**
// // - Comprehension questions (5 questions)
// // - Application-based questions (3 questions)
// // - Analysis questions (2 questions)

// // I can generate multiple-choice questions covering these topics with varying difficulty levels.`;
  // Step 2 → Step 3: Generate CSV from LLM response
//   const handleGenerateCSV = async () => {
//     setStep("generating");

//     // Simulate CSV generation delay
//     await new Promise((resolve) => setTimeout(resolve, 1500));

//     // Generate mock CSV data
//     const mockCSV = `Segment,Question,Option A,Option B,Option C,Option D,Correct Answer
// 1,"What is the main topic discussed in the content?","Topic A","Topic B","Topic C","Topic D",A
// 1,"Which concept was introduced first?","Concept 1","Concept 2","Concept 3","Concept 4",B
// 2,"What is the key takeaway from section 2?","Takeaway A","Takeaway B","Takeaway C","Takeaway D",C
// 2,"How does the author describe the process?","Simple","Complex","Moderate","Easy",A
// 3,"What example was used to illustrate the point?","Example 1","Example 2","Example 3","Example 4",D
// 3,"Which best practice was recommended?","Practice A","Practice B","Practice C","Practice D",B
// 4,"What is the relationship between Concept A and B?","Dependent","Independent","Correlated","Inverse",C
// 4,"How should the methodology be applied?","Sequentially","Randomly","Iteratively","Once",C
// 5,"What is the expected outcome?","Outcome A","Outcome B","Outcome C","Outcome D",A
// 5,"Which scenario best demonstrates the concept?","Scenario 1","Scenario 2","Scenario 3","Scenario 4",D`;

//     setGeneratedCSV(mockCSV);
//     setStep("csv-preview");
//   };

  const downloadMCQJsonAsCSV = () => {
    setStep("generating");

    const flattenedRows: any[] = [];

    let currentSegmentNumber = 1;
    let previousTimestamp: string | null = null;

    llmResponse?.forEach(segment => {
      const { timestamp, questions } = segment;

      // Check if timestamp changed → increment segment number
      if (previousTimestamp !== null && previousTimestamp !== timestamp) {
        currentSegmentNumber++;
      }

      previousTimestamp = timestamp;

      questions.forEach((q: any) => {
        flattenedRows.push({
          segmentNumber: currentSegmentNumber,
          timestamp,
          sno: q.sno,
          question: q.question,
          hint: q.hint,
          optionA: q.options?.A || "",
          expA: q.explanations?.A || "",
          optionB: q.options?.B || "",
          expB: q.explanations?.B || "",
          optionC: q.options?.C || "",
          expC: q.explanations?.C || "",
          optionD: q.options?.D || "",
          expD: q.explanations?.D || "",
          correctAnswer: q.correctAnswer,
        });
      });
    });

    const csv = Papa.unparse(flattenedRows);

    setGeneratedCSV(csv);
    setStep("csv-preview");

  };

  // Download CSV
  const handleDownloadCSV = () => {
    const blob = new Blob([generatedCSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated-questions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded successfully!");
  };

  // Final upload
  const handleFinalUpload = async () => {
    if (!youtubeUrl) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    setStep("uploading");

                                await processCSV(selectedCSVFile, activeSectionInfo.moduleId, activeSectionInfo.sectionId, youtubeUrl);

    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setStep("complete");
    toast.success("Questions uploaded successfully!");

    setTimeout(() => {
      handleClose();
      onUploadComplete?.();
    }, 1500);
  };

  const getStepNumber = (): number => {
    switch (step) {
      case "input":
        return 1;
      case "generating":
        return 1;
      case "response":
        return 2;
      case "csv-preview":
        return 3;
      case "csv-confirm":
        return 4;
      case "uploading":
      case "complete":
        return 4;
      default:
        return 1;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Questions & Upload CSV
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        {step !== "complete" && (
          <div className="flex items-center justify-center gap-2 py-2">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    getStepNumber() >= num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {num}
                </div>
                {num < 4 && (
                  <div
                    className={`w-12 h-0.5 mx-1 transition-colors ${
                      getStepNumber() > num ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Input */}
        {step === "input" && (
          <div className="grid gap-6 py-4">
           
            <div className="space-y-4">
              <Label>Content for Question Generation</Label>

              {/* Text Area */}
              <Textarea
                placeholder="Type or paste your content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="min-h-[180px] resize-none"
              />

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or upload a file
                  </span>
                </div>
              </div>

              {/* File Upload */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDraggingTxt
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingTxt(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleTxtFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingTxt(true);
                }}
                onDragLeave={() => setIsDraggingTxt(false)}
                onClick={() => document.getElementById("txt-upload")?.click()}
              >
                <div className="space-y-2">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Click to upload</span> or drag
                    and drop
                  </p>
                  <p className="text-xs text-muted-foreground">.txt file</p>
                  {selectedTxtFile && (
                    <p className="text-sm font-medium text-primary mt-2">
                      ✓ {selectedTxtFile.name}
                    </p>
                  )}
                </div>
                <input
                  id="txt-upload"
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleTxtFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>
              <div className="space-y-2">
              <Label htmlFor="youtube-url">YouTube Video URL</Label>
              
              <Input
                id="youtube-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) =>{ setYoutubeUrl(e.target.value); setUrlError("")}}
                className={urlError ? "border-red-500 focus-visible:ring-red-500" : ""}
              />

              {urlError ? (
                <p className="text-xs text-red-500">{urlError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The video that these questions are based on
                </p>
              )}
            </div>
            {generalError && (
                <p className="text-red-500 text-sm mt-2">{generalError}</p>
              )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerateLLMResponse} disabled={!textContent.trim()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Generating State */}
        {step === "generating" && (
          <div className="py-16 text-center space-y-4">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
            <div>
              <p className="text-lg font-medium">Processing...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please wait while we process your content
              </p>
            </div>
          </div>
        )}

        {/* Step 2: LLM Response Preview */}
        {step === "response" && (
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">AI Analysis Response</Label>
              <p className="text-xs text-muted-foreground">
                Review the AI's analysis of your content before generating questions
              </p>
            </div>
{/* 
            <div className="bg-muted/50 rounded-lg p-4 max-h-[350px] overflow-y-auto border">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm font-sans text-foreground">
                  {JSON.stringify(llmResponse, null, 2)}
                </pre>
              </div>
            </div> */}
          <ScrollArea className="h-[550px] rounded-md border p-4">
            <div className="space-y-6">
              {llmResponse?.map((segment, index) => (
                <Card key={index} className="shadow-md border">
                  <CardHeader>
                    <CardTitle className="flex justify-between">
                      <span>Segment {segment.segmentNumber}</span>
                      <span className="text-sm text-muted-foreground">
                        Timestamp: {segment.timestamp}
                      </span>
                    </CardTitle>
                  </CardHeader>

                <CardContent className="space-y-6 pt-6">
                  {segment.questions.map((q, qIndex) => (
                    <Accordion key={qIndex} type="single" collapsible className="border rounded-lg overflow-hidden">
                      <AccordionItem value={`q-${qIndex}`} className="border-none">

                        <AccordionTrigger className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <div className="flex items-start gap-3 text-left">
                            <span className="font-bold text-lg shrink-0">
                              Q{q.sno}.
                            </span>
                            <span className="font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
                              {q.question}
                            </span>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-5 pb-5 space-y-5 bg-gray-50 dark:bg-gray-900">
                          
                          {/* Hint Section */}
                         <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 rounded flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-300 mt-0.5" />
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              <strong>Hint:</strong> {q.hint}
                            </p>
                          </div>

                          {/* Options Grid */}
                          <div>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">
                              Options:
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {Object.entries(q.options).map(([key, val]) => (
                                <div 
                                  key={key} 
                                  className={`p-4 rounded-lg border-2 transition-all ${
                                    q.correctAnswer === key 
                                      ? 'bg-green-50 dark:bg-green-900/20 border-green-400 shadow-md' 
                                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <strong className="text-blue-600 dark:text-blue-400 text-lg shrink-0">
                                      {key}:
                                    </strong>
                                    <span className="text-gray-700 dark:text-gray-200 flex-1">
                                      {val}
                                    </span>
                                  </div>
                                  {q.correctAnswer === key && (
                                    <span className="inline-flex items-center mt-2 text-green-700 dark:text-green-400 font-semibold text-sm">
                                      ✓ Correct Answer
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Explanations Section */}
                          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
                           <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                              <BookOpen className="w-5 h-5 text-primary" />
                              Explanations:
                            </h4>
                            <div className="space-y-3">
                              {Object.entries(q.explanations).map(([key, val]) => (
                                <div key={key} className="pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                                  <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                    <strong className="text-blue-600 dark:text-blue-400">{key}:</strong>{' '}
                                    <span className={q.correctAnswer === key ? 'font-medium' : ''}>
                                      {val}
                                    </span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                        </AccordionContent>

                      </AccordionItem>
                    </Accordion>
                  ))}
                </CardContent>
              </Card>
              ))}
            </div>
          </ScrollArea>


    
              {generalError && (
                <p className="text-red-500 text-sm mt-2">{generalError}</p>
              )}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={downloadMCQJsonAsCSV}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate CSV
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: CSV Preview */}
        {step === "csv-preview" && (
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Generated Questions CSV</Label>
              <p className="text-xs text-muted-foreground">
                Review the generated questions. You can download the CSV or proceed to upload.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 max-h-[300px] overflow-y-auto border font-mono">
              <pre className="text-xs text-foreground whitespace-pre-wrap">{generatedCSV}</pre>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep("response")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleDownloadCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
                <Button onClick={() => setStep("csv-confirm")}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: CSV Confirm / Upload Custom */}
        {step === "csv-confirm" && (
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Confirm CSV Upload</Label>
              <p className="text-xs text-muted-foreground">
                Use the generated CSV or upload a modified version
              </p>
            </div>

            {/* Current CSV Selection */}
            <div className="space-y-3">
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  !useCustomCSV
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setUseCustomCSV(false)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      !useCustomCSV ? "border-primary" : "border-muted-foreground"
                    }`}
                  >
                    {!useCustomCSV && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">Use Generated CSV</p>
                    <p className="text-xs text-muted-foreground">
                      {generatedCSV.split("\n").length - 1} questions generated
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  useCustomCSV
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setUseCustomCSV(true)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      useCustomCSV ? "border-primary" : "border-muted-foreground"
                    }`}
                  >
                    {useCustomCSV && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Upload Custom CSV</p>
                    <p className="text-xs text-muted-foreground">
                      {customCSVFile ? customCSVFile.name : "Upload a modified or different CSV"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom CSV Upload Area */}
            {useCustomCSV && (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDraggingCsv
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingCsv(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleCsvFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingCsv(true);
                }}
                onDragLeave={() => setIsDraggingCsv(false)}
                onClick={() => document.getElementById("csv-upload")?.click()}
              >
                <div className="space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Click to upload</span> or drag
                    and drop
                  </p>
                  <p className="text-xs text-muted-foreground">.csv file</p>
                  {customCSVFile && (
                    <p className="text-sm font-medium text-primary mt-2">
                      ✓ {customCSVFile.name}
                    </p>
                  )}
                </div>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleCsvFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>
            )}

              {generalError && (
                <p className="text-red-500 text-sm mt-2">{generalError}</p>
              )}
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("csv-preview")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleFinalUpload}
                disabled={useCustomCSV && !customCSVFile}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Questions
              </Button>
            </div>
          </div>
        )}

        {/* Uploading State */}
        {step === "uploading" && (
          <div className="py-16 text-center space-y-4">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
            <div>
              <p className="text-lg font-medium">Uploading Questions...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please wait while we save your questions
              </p>
            </div>
          </div>
        )}

        {/* Complete State */}
        {step === "complete" && (
          <div className="py-16 text-center space-y-4">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <div>
              <p className="text-lg font-medium">Upload Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your questions have been saved successfully
              </p>
            </div>
          </div>
        )}
      
      </DialogContent>
    </Dialog>
  );
}
