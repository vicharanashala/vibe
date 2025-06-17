import { useState, useEffect, useRef } from "react";
import {
  Clock,
  CheckCircle2,
  FileText,
  Info,
  ArrowRight,
  Image as ImageIcon,
  BookOpen,
  Circle,
  PlusCircle,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/store/auth-store";
import { useUserEnrollments, useCourseById } from "@/lib/api/hooks";
import { useNavigate } from "@tanstack/react-router";
import { useCourseStore } from "@/lib/store/course-store";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// Helper function to convert buffer to hex string
const bufferToHex = (buffer: unknown) => {
  if (buffer && typeof buffer === 'object' && 'buffer' in buffer) {
    const bufferObj = buffer as { buffer?: { data: number[] } };
    if (bufferObj.buffer?.data) {
      return Array.from(new Uint8Array(bufferObj.buffer.data))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }
  return '';
};

// Todo interface and hook
interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

const useTodos = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load todos from localStorage
    const savedTodos = localStorage.getItem('learningTodos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Save todos to localStorage whenever todos change
    if (!isLoading) {
      localStorage.setItem('learningTodos', JSON.stringify(todos));
    }
  }, [todos, isLoading]);

  const addNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTodo: TodoItem = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };

    setTodos(prev => [newTodo, ...prev]);
    setNewTaskText('');
    setIsAddingTask(false);
  };

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTask = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  const sortedTasks = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    todos,
    setTodos,
    isAddingTask,
    setIsAddingTask,
    newTaskText,
    setNewTaskText,
    newTaskInputRef,
    isLoading,
    addNewTask,
    toggleTodo,
    deleteTask,
    sortedTasks
  };
};

// Enhanced image handling function
const ImageWithFallback = ({ src, alt, className, aspectRatio = "aspect-video" }:
  { src: string; alt: string; className?: string; aspectRatio?: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    if (imageRef.current) {
      // Apply placeholder styling
      imageRef.current.src = "https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6";
      imageRef.current.classList.add("image-placeholder");
    }
  };

  // If image is already cached, we need to handle that case
  useEffect(() => {
    if (imageRef.current?.complete) {
      handleLoad();
    }
  }, []);

  return (
    <div className={`relative overflow-hidden ${aspectRatio} bg-muted ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center image-loading">
          <ImageIcon className="h-12 w-12 text-muted-foreground opacity-30" />
        </div>
      )}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'image-fade-in'} ${hasError ? 'image-placeholder' : ''}`}
      />
    </div>
  );
};

// Course card component that fetches course details
const CourseCard = ({ enrollment, index }: { enrollment: Record<string, unknown>; index: number }) => {
  const courseId = bufferToHex(enrollment.courseId);
  const { data: courseDetails, isLoading: isCourseLoading } = useCourseById(courseId);
  const { setCurrentCourse } = useCourseStore();
  const navigate = useNavigate();

  // Mock progress data - replace with actual progress from enrollment
  const progress = Math.floor(Math.random() * 100);
  const totalLessons = Math.floor(Math.random() * 30) + 10;

  const handleContinue = () => {
    // Extract both courseId and versionId from enrollment
    const versionId = bufferToHex(enrollment.courseVersionId) || "";

    console.log("Setting course store:", {
      courseId: courseId,
      versionId: versionId
    });

    // Pass both courseId and versionId to the store
    setCurrentCourse({
      courseId: courseId,
      versionId: versionId,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null
    });

    navigate({ to: "/student/learn" });
  };

  if (isCourseLoading) {
    return (
      <Card className="border border-border overflow-hidden flex flex-row student-card-hover p-0">
        <div className="w-24 h-auto sm:w-32 flex-shrink-0 flex items-center justify-center bg-muted animate-pulse">
          <div className="w-full h-full bg-muted rounded-l-lg"></div>
        </div>
        <CardContent className="p-3 pl-0 flex flex-col flex-1">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
            <div className="h-6 bg-muted rounded animate-pulse w-16"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-32"></div>
          </div>
          <div className="h-6 bg-muted rounded animate-pulse mb-2 w-3/4"></div>
          <div className="h-4 bg-muted rounded animate-pulse mb-3 w-1/2"></div>
          <div className="h-10 bg-muted rounded animate-pulse w-20"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border overflow-hidden flex flex-row student-card-hover p-0">
      <div className="w-24 h-auto sm:w-32 flex-shrink-0 flex items-center justify-center">
        <ImageWithFallback
          src="https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6"
          alt={courseDetails?.name || `Course ${index + 1}`}
          aspectRatio="aspect-square"
          className="rounded-l-lg w-full h-full"
        />
      </div>
      <CardContent className="p-3 pl-0 flex flex-col flex-1">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
          <div className="flex items-center">
            <Badge className="bg-secondary/70 text-secondary-foreground border-0 font-normal">
              Course
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            <div className="flex flex-col sm:flex-row sm:gap-8">
              <div className="flex items-center gap-2 mb-1 sm:mb-0">
                <span>Content</span>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {totalLessons} Lessons
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1 sm:mb-0">
                <span>Completion</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-secondary p-1">
                    <div className="h-full w-full rounded-full bg-primary relative">
                      <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary-foreground text-[8px]">
                        {progress}%
                      </span>
                    </div>
                  </div>
                  <span>{progress}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span>Enrolled</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">
                    {enrollment.enrollmentDate && typeof enrollment.enrollmentDate === 'string'
                      ? new Date(enrollment.enrollmentDate).toLocaleDateString()
                      : 'Recently'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <h3 className="font-medium text-lg mb-auto">
          {courseDetails?.name || `Course ${index + 1}`}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Next: Continue Learning
        </p>
        <div className="mt-auto">
          <Button
            variant={progress === 0 ? "default" : "outline"}
            className={progress === 0 ? "" : "border-accent hover:bg-accent/10"}
            onClick={handleContinue}
          >
            {progress === 0 ? 'Start' : 'Continue'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Page() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const studentName = user?.name || user?.firstName || 'Student';
  console.log(user);
  const userId = user?.userId;

  // Handle authentication redirect using useEffect
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      console.log("User not authenticated or no userId found, redirecting to auth page");
      navigate({ to: '/auth' });
    }
  }, [isAuthenticated, userId, navigate]);

  const token = localStorage.getItem('firebase-auth-token');
  console.log("Firebase Auth Token:", token);

  const [greeting, setGreeting] = useState(getGreeting());

  // Use todos hook
  const todoManager = useTodos();

  // Fetch user enrollments - only if authenticated and userId exists
  const { data: enrollmentsData, isLoading: enrollmentsLoading, error: enrollmentsError } = useUserEnrollments(userId,
    1, // page
    5  // limit - show only first 5 courses on dashboard
  );

  const enrollments = enrollmentsData?.enrollments || [];
  const totalEnrollments = enrollmentsData?.totalDocuments || 0;

  useEffect(() => {
    const intervalId = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // Calculate overall progress (mock calculation)
  const totalProgress = enrollments.length > 0
    ? Math.round(Math.random() * 100) // Replace with real progress calculation
    : 0;

  // Show authentication required message or loading state
  if (!isAuthenticated || !userId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <h3 className="text-lg font-medium mb-2">
              {!isAuthenticated ? "Authentication Required" : "Loading..."}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {!isAuthenticated
                ? "Please log in to view your dashboard"
                : "Preparing your dashboard..."}
            </p>
            {!isAuthenticated && (
              <Button onClick={() => navigate({ to: '/auth' })}>
                Go to Login
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Greeting and Stat Cards in a row */}
      <div className="flex flex-col md:flex-row items-stretch mb-8 px-4 md:px-28 lg:px-16 xl:px-0">
        <div className="flex-1 flex flex-col justify-center bg-background rounded-lg p-6 mb-0">
          <h1 className="text-3xl font-bold mb-1">{greeting}, {studentName} 👋</h1>
          <p className="text-muted-foreground">
            Welcome to your learning dashboard, check your priority learning.
          </p>
        </div>
        <div className="ml-0 md:ml-8 flex flex-row gap-4 items-center">
          <StatCard icon="🏆" value={`${totalEnrollments}`} label="Enrolled Courses" />
          <StatCard icon="⏱️" value="2.5h" label="Study Time" />
          <StatCard icon="🎓" value={`${totalProgress}%`} label="Overall Progress" />
        </div>
      </div>

      {/* Announcement Banner */}
      <div className="bg-accent/20 border border-accent/30 rounded-lg p-4 mb-2">
        <div className="flex items-start">
          <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded mr-3">
            New
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Achievement Unlocked!</h3>
            <p className="text-muted-foreground text-sm">
              Congratulations! You've earned the "Quick Learner" badge by completing 5 lessons in a single day.
            </p>
          </div>
          <Button variant="ghost" className="inline-flex items-center text-sm font-medium">
            View details <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content and sidebar */}
      <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
        <main className="flex-1">


          {/* In Progress Courses */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">
                  In progress learning content
                </h2>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="link"
                className="text-primary text-sm font-medium flex items-center"
                onClick={() => navigate({ to: '/student/courses' })}
              >
                View all
              </Button>
            </div>

            {enrollmentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border border-border overflow-hidden flex flex-row p-0">
                    <div className="w-24 h-auto sm:w-32 flex-shrink-0 bg-muted animate-pulse"></div>
                    <CardContent className="p-3 pl-0 flex flex-col flex-1">
                      <div className="h-6 bg-muted rounded animate-pulse mb-2 w-3/4"></div>
                      <div className="h-4 bg-muted rounded animate-pulse mb-3 w-1/2"></div>
                      <div className="h-10 bg-muted rounded animate-pulse w-20"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : enrollmentsError ? (
              <Card className="border border-destructive/20 bg-destructive/5">
                <CardContent className="p-4">
                  <p className="text-destructive">Failed to load enrolled courses. Please try again.</p>
                </CardContent>
              </Card>
            ) : enrollments.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="p-6 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No courses enrolled yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start your learning journey by enrolling in a course
                  </p>
                  <Button onClick={() => navigate({ to: '/student/courses' })}>Browse Courses</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {enrollments.map((enrollment, index) => (
                  <CourseCard key={bufferToHex(enrollment.courseId) || index} enrollment={enrollment} index={index} />
                ))}
                {totalEnrollments > 5 && (
                  <Card className="border border-border p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing 5 of {totalEnrollments} enrolled courses
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate({ to: '/student/courses' })}
                      >
                        View All Courses
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Recommended Courses */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Recommended for you</h2>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="link"
                className="text-primary text-sm font-medium flex items-center"
                onClick={() => navigate({ to: '/student/courses' })}
              >
                View all
              </Button>
            </div>

            <Card className="border border-border">
              <CardContent className="p-6 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Discover new courses</h3>
                <p className="text-muted-foreground mb-4">
                  Explore our course catalog to find your next learning adventure
                </p>
                <Button onClick={() => navigate({ to: '/student/courses' })}>Browse All Courses</Button>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-full md:w-80 space-y-6 bg-sidebar p-4 rounded-lg border border-sidebar-border">
          <Card className="border border-sidebar-border bg-secondary/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">To-Do List</CardTitle>
              <CardDescription>
                {todoManager.todos.filter(t => !t.completed).length} tasks remaining
              </CardDescription>
            </CardHeader>

            <CardContent>
              {todoManager.isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {todoManager.sortedTasks.map(todo => (
                    <div key={todo.id}
                      className={`flex items-start gap-2 group ${todo.completed ? 'opacity-60' : ''}`}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-full p-0 mt-0.5"
                        onClick={() => todoManager.toggleTodo(todo.id)}
                      >
                        {todo.completed ?
                          <CheckCircle2 className="h-5 w-5 text-primary" /> :
                          <Circle className="h-5 w-5" />}
                      </Button>
                      <span className={`flex-1 text-sm ${todo.completed ? 'line-through' : ''}`}>{todo.text}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => todoManager.deleteTask(todo.id)}
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Delete task</span>
                      </Button>
                    </div>
                  ))}

                  {todoManager.isAddingTask ? (
                    <form onSubmit={todoManager.addNewTask} className="flex items-center gap-2 pt-1">
                      <Circle className="h-5 w-5 ml-0.5 text-muted-foreground" />
                      <Input
                        ref={todoManager.newTaskInputRef}
                        type="text"
                        value={todoManager.newTaskText}
                        onChange={(e) => todoManager.setNewTaskText(e.target.value)}
                        placeholder="What needs to be done?"
                        className="h-7 py-1 text-sm border-0 border-b focus-visible:ring-0 rounded-none px-0"
                        autoFocus
                        onBlur={() => {
                          if (!todoManager.newTaskText.trim()) todoManager.setIsAddingTask(false);
                        }}
                      />
                    </form>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-muted-foreground hover:text-foreground"
                      onClick={() => todoManager.setIsAddingTask(true)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add new task
                    </Button>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter>
              {todoManager.todos.length > 0 && (
                <div className="w-full flex justify-between text-xs text-muted-foreground">
                  <span>{todoManager.todos.filter(t => !t.completed).length} remaining</span>
                  {todoManager.todos.some(t => t.completed) && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => todoManager.setTodos(todoManager.todos.filter(t => !t.completed))}
                    >
                      Clear completed
                    </Button>
                  )}
                </div>
              )}
            </CardFooter>
          </Card>

          <Card className="border border-sidebar-border bg-secondary/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sidebar-foreground">Goals</h3>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-muted-foreground">
                    Daily Goal: 2.5/4 hours
                  </div>
                </div>
                <div className="w-full bg-accent/20 rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full progress-bar-animated"
                    style={{ width: '60%' }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  Your Longest streak: 7 Days
                </div>
                <div className="text-xs text-muted-foreground">(Jan 01, 2024 - Jan 07, 2024)</div>
                <Button variant="link" className="mt-3 text-primary text-sm font-medium p-0">
                  See Detail
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-sidebar-border bg-secondary/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Upcoming Deadlines</h3>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {enrollments.length > 0 ? (
                  enrollments.slice(0, 3).map((enrollment, index) => {
                    // Calculate mock deadline (replace with real deadline data when available)
                    const daysRemaining = Math.floor(Math.random() * 30) + 1;
                    const isUrgent = daysRemaining <= 7;

                    return (
                      <div
                        key={bufferToHex(enrollment.courseId) || index}
                        className={`flex items-center space-x-3 p-3 rounded-lg border transition-all hover:shadow-sm student-card-hover ${isUrgent ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 bg-secondary/10'
                          }`}
                      >
                        <div className={`flex-shrink-0 p-1.5 rounded-full ${isUrgent
                          ? 'bg-destructive/20 text-destructive'
                          : 'bg-primary/10 text-primary'
                          }`}>
                          <FileText className="h-3 w-3" />
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <p className="text-sm font-medium">Course Assignment</p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Course Material</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant={isUrgent ? "destructive" : "outline"} className="text-xs py-0 h-5">
                              Assignment
                            </Badge>
                            <span className={`text-xs ${isUrgent ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              {daysRemaining} days left
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4">
                    <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>


        </aside>
      </div>
    </>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <Card className="border border-border flex flex-row items-center p-4 gap-4 py-0 student-card-hover bg-secondary/50 w-[180px] h-[100px] min-w-[180px] max-w-[180px] min-h-[100px] max-h-[100px]">
      <div className=" text-2xl flex items-center justify-center">{icon}</div>
      <div className="flex flex-col">
        <div className="text-xl font-bold">{value}</div>
        <div className="text-muted-foreground text-sm">{label}</div>
      </div>
    </Card>
  );
}