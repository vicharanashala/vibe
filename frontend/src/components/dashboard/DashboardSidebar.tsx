import { Clock, FileText, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TodoList } from "@/components/ui/TodoList";
import { bufferToHex } from "@/utils/helpers";

interface DashboardSidebarProps {
  enrollments: Array<Record<string, unknown>>;
  className?: string;
}

export const DashboardSidebar = ({ enrollments, className }: DashboardSidebarProps) => {
  return (
    <aside className={`w-full md:w-80 space-y-6 bg-sidebar p-4 rounded-lg border border-sidebar-border ${className || ''}`}>
      <TodoList />

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
  );
};
