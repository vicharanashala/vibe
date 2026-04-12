import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogHeader, DialogFooter} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";

function getApiUrl(path: string) {
  return `${import.meta.env.VITE_BASE_URL}${path}`;
}

export default function GenerateSectionPage() {
    const [courseId, setCourseId] = useState("");
    const [versionId, setVersionId] = useState("");
    const [moduleId, setModuleId] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showDialog, setShowDialog] = useState(false);


    const handleGenerateSection = async () => {
        if(!courseId || !versionId || !moduleId || !videoUrl) {
            toast.error("Missing Fields", {
                description: "Please fill in all fields before generating the section.",
            });
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(getApiUrl('/genai/jobs'), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "VIDEO",
                    url: videoUrl,
                    metadata: {
                        courseId,
                        versionId,
                        moduleId,
                    }
                }),
            });

            const data = await res.json();

            if(!res.ok || !data.id) {
                throw new Error(data.message || "Job creation failed");
            }

            toast.success("Job started successfully!", { 
                description: `Your Job has been created with ID: ${data.id}`,
            });
            setShowDialog(false);

        } catch (error) {
            toast.error("Error starting job", {
                description: error instanceof Error ? error.message : "An unexpected error occurred.",
            });
        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className="max-w-2xl mx-auto p-6">
            <Card className="border-muted bg-muted/10">
                <CardContent className="space-y-4 py-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-primary" />
                        Generate Section from YouTube URL
                    </h2>

                    <div className="space-y-4"> 
                        <Input
                            placeholder="Course ID"
                            value={courseId}
                            onChange={(e) => setCourseId(e.target.value)}
                            className="mb-4"
                        />
                        <Input
                            placeholder="Version ID"
                            value={versionId}
                            onChange={(e) => setVersionId(e.target.value)}
                            className="mb-4"
                        />
                        <Input
                            placeholder="Module ID"
                            value={moduleId}
                            onChange={(e) => setModuleId(e.target.value)}
                            className="mb-4"
                        />
                        <Input
                            placeholder="YouTube Video URL"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            className="mb-4"
                        />
                    </div>

                    <div className="bg-muted/50 rounded-md p-4 mt-6 text-sm text-foreground shadow-sm space-y-1 border">
                        <p><strong className="text-foreground">Course ID:</strong> {courseId || "-"}</p>
                        <p><strong className="text-foreground">Version ID:</strong> {versionId || "-"}</p>
                        <p><strong className="text-foreground">Module ID:</strong> {moduleId || "-"}</p>
                        <p><strong className="text-foreground">Video URL:</strong> {videoUrl || "-"}</p>
                    </div> 

                    <Dialog open={showDialog} onOpenChange={setShowDialog}>
                        <DialogTrigger asChild>
                            <Button variant="default" >
                                <Wand2 className="h-5 w-5 mr-2" />
                                Generate Section
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <div className="flex items-center gap-2 mb-4">
                                    <Wand2 className="h-6 w-6 text-primary mb-2" />
                                    <DialogTitle className="text-lg font-semibold">Confirm Section Generation</DialogTitle>
                                </div>
                            </DialogHeader>
                            <div className="text-sm text-muted-foreground space-y-2">
                                <p><strong className="text-foreground">Course ID:</strong> {courseId}</p>
                                <p><strong className="text-foreground">Version ID:</strong> {versionId}</p>
                                <p><strong className="text-foreground">Module ID:</strong> {moduleId}</p>
                                <p><strong className="text-foreground">Video URL:</strong> {videoUrl}</p>
                            </div>
                            <DialogFooter className="mt-4">
                                <Button variant={"outline"} onClick={() => setShowDialog(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleGenerateSection}
                                    className="default"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            Generate    
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        </div>
    );
}
