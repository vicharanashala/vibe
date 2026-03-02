import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Sparkles } from "lucide-react";

export default function OverviewTab() {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-card/95 backdrop-blur-sm border border-border/50 hover:bg-accent/5 transition-colors">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <LayoutDashboard className="h-5 w-5 text-primary" />
                        HP Overview Dashboard
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <div className="h-64 flex flex-col justify-center items-center text-muted-foreground border-2 border-dashed border-border/60 rounded-xl bg-muted/10 gap-2">
                        <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                        <p className="font-medium text-lg">Dashboard coming soon.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}