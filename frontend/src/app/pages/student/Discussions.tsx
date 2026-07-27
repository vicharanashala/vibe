import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { useUserEnrollments } from "@/hooks/hooks";
import { bufferToHex } from "@/utils/helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  MessageSquare,
  Trash2,
  Send,
  Loader2,
  MessageCircle,
  Plus
} from "lucide-react";
import {
  useListDiscussionThreads,
  useGetDiscussionThread,
  useCreateDiscussionThread,
  useCreateDiscussionReply,
  useDeleteDiscussionThread,
  useDeleteDiscussionReply,
  type DiscussionThread,
  type DiscussionReply
} from "@/hooks/use-discussion";

interface NewThreadFormValues {
  title: string;
  body: string;
}

function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  if (Number.isNaN(date.getTime()) || diffMs < 0) {
    return dateString;
  }
  
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

export default function DiscussionsPage() {
  const { user, token } = useAuthStore();
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeCohortId, setActiveCohortId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "detail" | "create">("list");

  // Load student enrollments to establish course context
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useUserEnrollments(1, 100, !!token);

  const enrollments = useMemo(() => {
    return (enrollmentsData?.enrollments || []).filter(
      (e: any) => e.status === "ACTIVE" || (e.percentCompleted ?? 0) !== 100
    );
  }, [enrollmentsData]);

  // Set initial course and cohort
  useEffect(() => {
    if (enrollments.length > 0 && !activeCourseId) {
      const first = enrollments[0];
      const courseIdHex = bufferToHex(first.courseId as string);
      const cohortIdHex = first.cohortId
        ? (typeof first.cohortId === "string" ? first.cohortId : bufferToHex(first.cohortId as any))
        : "";
      setActiveCourseId(courseIdHex);
      setActiveCohortId(cohortIdHex || null);
    }
  }, [enrollments, activeCourseId]);

  const activeCourseName = useMemo(() => {
    if (!activeCourseId) return "";
    const current = enrollments.find(e => bufferToHex(e.courseId as string) === activeCourseId);
    return current?.course?.name || "Selected Course";
  }, [enrollments, activeCourseId]);

  const handleCourseChange = (courseIdHex: string) => {
    const selected = enrollments.find(e => bufferToHex(e.courseId as string) === courseIdHex);
    if (selected) {
      const cohortIdHex = selected.cohortId
        ? (typeof selected.cohortId === "string" ? selected.cohortId : bufferToHex(selected.cohortId as any))
        : "";
      setActiveCourseId(courseIdHex);
      setActiveCohortId(cohortIdHex || null);
      setActiveThreadId(null);
      setView("list");
    }
  };

  // Discussions API integrations
  const {
    threads,
    setThreads,
    loading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads
  } = useListDiscussionThreads(activeCourseId, activeCohortId);

  const {
    thread,
    replies,
    setReplies,
    setThread,
    loading: detailLoading,
    error: detailError,
    refetch: refetchThread
  } = useGetDiscussionThread(activeThreadId);

  const { createThread } = useCreateDiscussionThread();
  const { createReply } = useCreateDiscussionReply();
  const { deleteThread } = useDeleteDiscussionThread();
  const { deleteReply } = useDeleteDiscussionReply();

  // Create Thread Form setup
  const { register: registerThread, handleSubmit: handleSubmitThread, reset: resetThreadForm, formState: { errors: threadErrors } } = useForm<NewThreadFormValues>({
    defaultValues: { title: "", body: "" }
  });

  // Reply Form setup
  const { register: registerReply, handleSubmit: handleSubmitReply, reset: resetReplyForm } = useForm<{ replyBody: string }>({
    defaultValues: { replyBody: "" }
  });

  const handlePostThread = async (data: NewThreadFormValues) => {
    if (!activeCourseId) {
      toast.error("No course context selected");
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticThread: DiscussionThread = {
      _id: tempId,
      courseId: activeCourseId,
      cohortId: activeCohortId,
      title: data.title,
      body: data.body,
      author: {
        uid: user?.uid || user?.id || "me",
        name: user?.name || "Student",
        avatar: user?.avatar
      },
      replyCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    // Prepend Optimistic Thread
    setThreads(prev => [optimisticThread, ...prev]);
    setView("list");
    resetThreadForm();

    try {
      const response = await createThread({
        courseId: activeCourseId,
        cohortId: activeCohortId,
        title: data.title,
        body: data.body
      });
      // Replace optimistic thread with real data
      setThreads(prev => prev.map(t => (t._id === tempId ? response : t)));
      toast.success("Thread posted successfully");
    } catch (err: any) {
      // Rollback
      setThreads(prev => prev.filter(t => t._id !== tempId));
      toast.error(err.message || "Failed to post thread. Placed back to editor.");
      // Put content back into form
      resetThreadForm({ title: data.title, body: data.body });
      setView("create");
    }
  };

  const handlePostReply = async (data: { replyBody: string }) => {
    if (!activeThreadId || !data.replyBody.trim()) return;

    const tempId = `temp-reply-${Date.now()}`;
    const optimisticReply: DiscussionReply = {
      _id: tempId,
      threadId: activeThreadId,
      body: data.replyBody,
      author: {
        uid: user?.uid || user?.id || "me",
        name: user?.name || "Student",
        avatar: user?.avatar
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Append Optimistic Reply
    setReplies(prev => [...prev, optimisticReply]);
    if (thread) {
      setThread({
        ...thread,
        replyCount: thread.replyCount + 1
      });
    }
    resetReplyForm();

    try {
      const response = await createReply(activeThreadId, data.replyBody);
      setReplies(prev => prev.map(r => (r._id === tempId ? response : r)));
    } catch (err: any) {
      // Rollback reply
      setReplies(prev => prev.filter(r => r._id !== tempId));
      if (thread) {
        setThread({
          ...thread,
          replyCount: Math.max(0, thread.replyCount - 1)
        });
      }
      toast.error(err.message || "Failed to submit reply");
      resetReplyForm({ replyBody: data.replyBody });
    }
  };

  const handleDeleteThread = async (threadIdToDelete: string) => {
    const threadToDelete = threads.find(t => t._id === threadIdToDelete);
    if (!threadToDelete) return;

    if (!confirm("Are you sure you want to delete this discussion thread?")) return;

    // Optimistic Deletion
    setThreads(prev => prev.filter(t => t._id !== threadIdToDelete));
    if (activeThreadId === threadIdToDelete) {
      setActiveThreadId(null);
      setView("list");
    }

    try {
      await deleteThread(threadIdToDelete);
      toast.success("Thread deleted successfully");
    } catch (err: any) {
      // Revert optimistic delete
      setThreads(prev => [threadToDelete, ...prev].sort((a, b) => {
        return new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime();
      }));
      toast.error(err.message || "Failed to delete thread");
    }
  };

  const handleDeleteReply = async (replyIdToDelete: string) => {
    const replyToDelete = replies.find(r => r._id === replyIdToDelete);
    if (!replyToDelete) return;

    if (!confirm("Are you sure you want to delete this reply?")) return;

    // Optimistic Deletion
    setReplies(prev => prev.filter(r => r._id !== replyIdToDelete));
    if (thread) {
      setThread({ ...thread, replyCount: Math.max(0, thread.replyCount - 1) });
    }

    try {
      await deleteReply(replyIdToDelete);
    } catch (err: any) {
      // Revert optimistic delete
      setReplies(prev => [...prev, replyToDelete]);
      if (thread) {
        setThread({ ...thread, replyCount: thread.replyCount + 1 });
      }
      toast.error(err.message || "Failed to delete reply");
    }
  };

  if (enrollmentsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Discussion Forum" description="Loading forum contexts..." />
        <div className="space-y-4">
          <Skeleton className="h-10 w-[240px]" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </div>
    );
  }

  if (enrollments.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Discussion Forum" description="Collaborate with your classmates." />
        <EmptyState
          title="No Course Enrollments Found"
          description="You need to be enrolled in a course to access discussion forums."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Forum Course Select and Header */}
      <PageHeader
        title="Discussion Forum"
        description={`Active Class Forum: ${activeCourseName}`}
        actions={
          <div className="flex items-center gap-2">
            <Select value={activeCourseId || ""} onValueChange={handleCourseChange}>
              <SelectTrigger className="w-[200px] bg-white dark:bg-[#17171a] border-border text-foreground">
                <SelectValue placeholder="Select Course" />
              </SelectTrigger>
              <SelectContent>
                {enrollments.map(e => {
                  const idHex = bufferToHex(e.courseId as string);
                  return (
                    <SelectItem key={idHex} value={idHex}>
                      {e.course?.name || "Unnamed Course"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {view === "list" && (
              <Button
                onClick={() => setView("create")}
                className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-semibold"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New Thread
              </Button>
            )}
          </div>
        }
      />

      {/* VIEW: THREAD LIST */}
      {view === "list" && (
        <div className="space-y-4">
          {threadsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(n => (
                <Card key={n} className="border border-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex gap-2 items-center">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-5 w-[60%]" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : threadsError ? (
            <div className="p-6 text-center text-destructive border border-destructive/20 rounded-lg bg-destructive/5">
              {threadsError}
            </div>
          ) : threads.length === 0 ? (
            <EmptyState
              title="No discussions yet"
              description="Be the first to start a discussion thread for this class!"
              actionText="Start a Thread"
              onAction={() => setView("create")}
            />
          ) : (
            <div className="grid gap-3">
              {threads.map(t => (
                <Card
                  key={t._id}
                  className="border border-border hover:border-primary/40 dark:hover:border-primary/40 cursor-pointer transition-all bg-white dark:bg-[#17171a]"
                  onClick={() => {
                    setActiveThreadId(t._id);
                    setView("detail");
                  }}
                >
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="space-y-2 min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base truncate group-hover:text-primary">
                        {t.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5 border border-border/20">
                            <AvatarImage src={t.author.avatar} alt={t.author.name} />
                            <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">
                              {t.author.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground/80">{t.author.name}</span>
                        </div>
                        <span>•</span>
                        <span title={new Date(t.createdAt).toLocaleString()}>
                          active {formatRelativeTime(t.lastActivityAt || t.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-xs font-semibold">{t.replyCount}</span>
                      </div>
                      {(user?.uid === t.author.uid || user?.id === t.author.uid) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteThread(t._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: CREATE THREAD */}
      {view === "create" && (
        <Card className="border border-border bg-white dark:bg-[#17171a]">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={() => setView("list")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to List
              </Button>
              <h2 className="text-base font-bold text-foreground">Create New Discussion Thread</h2>
            </div>

            <form onSubmit={handleSubmitThread(handlePostThread)} className="space-y-4">
              <div className="space-y-1.5">
                <Input
                  placeholder="Thread Title"
                  className={threadErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                  {...registerThread("title", {
                    required: "A title is required to start a thread",
                    maxLength: { value: 120, message: "Title cannot exceed 120 characters" }
                  })}
                />
                {threadErrors.title && (
                  <p className="text-xs text-destructive">{threadErrors.title.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Textarea
                  placeholder="Tell us what is on your mind... Add details, questions, or links."
                  className={`min-h-[160px] ${threadErrors.body ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  {...registerThread("body", { required: "Thread content/body is required" })}
                />
                {threadErrors.body && (
                  <p className="text-xs text-destructive">{threadErrors.body.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setView("list")}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-accent font-semibold">
                  Publish Thread
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* VIEW: THREAD DETAILS & REPLIES */}
      {view === "detail" && (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setActiveThreadId(null);
              setView("list");
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Discussions
          </Button>

          {detailLoading && !thread ? (
            <Card className="border border-border">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-[40%]" />
                <Skeleton className="h-4 w-[25%]" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ) : detailError ? (
            <div className="p-6 text-center text-destructive border border-destructive/20 rounded-lg bg-destructive/5">
              {detailError}
            </div>
          ) : !thread ? (
            <EmptyState title="Thread Not Found" description="The thread may have been deleted or moved." />
          ) : (
            <div className="space-y-6">
              {/* Main Post Thread Card */}
              <Card className="border border-border bg-white dark:bg-[#17171a] shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border/20">
                        <AvatarImage src={thread.author.avatar} alt={thread.author.name} />
                        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                          {thread.author.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{thread.author.name}</h4>
                        <p
                          className="text-[11px] text-muted-foreground"
                          title={new Date(thread.createdAt).toLocaleString()}
                        >
                          posted {formatRelativeTime(thread.createdAt)}
                        </p>
                      </div>
                    </div>

                    {(user?.uid === thread.author.uid || user?.id === thread.author.uid) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        onClick={() => handleDeleteThread(thread._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                      {thread.title}
                    </h2>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {thread.body}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Replies Divider / Counter */}
              <div className="flex items-center gap-2 border-b pb-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
                </span>
              </div>

              {/* Replies List */}
              <div className="space-y-3">
                {replies.map(r => (
                  <Card key={r._id} className="border border-border bg-white dark:bg-[#17171a]/55">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 border border-border/20">
                            <AvatarImage src={r.author.avatar} alt={r.author.name} />
                            <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                              {r.author.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="text-xs font-semibold text-foreground">{r.author.name}</span>
                            <span
                              className="text-[10px] text-muted-foreground ml-2"
                              title={new Date(r.createdAt).toLocaleString()}
                            >
                              {formatRelativeTime(r.createdAt)}
                            </span>
                          </div>
                        </div>

                        {(user?.uid === r.author.uid || user?.id === r.author.uid) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            onClick={() => handleDeleteReply(r._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {r.body}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Reply Composer Card */}
              <Card className="border border-border bg-white dark:bg-[#17171a] shadow-sm">
                <CardContent className="p-4">
                  <form onSubmit={handleSubmitReply(handlePostReply)} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Textarea
                        placeholder="Write a reply..."
                        className="min-h-[80px] text-sm resize-none focus-visible:ring-primary"
                        {...registerReply("replyBody", { required: true })}
                      />
                    </div>
                    <Button
                      type="submit"
                      size="icon"
                      className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-accent"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
