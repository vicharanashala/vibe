import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/openapi";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  Send, Sparkles, Trash2, User, Loader2, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";

interface PriorTurn {
  question: string;
  answer: string;
  promptType?: string;
  replyOptions?: string[];
}

interface AskBetalDrawerProps {
  courseId: string;
  moduleId?: string;
  sectionId?: string;
  moduleName?: string;
  sectionName?: string;
  currentVideoTitle?: string;
  currentVideoId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_PROMPTS = [
  { type: "summarize", label: "Summarize this video" },
  { type: "real_life_example", label: "Give a real-life example" },
  { type: "key_points", label: "Key points" },
  { type: "short_notes", label: "Short notes" },
  { type: "explain_differently", label: "Explain differently" }
];

function formatBetalResponse(text: string) {
  const lastQuestionMark = text.lastIndexOf('?');
  if (lastQuestionMark === -1) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
  
  let startIdx = 0;
  for (let i = lastQuestionMark - 1; i >= 0; i--) {
    if (text[i] === '.' || text[i] === '!' || text[i] === '\n') {
      startIdx = i + 1;
      break;
    }
  }
  
  const mainText = text.substring(0, startIdx);
  const questionText = text.substring(startIdx);
  
  return (
    <span className="whitespace-pre-wrap">
      {mainText}
      {questionText && (
        <span className="italic text-purple-600 dark:text-purple-400 font-medium block mt-1.5 border-l-2 border-purple-500/30 pl-2">
          {questionText}
        </span>
      )}
    </span>
  );
}

export function AskBetalDrawer({
  courseId,
  moduleId,
  sectionId,
  moduleName,
  sectionName,
  currentVideoTitle,
  currentVideoId,
  open,
  onOpenChange
}: AskBetalDrawerProps) {
  const [turns, setTurns] = useState<PriorTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const askBetalMutation = api.useMutation("post", "/ask-betal/ask");

  // Fetch usage status
  const usageQuery = api.useQuery("get", "/ask-betal/usage-status", {
    enabled: open
  });
  const usageData = usageQuery.data;

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      setTimeout(scrollToBottom, 100);
    }
  }, [open, turns, loading]);

  const handleClearHistory = () => {
    setTurns([]);
    setError(null);
    toast.success("Conversation history cleared.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuestion = input.trim();
    setInput("");
    setError(null);
    setLoading(true);

    const currentTurns = [...turns];

    try {
      const res = await askBetalMutation.mutateAsync({
        body: {
          courseId,
          moduleId: moduleId || undefined,
          sectionId: sectionId || undefined,
          question: userQuestion,
          priorTurns: currentTurns.map(t => ({ question: t.question, answer: t.answer })),
          currentVideoTitle: currentVideoTitle || undefined,
          currentVideoId: currentVideoId || undefined,
        } as any
      });

      if (res && res.answer) {
        setTurns([...currentTurns, { 
          question: userQuestion, 
          answer: res.answer, 
          replyOptions: res.replyOptions 
        }]);
      } else {
        setError("Invalid response received from assistant.");
      }
    } catch (err: any) {
      console.error("Ask Betal query failed:", err);
      const errorMsg = err?.body?.message || err?.message || "Failed to get response from learning assistant. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      usageQuery.refetch();
    }
  };

  const handleQuickPromptClick = async (promptType: string, label: string) => {
    if (loading) return;
    setError(null);
    setLoading(true);

    const questionText = label;
    const currentTurns = [...turns];

    try {
      const res = await askBetalMutation.mutateAsync({
        body: {
          courseId,
          moduleId: moduleId || undefined,
          sectionId: sectionId || undefined,
          question: questionText,
          promptType: promptType as any,
          priorTurns: currentTurns.map(t => ({ question: t.question, answer: t.answer })),
          currentVideoTitle: currentVideoTitle || undefined,
          currentVideoId: currentVideoId || undefined,
        } as any
      });

      if (res && res.answer) {
        setTurns([...currentTurns, { 
          question: questionText, 
          answer: res.answer, 
          promptType, 
          replyOptions: res.replyOptions 
        }]);
      } else {
        setError("Invalid response received from assistant.");
      }
    } catch (err: any) {
      console.error("Ask Betal quick query failed:", err);
      const errorMsg = err?.body?.message || err?.message || "Failed to get response. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      usageQuery.refetch();
    }
  };

  const handleContextualReplyClick = async (optionText: string) => {
    if (loading) return;
    setError(null);
    setLoading(true);

    const currentTurns = [...turns];

    try {
      const res = await askBetalMutation.mutateAsync({
        body: {
          courseId,
          moduleId: moduleId || undefined,
          sectionId: sectionId || undefined,
          question: optionText,
          priorTurns: currentTurns.map(t => ({ question: t.question, answer: t.answer })),
          currentVideoTitle: currentVideoTitle || undefined,
          currentVideoId: currentVideoId || undefined,
        } as any
      });

      if (res && res.answer) {
        setTurns([...currentTurns, { 
          question: optionText, 
          answer: res.answer, 
          replyOptions: res.replyOptions 
        }]);
      } else {
        setError("Invalid response received from assistant.");
      }
    } catch (err: any) {
      console.error("Ask Betal query failed:", err);
      const errorMsg = err?.body?.message || err?.message || "Failed to get response from learning assistant. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      usageQuery.refetch();
    }
  };

  const activeScopeText = currentVideoTitle
    ? `Video: ${currentVideoTitle}`
    : sectionName 
    ? `Section: ${sectionName}` 
    : moduleName 
    ? `Module: ${moduleName}` 
    : "Full Course Content";

  const remainingQuestions = usageData?.estimatedQuestionsRemaining ?? null;
  const isLow = remainingQuestions !== null && remainingQuestions < 5;

  const usageIndicator = remainingQuestions !== null ? (
    <span className={`text-[10px] ml-1.5 font-normal ${
      isLow 
        ? "text-red-500 bg-red-500/5 px-1.5 py-0.5 rounded-sm border border-red-500/10 animate-pulse" 
        : "text-muted-foreground/70"
    }`}>
      • ~{remainingQuestions} question{remainingQuestions === 1 ? "" : "s"} left today
    </span>
  ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full border-l border-border bg-background"
        side="right"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border bg-card flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 shadow-xs">
              <Sparkles className="size-6" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold flex items-center gap-1.5">
                Ask Betal
                <Sparkles className="size-4 text-purple-500 fill-purple-500/20 animate-pulse" />
              </SheetTitle>
              <SheetDescription className="text-xs font-medium text-muted-foreground mt-0.5 max-w-[320px] flex items-center flex-wrap gap-1">
                <span className="truncate max-w-[180px]">{activeScopeText}</span>
                {usageIndicator}
              </SheetDescription>
            </div>
          </div>

          {turns.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearHistory}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Clear Chat History"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </SheetHeader>

        {/* Chat Area */}
        <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
          <div className="space-y-4 pr-2">
            {turns.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center text-center py-10 px-4 space-y-5 message-animate-in">
                <div className="p-4 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-xs sparkle-pulse">
                  <Sparkles className="size-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground text-sm">Welcome to Ask Betal</h3>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    Ask questions about this lecture's videos and unlocked quiz explanations. Betal will only answer based on course materials.
                  </p>
                </div>
                
                {/* Starting action chips */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-sm pt-2">
                  {QUICK_PROMPTS.filter(p => p.type !== "explain_differently").map(p => {
                    if (p.type === "summarize" && !currentVideoId && !sectionId) return null;
                    if (["real_life_example", "key_points", "short_notes"].includes(p.type) && !moduleId) return null;
                    return (
                      <Button
                        key={p.type}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickPromptClick(p.type, p.label)}
                        className="h-8 text-xs font-normal px-3.5 rounded-full border-purple-200/60 dark:border-purple-800/30 text-purple-600 dark:text-purple-400 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer shadow-xs transition-colors duration-150"
                      >
                        {p.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conversation History */}
            {turns.map((turn, index) => (
              <div key={index} className="space-y-4 message-animate-in">
                {/* User message */}
                <div className="flex items-start justify-end gap-2.5">
                  <div className="flex flex-col items-end max-w-[85%]">
                    <div className="px-4 py-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm shadow-xs whitespace-pre-wrap leading-relaxed">
                      {turn.question}
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 mt-0.5">
                    <User className="size-3.5" />
                  </div>
                </div>

                {/* Assistant message */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xs mt-0.5">
                    <Sparkles className="size-3.5" />
                  </div>
                  <div className="flex flex-col items-start max-w-[85%] w-full">
                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-muted text-foreground text-sm shadow-xs border border-purple-500/10 whitespace-pre-wrap leading-relaxed w-full">
                      {formatBetalResponse(turn.answer)}
                    </div>

                    {/* Render follow-up chips directly below the latest response bubble */}
                    {index === turns.length - 1 && !loading && (
                      <div className="space-y-3 mt-3 w-full pl-0.5">
                        {/* Primary Row (Prominent AI-generated contextual options) */}
                        {turn.replyOptions && turn.replyOptions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 w-full">
                            {turn.replyOptions.map((opt, oIdx) => (
                              <Button
                                key={oIdx}
                                type="button"
                                onClick={() => handleContextualReplyClick(opt)}
                                className="h-8 text-xs font-semibold px-3.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-md cursor-pointer transition-colors duration-150"
                              >
                                {opt}
                              </Button>
                            ))}
                          </div>
                        )}

                        {/* Secondary Row (Subordinate generic quick-prompt chips) */}
                        <div className="flex flex-wrap gap-1.5 w-full">
                          {QUICK_PROMPTS.filter(p => p.type !== turn.promptType).map(p => {
                            if (p.type === "summarize" && !currentVideoId && !sectionId) return null;
                            if (["real_life_example", "key_points", "short_notes"].includes(p.type) && !moduleId) return null;
                            return (
                              <Button
                                key={p.type}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickPromptClick(p.type, p.label)}
                                className="h-7 text-[10.5px] font-normal px-2.5 rounded-full border-purple-200/40 dark:border-purple-800/15 text-purple-600 dark:text-purple-400 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer shadow-xs transition-colors duration-150"
                              >
                                {p.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Thinking Indicator */}
            {loading && (
              <div className="flex items-start gap-2.5 message-animate-in">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xs mt-0.5">
                  <Sparkles className="size-3.5 sparkle-pulse" />
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-none bg-muted text-muted-foreground text-xs shadow-xs border border-purple-500/10">
                  <Loader2 className="size-3.5 animate-spin text-purple-500" />
                  <span>Betal is thinking it over...</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2.5 justify-center py-2 message-animate-in">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 shadow-xs">
                  <AlertCircle className="size-4" />
                  <span>{error}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the course..."
              disabled={loading}
              className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || loading}
              className="rounded-lg h-10 px-4 flex items-center justify-center gap-1.5 shadow-xs"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send className="size-3.5" />
                </>
              )}
            </Button>
          </form>
          <div className="text-[10px] text-muted-foreground/60 text-center mt-2.5">
            Answers are grounded in course content.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
