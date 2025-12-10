import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle, CheckCircle2, Download, FileText, FileUp, Lightbulb, Loader2, Sparkles, Upload } from "lucide-react";
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
  onUploadComplete: (youtubeURL: string,  csvFile:File) => Promise<void>
  moduleId?: string;
  sectionId?: string;
}

const processingMessages = [
  "Evaluating each segments. Please wait…",
  "Extracting timestamped segments from the input…",
  "Analyzing content structure to prepare question generation…",
  "Generating context-aligned questions based on your segments…",
  "Reviewing generated questions for consistency and clarity…",
  "Ensuring questions align with extracted learning elements…",
  "Finalizing results. This may take a moment…",
];


type Step = "input" | "generating" | "response" | "csv-preview" | "csv-confirm" | "uploading" | "complete";

export const QuestionUploadDialog = ({
  open,
  onOpenChange,
  onUploadComplete
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
  const [messageIndex, setMessageIndex] = useState(0);

  const [showAdvancedFlow, setShowAdvancedFlow] = useState(false)

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
    setMessageIndex(0)
  }, [step])

  useEffect(() => {
    if (step !== "generating") return;

    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < processingMessages.length - 1 ? prev + 1 : prev
      );
    }, 10000);

    return () => clearInterval(interval);
  }, [step]);

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
          "Segment": currentSegmentNumber,
          "Question Timestamp [mm:ss]": timestamp,
          "S.No.": q.sno,
          "Question": q.question,
          "Hint": q.hint,
          "Option A": q.options?.A || "",
          "Expln-A": q.explanations?.A || "",
          "Option B": q.options?.B || "",
          "Expln-B": q.explanations?.B || "",
          "Option C": q.options?.C || "",
          "Expln-C": q.explanations?.C || "",
          "Option D": q.options?.D || "",
          "Expln-D": q.explanations?.D || "",
          "Correct Answer": q.correctAnswer,
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

  const handleloadCSV = () => {
  const file = new File([generatedCSV], "generated-questions.csv", {
    type: "text/csv",
  });

  return file;
  };

  // Final upload
  const handleFinalUpload = async () => {
    if (!youtubeUrl) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    try {
      setStep("uploading");
      let CSVFile = handleloadCSV()
      if(customCSVFile) {
        CSVFile = customCSVFile
      }

      await onUploadComplete?.(youtubeUrl, CSVFile);

      setStep("complete");
      toast.success("Content uploaded successfully!");

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error: any) {
      console.error(error);
      setStep("csv-confirm"); 
      toast.error(error?.message || "Failed to upload content. Please try again.");
    }
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

    {!showAdvancedFlow ?
          (<DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Upload Questions</DialogTitle>
                
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="youtube-url">YouTube Video URL</Label>
                  <Input
                    id="youtube-url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    disabled={step=="uploading"}
                  />
                  <p className="text-xs text-muted-foreground">
                    The video that these questions are based on
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Questions CSV File</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDraggingCsv ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingCsv(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const file = e.dataTransfer.files[0];
                        if (file.type === "text/csv" || file.name.endsWith('.csv')) {
                          setCustomCSVFile(file);
                        } else {
                          toast.error("Please upload a valid CSV file");
                        }
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingCsv(true);
                    }}
                    onDragLeave={() => setIsDraggingCsv(false)}
                    onClick={() => document.getElementById('csv-upload')?.click()}
                  >
                    <div className="space-y-2">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CSV file with questions (max 10MB)
                      </p>
                      {customCSVFile && (
                        <p className="text-sm font-medium text-foreground mt-2">
                          Selected: {customCSVFile.name}
                        </p>
                      )}
                    </div>
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setCustomCSVFile(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                </div>

                  <Button
                  variant="secondary"
                  onClick={() => window.open("/templates/QB - template_Sheet1.csv", "_blank")}
                  className="flex items-center gap-2"
                 >
                  <Download className="w-4 h-4" />
                      Download Sample CSV Template
                  </Button>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">CSV Format:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>First row should be the header with column names</li>
                    <li>Required columns: Segment, Question, Option A, Option B, Option C, Option D, Correct Answer</li>
                    <li>Segment: Numeric value to group questions</li>
                    <li>Correct Answer: Should be A, B, C, or D</li>
                  </ul>
                </div>
              </div>

             <div className="flex justify-between gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setYoutubeUrl('');
                  setCustomCSVFile(null);
                  setShowAdvancedFlow(true); 
                }}
                disabled={step=="uploading"}

              >
                Smart Upload (Claude AI)
              </Button>

              <div className="flex gap-2">
                

                <Button
                  variant="outline"
                  onClick={() => {
                    handleClose()
                    setYoutubeUrl('');
                    setCustomCSVFile(null);
                  }}
                  disabled={step=="uploading"}
                >
                  Cancel
                </Button>

                <Button
                  onClick={async () => {
                    if (!youtubeUrl) {
                      toast.error("Please enter a YouTube URL");
                      return;
                    }

                    if (!customCSVFile) {
                      toast.error("Please select a CSV file");
                      return;
                    }

                    try {
                      setStep("uploading");
                      await onUploadComplete?.(youtubeUrl, customCSVFile);
                      toast.success("Content uploaded successfully!");
                      setTimeout(() => {
                        handleClose();
                      }, 1500);
                    } catch (error) {
                      console.error("Error processing CSV:", error);
                      toast.error(error instanceof Error ? error.message : "Failed to process CSV");
                    }
                  }}
                  disabled={!youtubeUrl || !customCSVFile || step=="uploading"}
                >
                  {step =="uploading" ?"Uploading..." :"Upload"}
                </Button>
              </div>
            </div>

            </DialogContent>)
    :
          (<DialogContent className="sm:max-w-[850px] h-[90vh] overflow-y-auto">
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
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Content for Question Generation
                  </Label>
                  {/* Text Area */}
                <ScrollArea className="h-[320px] rounded-md border  p-2">
                    <Textarea
                      placeholder="Type or paste your content here..."
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="h-[380px] w-full resize-none border-none focus-visible:ring-0 p-0"
                    />
                  </ScrollArea>

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
               <div className="flex justify-between gap-2">
                  <Button
                    variant="secondary"
                    onClick={()=>{
                      setShowAdvancedFlow(false);
                      setSelectedTxtFile(null);
                      setYoutubeUrl('')
                    }} 
                  >
                    Disable Smart Mode
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>

                    <Button
                      onClick={handleGenerateLLMResponse}
                      disabled={!textContent.trim()}
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Generating State */}
            {step === "generating" && (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
              <div>
                <p className="text-lg font-medium">{processingMessages[messageIndex]}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please wait while we process your content…
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

              <ScrollArea className="max-h-142 rounded-lg border bg-muted/50 p-4 font-mono">
                <pre className="text-xs text-foreground whitespace-pre-wrap">
                  {generatedCSV}
                </pre>
              </ScrollArea>

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
                <div className={`space-y-3 ${!useCustomCSV && "h-142"}`}>
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
                    Please wait while we save course content
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
          
          </DialogContent>)
    }
    </Dialog>
  );
}
