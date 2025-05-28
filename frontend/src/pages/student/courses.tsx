import { useState } from "react";
import { BookOpen, Clock, Users, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const enrolledCourses = [
  {
    id: 1,
    title: "Introduction to React",
    instructor: "Prof. Johnson",
    progress: 75,
    totalLessons: 24,
    completedLessons: 18,
    estimatedTime: "4 weeks",
    rating: 4.8,
    students: 1250,
  },
  {
    id: 2,
    title: "JavaScript Fundamentals",
    instructor: "Dr. Smith",
    progress: 45,
    totalLessons: 30,
    completedLessons: 14,
    estimatedTime: "6 weeks",
    rating: 4.6,
    students: 890,
  },
];

const availableCourses = [
  {
    id: 3,
    title: "Advanced TypeScript",
    instructor: "Ms. Brown",
    estimatedTime: "5 weeks",
    rating: 4.9,
    students: 650,
    difficulty: "Advanced",
  },
  {
    id: 4,
    title: "Node.js Backend Development",
    instructor: "Mr. Wilson",
    estimatedTime: "8 weeks",
    rating: 4.7,
    students: 1100,
    difficulty: "Intermediate",
  },
];

export default function StudentCourses() {
  const [activeTab, setActiveTab] = useState("enrolled");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col space-y-6">
        <section className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground">Manage your learning journey</p>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="enrolled">Enrolled ({enrolledCourses.length})</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="enrolled" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {enrolledCourses.map((course) => (
                <Card key={course.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{course.title}</CardTitle>
                        <CardDescription>by {course.instructor}</CardDescription>
                      </div>
                      <Badge variant="outline">{course.progress}% complete</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress value={course.progress} />
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{course.completedLessons}/{course.totalLessons} lessons</span>
                      <span>{course.estimatedTime} remaining</span>
                    </div>

                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{course.rating}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{course.students} students</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{course.estimatedTime}</span>
                      </div>
                    </div>

                    <Button className="w-full">Continue Learning</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {availableCourses.map((course) => (
                <Card key={course.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{course.title}</CardTitle>
                        <CardDescription>by {course.instructor}</CardDescription>
                      </div>
                      <Badge variant={course.difficulty === 'Advanced' ? 'destructive' : 'secondary'}>
                        {course.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{course.rating}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{course.students} students</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{course.estimatedTime}</span>
                      </div>
                    </div>

                    <Button className="w-full">Enroll Now</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No completed courses yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Complete your first course to see it here
                </p>
                <Button variant="outline">Browse Available Courses</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
