import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, ExternalLink } from "lucide-react";
import { useReviewStore } from "@/store/review-store";

export default function MarkedReviewPage() {
  const markedItems = useReviewStore((state) => state.markedItems);

  const handleOpenItem = (url: string) => {
    window.location.assign(url);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">MARKED FOR REVIEW</h1>
        <p className="text-sm text-muted-foreground">
          Quickly jump back to quizzes or videos you marked during learning.
        </p>
      </div>

      {markedItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bookmark className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">No items marked for review yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use the "Mark for Review" action while watching videos or taking quizzes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {markedItems.map((item) => (
            <Card key={item.id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-6">{item.title}</CardTitle>
                  <Badge variant={item.type === "quiz" ? "default" : "secondary"}>
                    {item.type.toUpperCase()}
                  </Badge>
                </div>
                <CardDescription className="truncate">{item.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => handleOpenItem(item.url)} className="w-full">
                  Open item
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
