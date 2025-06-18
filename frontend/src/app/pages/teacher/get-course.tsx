import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCourseById } from "@/hooks/hooks";

export default function GetCourse() {
    const [courseId, setCourseId] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Using undefined as the default ensures the query doesn't run until we have a courseId
    const { 
        data: course, 
        isLoading, 
        isError, 
        error: queryError 
    } = useCourseById(courseId);

    const handleGetCourse = () => {
        setError(null);
        
        if (!courseId.trim()) {
            setError("Please enter a valid course ID");
            return;
        }
        
        setIsSearching(true);
    };

    const handleReset = () => {
        setCourseId("");
        setIsSearching(false);
        setError(null);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Get Course Details</h1>
            <Card className="p-6">
                <div className="flex gap-2 mb-4">
                    <Input
                        placeholder="Enter course ID"
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                    />
                    <Button onClick={handleGetCourse} disabled={isLoading}>
                        {isLoading ? "Loading..." : "Get Course"}
                    </Button>
                </div>
                
                {error && (
                    <div className="text-red-500 mb-4">{error}</div>
                )}
                
                {isError && (
                    <div className="text-red-500 mb-4">
                        {queryError instanceof Error ? queryError.message : "Failed to fetch course"}
                    </div>
                )}
                
                {isSearching && course && (
                    <>
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold mb-2">{course.name}</h2>
                            <p className="text-gray-700">{course.description}</p>
                        </div>
                        <Button variant="outline" onClick={handleReset}>
                            Search Another Course
                        </Button>
                    </>
                )}
            </Card>
        </div>
    );
}