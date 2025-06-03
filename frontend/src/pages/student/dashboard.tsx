import { useState, useEffect, useRef } from "react";
import {
  Clock,
  Trophy,
  TrendingUp,
  Target,
  CheckCircle2,
  FileText,
  PenTool,
  ListChecks,
  Info,
  ArrowRight,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store/auth-store";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// Sample data for the student dashboard
const enrolledCourses = [
  {
    id: 1,
    title: "Introduction to React",
    instructor: "Prof. Johnson",
    progress: 75,
    totalLessons: 24,
    completedLessons: 18,
    nextLesson: "State Management with Hooks",
    dueDate: "2024-01-20",
    image: "https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6",
    type: "Course",
  },
  {
    id: 2,
    title: "JavaScript Fundamentals",
    instructor: "Dr. Smith",
    progress: 45,
    totalLessons: 30,
    completedLessons: 14,
    nextLesson: "Async/Await Patterns",
    dueDate: "2024-01-22",
    image: "/course-2.jpg",
    type: "Course",
  },
  {
    id: 3,
    title: "Web Design Principles",
    instructor: "Ms. Garcia",
    progress: 90,
    totalLessons: 20,
    completedLessons: 18,
    nextLesson: "Final Project Review",
    dueDate: "2024-01-18",
    image: "/course-3.jpg",
    type: "Course",
  },
];

const upcomingDeadlines = [
  {
    course: "Introduction to React",
    assignment: "Component Architecture Quiz",
    dueDate: "2025-05-27",
    type: "Quiz",
  },
  {
    course: "JavaScript Fundamentals",
    assignment: "Async Programming Project",
    dueDate: "2026-01-22",
    type: "Project",
  },
  {
    course: "Web Design Principles",
    assignment: "Portfolio Presentation",
    dueDate: "2026-01-25",
    type: "Presentation",
  },
];

const achievements = [
  {
    title: "First Course Completed",
    description: "Completed your first course with excellent performance",
    icon: Trophy,
    earned: true,
  },
  {
    title: "Quick Learner",
    description: "Completed 5 lessons in a single day",
    icon: TrendingUp,
    earned: true,
  },
  {
    title: "Goal Setter",
    description: "Set and achieved your first learning goal",
    icon: Target,
    earned: false,
  },
];

const recommendedCourses = [
  {
    id: 4,
    title: "Advanced React Patterns",
    image: "https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6",
    materials: 12,
    tags: ["Frontend", "Advanced"],
    status: "Not Started",
    type: "Course",
  },
  {
    id: 5,
    title: "TypeScript for JavaScript Developers",
    image: "https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6",
    materials: 8,
    tags: ["TypeScript", "Beginner"],
    status: "Not Started",
    type: "Course",
  },
  {
    id: 6,
    title: "Full Stack Development with Node.js",
    image: "https://us.123rf.com/450wm/warat42/warat422108/warat42210800253/173451733-charts-graph-with-analysis-business-financial-data-white-clipboard-checklist-smartphone-wallet.jpg?ver=6",
    materials: 15,
    tags: ["Backend", "Intermediate"],
    status: "Not Started",
    type: "Course",
  },
];

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

export default function Page() {
  const { user, } = useAuthStore();
  const studentName = user?.name;
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  const totalProgress = Math.round(
    enrolledCourses.reduce((sum, course) => sum + course.progress, 0) / enrolledCourses.length
  );

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
          <StatCard icon="🏆" value="7 days" label="Study Streak" />
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
              <Button variant="link" className="text-primary text-sm font-medium flex items-center">
                View all
              </Button>
            </div>

            <div className="space-y-2">
              {enrolledCourses.map((course) => (
                <Card
                  key={course.id}
                  className="border border-border overflow-hidden flex flex-row student-card-hover p-0"
                >
                  <div className="w-24 h-auto sm:w-32 flex-shrink-0 flex items-center justify-center">
                    <ImageWithFallback
                      src={course.image}
                      alt={course.title}
                      aspectRatio="aspect-square"
                      className="rounded-l-lg w-full h-full"
                    />
                  </div>
                  <CardContent className="p-3 pl-0 flex flex-col flex-1">
                    <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center">
                        <Badge className="bg-secondary/70 text-secondary-foreground border-0 font-normal">
                          {course.type}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div className="flex flex-col sm:flex-row sm:gap-8">
                          <div className="flex items-center gap-2 mb-1 sm:mb-0">
                            <span>Content</span>
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              {course.totalLessons} Lessons
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-1 sm:mb-0">
                            <span>Completion</span>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-secondary p-1">
                                <div className="h-full w-full rounded-full bg-primary relative">
                                  <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary-foreground text-[8px]">
                                    {course.progress}%
                                  </span>
                                </div>
                              </div>
                              <span>{course.progress}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>Deadline</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-destructive" />
                              <span className="text-destructive">{course.dueDate}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <h3 className="font-medium text-lg mb-auto">{course.title}</h3>
                    <p className="text-xs text-muted-foreground mb-3">Next: {course.nextLesson}</p>
                    <div className="mt-auto">
                      <Button 
                        variant={course.progress === 0 ? "default" : "outline"}
                        className={course.progress === 0 ? "" : "border-accent hover:bg-accent/10"}
                      >
                        {course.progress === 0 ? 'Start' : 'Continue'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
              <Button variant="link" className="text-primary text-sm font-medium flex items-center">
                View all
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendedCourses.map((course) => (
                <Card key={course.id} className="overflow-hidden flex flex-col student-card-hover">
                  <div className="h-48 relative">
                    <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs py-1 px-2 rounded z-10">
                      {course.materials} lessons
                    </div>
                    <ImageWithFallback 
                      src={course.image} 
                      alt={course.title}
                    />
                  </div>
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center mb-2">
                      <Badge className="bg-secondary/70 text-secondary-foreground border-0 font-normal">
                        {course.type}
                      </Badge>
                    </div>
                    <h3 className="font-medium mb-3">{course.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      {course.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-accent/10 border border-accent/20 text-accent-foreground text-xs px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">{course.status}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-full md:w-80 space-y-6 bg-sidebar p-4 rounded-lg border border-sidebar-border">

          
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
                {upcomingDeadlines.map((deadline, index) => {
                  // Get the appropriate icon based on deadline type
                  const DeadlineIcon = deadline.type === "Quiz" 
                    ? ListChecks 
                    : deadline.type === "Project" 
                    ? FileText 
                    : PenTool;
                  
                  // Calculate days remaining (simplified for demo)
                  const daysRemaining = Math.ceil((new Date(deadline.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  const isUrgent = daysRemaining <= 2;
                  
                  return (
                    <div 
                      key={index} 
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-all hover:shadow-sm student-card-hover ${
                        isUrgent ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 bg-secondary/10'
                      }`}
                    >
                      <div className={`flex-shrink-0 p-1.5 rounded-full ${
                        isUrgent 
                          ? 'bg-destructive/20 text-destructive' 
                          : 'bg-primary/10 text-primary'
                      }`}>
                        <DeadlineIcon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <p className="text-sm font-medium">{deadline.assignment}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{deadline.course}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant={isUrgent ? "destructive" : "outline"} className="text-xs py-0 h-5">
                            {deadline.type}
                          </Badge>
                          <span className={`text-xs ${isUrgent ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {deadline.dueDate.split('-')[2]} days left
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-sidebar-border bg-secondary/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Achievements</h3>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {achievements.map((achievement, index) => (
                  <div
                    key={index}
                    className={`flex items-center p-2 rounded-md student-card-hover ${
                      achievement.earned ? 'bg-primary/10' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <div className={`flex-shrink-0 p-1.5 rounded-full mr-2 ${
                      achievement.earned ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      <achievement.icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-sm font-medium ${achievement.earned ? '' : 'text-muted-foreground'}`}>
                        {achievement.title}
                      </h3>
                    </div>
                    {achievement.earned && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
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