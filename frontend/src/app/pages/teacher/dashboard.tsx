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
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Note: You need to create these UI components or install a package that provides them
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  SectorProps
} from 'recharts';

// Helper function to get greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// Sample data for charts
const courseEngagementData = [
  { name: "Web Development", value: 78 },
  { name: "Data Science", value: 65 },
  { name: "UX Design", value: 42 },
  { name: "Mobile Development", value: 30 },
];

const contentDistributionData = [
  { name: "Articles", value: 18, color: "hsl(var(--primary))" },
  { name: "Quizzes", value: 14, color: "hsl(var(--chart-2))" },
  { name: "Assignments", value: 10, color: "hsl(var(--chart-3))" },
  { name: "Videos", value: 8, color: "hsl(var(--chart-4))" },
];

const weeklyActivityData = [
  { name: "Mon", students: 40 },
  { name: "Tue", students: 25 },
  { name: "Wed", students: 65 },
  { name: "Thu", students: 45 },
  { name: "Fri", students: 85 },
  { name: "Sat", students: 30 },
  { name: "Sun", students: 50 },
];

const topStudents = [
  { id: 1, name: "Emma Wilson", avatar: "/avatars/emma.jpg", progress: 98, course: "Web Development" },
  { id: 2, name: "James Rodriguez", avatar: "/avatars/james.jpg", progress: 92, course: "Data Science" },
  { id: 3, name: "Sarah Chen", avatar: "/avatars/sarah.jpg", progress: 87, course: "UX Design" },
];

// Sample initial to-do items
const initialTodoItems = [
  { id: 1, text: "Grade Web Development assignments", completed: false },
  { id: 2, text: "Prepare lecture notes for tomorrow", completed: true },
  { id: 3, text: "Review student project proposals", completed: false },
  { id: 4, text: "Schedule 1:1 with teaching assistants", completed: false },
  { id: 5, text: "Update course materials for next week", completed: false },
];

// Define the Task type for better type safety
type Task = {
  id: number;
  text: string;
  completed: boolean;
};

// Define prop types for active shape rendering
interface ActiveShapeProps extends SectorProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: {
    name: string;
    value: number;
  };
  percent: number;
  value: number;
}

// Custom type for chart label
interface ChartLabelProps {
  name: string;
  percent: number;
}

export default function Page() {
  const [name] = useState("John Doe");
  const [greeting, setGreeting] = useState(getGreeting());
  const [todos, setTodos] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col space-y-6">
        {/* Greeting Section */}
        <section className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{greeting}, {name}!</h1>
          <p className="text-muted-foreground">Here's what's happening with your courses today.</p>
        </section>

        {/* Quick Actions */}
        <section className="bg-muted/30 p-4 rounded-lg">
          <div className="flex flex-wrap justify-between items-center mb-3">
            <h2 className="text-lg font-medium">Quick Actions</h2>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              More Actions
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="flex flex-col h-24 px-4 py-3 justify-center items-center gap-2 hover:bg-primary/5 hover:border-primary">
              <BookOpen className="h-5 w-5" />
              <span>Add Course</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-24 px-4 py-3 justify-center items-center gap-2 hover:bg-primary/5 hover:border-primary">
              <FileText className="h-5 w-5" />
              <span>Create Article</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-24 px-4 py-3 justify-center items-center gap-2 hover:bg-primary/5 hover:border-primary">
              <ClipboardCheck className="h-5 w-5" />
              <span>New Assignment</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-24 px-4 py-3 justify-center items-center gap-2 hover:bg-primary/5 hover:border-primary">
              <FileQuestion className="h-5 w-5" />
              <span>Create Quiz</span>
            </Button>
          </div>
        </section>

        {/* Dashboard Widgets */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Course Engagement */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Course Engagement</CardTitle>
                  <CardDescription>Top performing courses by student engagement</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={courseEngagementData}
                      layout="vertical"
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
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
                  <Button variant="ghost" size="sm" className="w-full">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View detailed analytics
                  </Button>
                </CardFooter>
              </Card>

              {/* Learning Content */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Learning Content</CardTitle>
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
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">To-Do List</CardTitle>
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
                            className="h-5 w-5 rounded-full p-0 mt-0.5"
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
                            className="h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
                            className="h-7 py-1 text-sm border-0 border-b focus-visible:ring-0 rounded-none px-0"
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
                          className="w-full mt-2 text-muted-foreground hover:text-foreground"
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
                          className="h-auto p-0 text-xs"
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
              <Card className="md:col-span-2 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
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
                  <Button variant="ghost" size="sm" className="w-full">
                    <LineChartIcon className="mr-2 h-4 w-4" />
                    View detailed activity
                  </Button>
                </CardFooter>
              </Card>
              
              {/* Top Students Card */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
                  <CardDescription>Your highest achieving students</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topStudents.map((student, i) => (
                      <div key={student.id} className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {i === 0 ? (
                            <div className="relative">
                              <Avatar className="h-10 w-10 border-2 border-primary ring-2 ring-primary/20">
                                <AvatarImage src={student.avatar} alt={student.name} />
                                <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <Trophy className="absolute -top-2 -right-2 h-4 w-4 text-yellow-500 drop-shadow-md" />
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
                  <Button variant="ghost" size="sm" className="w-full">View all students</Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>View detailed analytics for all your courses and students.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Detailed analytics would be displayed here</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <Card>
              <CardHeader>
                <CardTitle>Student Overview</CardTitle>
                <CardDescription>View and manage all enrolled students.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">Student management interface would be displayed here </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
