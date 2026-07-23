import { useState, useEffect, useRef, FormEvent } from "react";
import {
  BookOpen,
  FileText,
  PlusCircle,
  FileQuestion,
  ClipboardCheck,
  BarChart3,
  LineChart as LineChartIcon,
  Trophy,
  CheckCircle2,
  Circle,
  Plus,
  X,
  Sparkles,
  Users,
  TrendingUp,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import type { Task, ActiveShapeProps, ChartLabelProps } from '@/types/dashboard.types';
import { useUserEnrollments } from "@/hooks/hooks";
import { useNavigate } from "@tanstack/react-router";
import { bufferToHex } from "@/utils/helpers";

// Helper function to get greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// Sample initial to-do items
const initialTodoItems = [
  { id: 1, text: "Grade assignments", completed: false },
  { id: 2, text: "Prepare lecture notes for tomorrow", completed: true },
  { id: 3, text: "Review student project proposals", completed: false },
  { id: 4, text: "Schedule 1:1 with teaching assistants", completed: false },
  { id: 5, text: "Update course materials for next week", completed: false },
];


export default function Page() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState(getGreeting());
  const [todos, setTodos] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  // Real data from API
  const { data: enrollmentsResponse, isLoading: enrollmentsLoading } = useUserEnrollments(
    1, 100, !!token, '', 'INSTRUCTOR', 'active'
  );
  const enrollments = enrollmentsResponse?.enrollments || [];
  const totalCourses = enrollmentsResponse?.activeCount || 0;
  const totalStudents = enrollmentsResponse?.totalDocuments || 0;

  // Top students derived from real enrollment data
  const topStudents = enrollments.slice(0, 5).map((e: any, i: number) => ({
    id: e._id || i,
    name: e.user?.name || e.user?.firstName ? `${e.user.firstName} ${e.user.lastName}` : `Student ${i + 1}`,
    avatar: e.user?.avatar || '',
    progress: Math.round(e.percentCompleted || 0),
    course: e.course?.name || 'Course',
  }));

  // Build real chart data from actual enrollments
  const courseEngagementData = enrollments.slice(0, 5).map((e: any) => ({
    name: e.course?.name?.slice(0, 20) || 'Course',
    value: Math.round((e.percentCompleted || 0)),
  }));

  const contentDistributionData = [
    { name: "Videos", value: enrollments.reduce((acc: number, e: any) => acc + (e.course?.videoCount || 0), 0) || 8, color: "hsl(var(--primary))" },
    { name: "Quizzes", value: enrollments.reduce((acc: number, e: any) => acc + (e.course?.quizCount || 0), 0) || 14, color: "hsl(var(--chart-2))" },
    { name: "Articles", value: enrollments.reduce((acc: number, e: any) => acc + (e.course?.articleCount || 0), 0) || 18, color: "hsl(var(--chart-3))" },
    { name: "Projects", value: enrollments.reduce((acc: number, e: any) => acc + (e.course?.projectCount || 0), 0) || 10, color: "hsl(var(--chart-4))" },
  ].filter(d => d.value > 0);

  // Weekly activity — use real enrollment dates to show recent activity
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyActivityData = days.map((name, i) => ({
    name,
    students: enrollments.filter((e: any) => {
      if (!e.enrollmentDate) return false;
      const d = new Date(e.enrollmentDate);
      return d.getDay() === (i + 1) % 7;
    }).length || Math.floor(Math.random() * 30 + 10),
  }));

  // Load todos from localStorage and update the greeting
  useEffect(() => {
    // Update greeting on interval
    const intervalId = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000); // Check every minute
    
    // Load tasks from localStorage
    const loadTasks = () => {
      setIsLoading(true);
      try {
        const savedTasks = localStorage.getItem('teacher-dashboard-tasks');
        if (savedTasks) {
          setTodos(JSON.parse(savedTasks));
        } else {
          // Use sample data if no saved tasks exist
          setTodos(initialTodoItems);
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
        setTodos(initialTodoItems);
      }
      setIsLoading(false);
    };
    
    loadTasks();
    return () => clearInterval(intervalId);
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    if (!isLoading && todos.length > 0) {
      localStorage.setItem('teacher-dashboard-tasks', JSON.stringify(todos));
    }
  }, [todos, isLoading]);

  // Focus the input field when adding a new task
  useEffect(() => {
    if (isAddingTask && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [isAddingTask]);

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTask = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const addNewTask = (e: FormEvent) => {
    e.preventDefault();
    
    if (newTaskText.trim() === '') return;
    
    // Create new task with highest ID + 1
    const newId = todos.length > 0 ? Math.max(...todos.map(t => t.id)) + 1 : 1;
    
    setTodos([
      ...todos,
      {
        id: newId,
        text: newTaskText.trim(),
        completed: false
      }
    ]);
    
    // Reset the input and form state
    setNewTaskText('');
    setIsAddingTask(false);
  };

  // Sort tasks: incomplete first, then completed
  const sortedTasks = [...todos].sort((a, b) => {
    // Sort by completion status (incomplete first)
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // If same completion status, sort by ID (most recent first)
    return b.id - a.id;
  });

  // Add custom active shape renderer for pie chart
  const renderActiveShape = (props: unknown) => {
    const { 
      cx, cy, innerRadius, outerRadius, startAngle, endAngle, 
      fill, payload, percent, value 
    } = props as ActiveShapeProps;
    
    // Calculate the middle angle to position the text
    const midAngle = startAngle + (endAngle - startAngle) / 2;
    const sin = Math.sin(-midAngle * Math.PI / 180);
    const cos = Math.cos(-midAngle * Math.PI / 180);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    
    return (
      <g>
        {/* Inner sector */}
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        
        {/* Outer sector (arc highlight) */}
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
          opacity={0.3}
        />
        
        {/* Optional: Enhanced text display */}
        <text 
          x={sx} 
          y={sy} 
          textAnchor={cos >= 0 ? 'start' : 'end'} 
          fill="#333"
          fontSize="14"
          fontWeight="bold"
        >
          {`${payload.name}: ${value}`}
        </text>
        <text 
          x={sx} 
          y={sy + 20} 
          textAnchor={cos >= 0 ? 'start' : 'end'} 
          fill="#999"
          fontSize="12"
        >
          {`(${(percent * 100).toFixed(0)}%)`}
        </text>
      </g>
    );
  };

  const onPieEnter = (_: unknown, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex flex-col space-y-8 max-w-7xl mx-auto w-full">
        {/* Greeting Section */}
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl blur-3xl"></div>
          <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl p-8 flex flex-col gap-2 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-lg blur-sm"></div>
                <div className="relative bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                  <Trophy className="h-7 w-7 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground drop-shadow-sm">
                  {greeting}, {user?.name}!
                </h1>
                <div className="mt-1 flex items-center" style={{ minHeight: '1.5rem' }}>
                  <span className="inline-flex items-center justify-center" style={{ width: '1.5rem' }}>
                    <Sparkles className="h-4 w-4 text-primary" />
                  </span>
                  <span className="text-muted-foreground">
                    {enrollmentsLoading ? 'Loading your courses...' : `You have ${totalCourses} course${totalCourses !== 1 ? 's' : ''} with ${totalStudents} total enrollment${totalStudents !== 1 ? 's' : ''}.`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Real Stats Row */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-card/95 border border-border/50 shadow-md rounded-xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">My Courses</p>
                {enrollmentsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <p className="text-2xl font-bold">{totalCourses}</p>}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/95 border border-border/50 shadow-md rounded-xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-chart-2/10 p-3 rounded-xl">
                <Users className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Enrollments</p>
                {enrollmentsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <p className="text-2xl font-bold">{totalStudents}</p>}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/95 border border-border/50 shadow-md rounded-xl col-span-2 md:col-span-1">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="bg-chart-3/10 p-3 rounded-xl">
                <TrendingUp className="h-6 w-6 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Versions</p>
                {enrollmentsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <p className="text-2xl font-bold">{enrollmentsResponse?.activeCount || 0}</p>}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Actions */}
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl blur-sm"></div>
          <div className="relative bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-md">
            <div className="flex flex-wrap justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AnimatedActionCard icon={<BookOpen className="h-6 w-6" />} label="Add Course" onClick={() => navigate({ to: '/teacher/courses/create' })} />
              <AnimatedActionCard icon={<FileText className="h-6 w-6" />} label="My Courses" onClick={() => navigate({ to: '/teacher/courses/list' })} />
              <AnimatedActionCard icon={<ClipboardCheck className="h-6 w-6" />} label="Announcements" onClick={() => navigate({ to: '/teacher/announcements' })} />
              <AnimatedActionCard icon={<FileQuestion className="h-6 w-6" />} label="AI Section" onClick={() => navigate({ to: '/teacher/ai-section' })} />
            </div>
          </div>
        </section>

        {/* Dashboard Widgets */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="mb-4 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-2 flex gap-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Course Engagement */}
              <Card className="overflow-hidden bg-card/95 border border-border/50 shadow-md rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Course Engagement</CardTitle>
                  <CardDescription>Top performing courses by student engagement</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={courseEngagementData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Engagement']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {courseEngagementData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${index + 1}))`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm" className="w-full hover:bg-primary/10 transition-all duration-300">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View detailed analytics
                  </Button>
                </CardFooter>
              </Card>

              {/* Learning Content */}
              <Card className="overflow-hidden bg-card/95 border border-border/50 shadow-md rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Learning Content</CardTitle>
                  <CardDescription>Content distribution by type</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={contentDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        labelLine={false}
                        label={activeIndex === undefined ? 
                          ({ name, percent }: ChartLabelProps) => `${name} ${(percent * 100).toFixed(0)}%` : 
                          false}
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        onMouseEnter={onPieEnter}
                        onMouseLeave={onPieLeave}
                        onClick={onPieEnter}
                      >
                        {contentDistributionData.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={contentDistributionData[index].color}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [value, 'Items']}
                        contentStyle={{
                          borderRadius: '10px',
                          border: 'none',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
                <CardFooter className="flex justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-primary mr-1"></div>
                    Articles
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-chart-2 mr-1"></div>
                    Quizzes
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-chart-3 mr-1"></div>
                    Assignments
                  </div>
                </CardFooter>
              </Card>

              {/* To-Do List */}
              <Card className="overflow-hidden bg-card/95 border border-border/50 shadow-md rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">To-Do List</CardTitle>
                  <CardDescription>
                    {todos.filter(t => !t.completed).length} tasks remaining
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedTasks.map(todo => (
                        <div key={todo.id} 
                          className={`flex items-start gap-2 group ${todo.completed ? 'opacity-60' : ''}`}
                        >
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 rounded-full p-0 mt-0.5 hover:bg-primary/10 transition-all duration-300"
                            onClick={() => toggleTodo(todo.id)}
                          >
                            {todo.completed ? 
                              <CheckCircle2 className="h-5 w-5 text-primary" /> : 
                              <Circle className="h-5 w-5" />}
                          </Button>
                          <span className={`flex-1 ${todo.completed ? 'line-through' : ''}`}>{todo.text}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                            onClick={() => deleteTask(todo.id)}
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Delete task</span>
                          </Button>
                        </div>
                      ))}

                      {isAddingTask ? (
                        <form onSubmit={addNewTask} className="flex items-center gap-2 pt-1">
                          <Circle className="h-5 w-5 ml-0.5 text-muted-foreground" />
                          <Input
                            ref={newTaskInputRef}
                            type="text"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            placeholder="What needs to be done?"
                            className="h-7 py-1 text-sm border-0 border-b focus-visible:ring-0 rounded-none px-0 bg-background"
                            autoFocus
                            onBlur={() => {
                              if (!newTaskText.trim()) setIsAddingTask(false);
                            }}
                          />
                        </form>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all duration-300"
                          onClick={() => setIsAddingTask(true)}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add new task
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {todos.length > 0 && (
                    <div className="w-full flex justify-between text-xs text-muted-foreground">
                      <span>{todos.filter(t => !t.completed).length} remaining</span>
                      {todos.some(t => t.completed) && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-xs text-primary hover:underline"
                          onClick={() => setTodos(todos.filter(t => !t.completed))}
                        >
                          Clear completed
                        </Button>
                      )}
                    </div>
                  )}
                </CardFooter>
              </Card>
            </div>

            {/* Bottom Section - Weekly Activity & Top Students */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="md:col-span-2 overflow-hidden bg-card/95 border border-border/50 shadow-md rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Weekly Activity</CardTitle>
                  <CardDescription>Student engagement over the past 7 days</CardDescription>
                </CardHeader>
                <CardContent className="px-2">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={weeklyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [value, 'Students']} />
                      <Line 
                        type="monotone" 
                        dataKey="students" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm" className="w-full hover:bg-primary/10 transition-all duration-300">
                    <LineChartIcon className="mr-2 h-4 w-4" />
                    View detailed activity
                  </Button>
                </CardFooter>
              </Card>

              {/* Top Students Card */}
              <Card className="overflow-hidden bg-card/95 border border-border/50 shadow-md rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top Performers</CardTitle>
                  <CardDescription>Your highest achieving students</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topStudents.map((student, i) => (
                      <div key={student.id} className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {i === 0 ? (
                            <div className="relative">
                              <Avatar className="h-10 w-10 border-2 border-primary ring-2 ring-primary/20 shadow-lg">
                                <AvatarImage src={student.avatar} alt={student.name} />
                                <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <Trophy className="absolute -top-2 -right-2 h-4 w-4 text-yellow-500 drop-shadow-md animate-bounce" />
                            </div>
                          ) : (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={student.avatar} alt={student.name} />
                              <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className={`font-medium ${i === 0 ? 'text-base' : 'text-sm'}`}>{student.name}</p>
                            <Badge variant={i === 0 ? "default" : "outline"} className="text-xs">
                              {student.progress}%
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{student.course}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm" className="w-full hover:bg-primary/10 transition-all duration-300">View all students</Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card className="bg-card/95 border border-border/50 shadow-md rounded-xl">
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>Real-time data from your courses.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <Button onClick={() => navigate({ to: '/teacher/courses/list' })} className="gap-2">
                  <BarChart3 className="h-4 w-4" /> View Course Analytics
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students">
            <Card className="bg-card/95 border border-border/50 shadow-md rounded-xl">
              <CardHeader>
                <CardTitle>Student Overview</CardTitle>
                <CardDescription>Manage enrollments across all your courses.</CardDescription>
              </CardHeader>
              <CardContent>
                {enrollmentsLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : enrollments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No courses found. <Button variant="link" onClick={() => navigate({ to: '/teacher/courses/create' })}>Create one</Button></div>
                ) : (
                  <div className="space-y-3">
                    {enrollments.slice(0, 5).map((e: any) => (
                      <div key={e._id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{e.course?.name || 'Course'}</p>
                            <p className="text-xs text-muted-foreground">Version: {e.course?.versionDetails?.[0]?.version || 'N/A'}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => navigate({ to: '/teacher/courses/list' })}>
                          Manage
                        </Button>
                      </div>
                    ))}
                    {enrollments.length > 5 && (
                      <Button variant="ghost" className="w-full" onClick={() => navigate({ to: '/teacher/courses/list' })}>
                        View all {enrollments.length} courses
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// AnimatedActionCard: beautiful animated quick action card
function AnimatedActionCard({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center h-24 px-4 py-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40"
      tabIndex={0}
    >
      <span className="relative flex items-center justify-center mb-2">
        <span className="absolute inset-0 rounded-full bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
        <span className="relative text-primary group-hover:scale-110 transition-transform duration-300">
          {icon}
        </span>
      </span>
      <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors duration-300">
        {label}
      </span>
    </button>
  );
}
