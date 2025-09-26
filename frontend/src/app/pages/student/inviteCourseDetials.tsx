import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Clock, User, BarChart, DollarSign } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { EmptyState } from "@/components/ui/EmptyState";

const staticCourse = {
  name: "Advanced React Development",
  description: "Master advanced React concepts including hooks, state management, performance optimization, and modern JavaScript patterns to build scalable applications.",
  modules: 8,
  duration: "6 weeks",
  instructor: "John Doe",
  level: "Intermediate",
  price: "$199",
};

export default function CourseDetails() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();

  // Authentication check
  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <EmptyState
          title="Authentication Required"
          description="Please log in to view course details and start your learning journey."
          actionText="Go to Login"
          onAction={() => window.location.href = '/auth'}
          variant="warning"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-6 pt-0 max-w-7xl mx-auto">
      <section className="flex flex-col space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">
          {staticCourse.name}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Embark on a transformative learning experience with this comprehensive course.
        </p>
      </section>

      <Card className="relative bg-gradient-to-br from-background to-primary/5 shadow-lg border-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg blur-md"></div>
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-bold">Course Overview</CardTitle>
        </CardHeader>
        <CardContent className="relative space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <BookOpen className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold text-lg">Description</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {staticCourse.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Modules</h3>
                  <p className="text-muted-foreground">{staticCourse.modules} Modules</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Duration</h3>
                  <p className="text-muted-foreground">{staticCourse.duration}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Instructor</h3>
                  <p className="text-muted-foreground">{staticCourse.instructor}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <BarChart className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Level</h3>
                  <p className="text-muted-foreground">{staticCourse.level}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Price</h3>
                  <p className="text-muted-foreground">{staticCourse.price}</p>
                </div>
              </div>
            </div>
          </div>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="primary" 
                className="bg-primary hover:bg-primary/90 transition-all duration-300 text-white px-6 py-3 rounded-lg shadow-md"
              >
                Register Now
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-background rounded-lg shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Course Registration</DialogTitle>
                <p className="text-muted-foreground">Fill in your details to enroll in {staticCourse.name}</p>
              </DialogHeader>
              <form className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="Enter your full name" 
                    className="border-border focus:ring-primary focus:border-primary transition-all duration-300" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="Enter your email" 
                    className="border-border focus:ring-primary focus:border-primary transition-all duration-300" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="Enter your phone number" 
                    className="border-border focus:ring-primary focus:border-primary transition-all duration-300" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm font-medium">Address</Label>
                  <Input 
                    id="address" 
                    placeholder="Enter your address" 
                    className="border-border focus:ring-primary focus:border-primary transition-all duration-300" 
                  />
                </div>
              </form>
              <DialogFooter className="gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="border-border hover:bg-muted transition-all duration-300"
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  onClick={() => {
                    console.log("Registration submitted with static data");
                    setIsModalOpen(false);
                  }}
                  className="bg-primary hover:bg-primary/90 transition-all duration-300"
                >
                  Submit Registration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}