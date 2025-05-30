"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCourseStore } from '@/lib/store/course-store';
import { useAuthStore } from '@/lib/store/auth-store';
import {
    useCourseById,
    useCourseVersionById,
    useUserProgress,
    useStartItem
} from '@/lib/api/hooks';
import {
    SidebarProvider,
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarTrigger,
    SidebarInset
} from '@/components/ui/sidebar';
import ItemContainer, { Item } from '@/components/Item-container';
import { components } from '@/lib/api/schema';

// Use interfaces from schema.ts
type CourseModule = {
    _id: string;
    name: string;
    description?: string;
    sections?: CourseSection[];
    order?: string;
};

type CourseSection = {
    _id: string;
    name: string;
    description?: string;
    items?: CourseItem[];
    order?: string;
};

type CourseItem = {
    _id: string;
    name: string;
    type: string;
    description?: string;
    videoDetails?: {
        URL: string;
        [key: string]: any;
    };
    blogDetails?: {
        content: string;
        [key: string]: any;
    };
    quizDetails?: Record<string, any>;
    order?: string;
};

type CourseVersion = {
    _id: string;
    version: string;
    description?: string;
    modules?: CourseModule[];
};

const CoursePage: React.FC = () => {
    const navigate = useNavigate();
    const { currentCourse } = useCourseStore();
    const { user } = useAuthStore();
    const [currentItem, setCurrentItem] = useState<Item | null>(null);

    // Get userId from auth store
    // const userId = user?.uid || '';
    const userId = '6831c13a7d17e06882be43ca'

    // Debug output to track store updates
    useEffect(() => {
        console.log("Current course in store:", currentCourse);
    }, [currentCourse]);

    // Redirect if no course is selected or user is not authenticated
    useEffect(() => {
        if (!currentCourse?.courseId) {
            console.log("No course selected, redirecting to dashboard");
            navigate({ to: '/student/courses' });
            return;
        }

    }, [currentCourse, userId, navigate]);
    function bufferToHex(buffer: Buffer | Uint8Array): string {
        // Ensure we have a Uint8Array for iteration
        const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

        let hexString = '';
        for (let i = 0; i < uint8.length; i++) {
            hexString += uint8[i].toString(16).padStart(2, '0');
        }

        return hexString;
    }
    // const courseId = bufferToHex(currentCourse?.courseId.buffer.data) ?? '';
    // const courseVersionId = bufferToHex(currentCourse?.versionId.buffer.data) ?? '';
    const courseId = '6831b9651f79c52d445c5d8b';
    const courseVersionId = '6831b9651f79c52d445c5d8c';

    // Fetch course details
    const {
        data: course,
        isLoading: isLoadingCourse
    } = useCourseById(courseId);

    // Fetch course version details
    const {
        data: version,
        isLoading: isLoadingVersion
    } = useCourseVersionById(courseVersionId);

    // Fetch user progress
    const {
        data: progress,
        isLoading: isLoadingProgress,
        refetch: refetchProgress
    } = useUserProgress(userId, courseId, courseVersionId);

    // Hook for starting an item
    const startItem = useStartItem();

    // Handle selecting an item from the sidebar
    const handleSelectItem = async (moduleId: string, sectionId: string, itemId: string) => {
        try {
            console.log("Starting item:", { moduleId, sectionId, itemId });
            await startItem.mutateAsync({
                params: {
                    path: { userId, courseId, courseVersionId }
                },
                body: { moduleId, sectionId, itemId }
            });

            refetchProgress();
        } catch (error) {
            console.error("Failed to start item:", error);
        }
    };

    // Auto-navigate to current progress item when data is loaded
    useEffect(() => {
        if (progress && version) {
            console.log("Progress data:", progress);
            console.log("Version data:", version);

            const courseVersion = version as unknown as CourseVersion;
            const currentModuleData = courseVersion.modules?.find(m =>
                m._id === progress.currentModule
            );

            if (currentModuleData) {
                const currentSectionData = currentModuleData.sections?.find(s =>
                    s._id === progress.currentSection
                );

                if (currentSectionData) {
                    const currentItemData = currentSectionData.items?.find(i =>
                        i._id === progress.currentItem
                    );

                    if (currentItemData) {
                        // Convert to the format ItemContainer expects
                        setCurrentItem({
                            name: currentItemData.name,
                            itemtype: currentItemData.type.toLowerCase() as 'video' | 'quiz' | 'article',
                            content: getItemContent(currentItemData)
                        });
                    }
                }
            }
        }
    }, [progress, version]);

    // Helper to extract appropriate content based on item type
    const getItemContent = (item: CourseItem): string => {
        switch (item.type.toLowerCase()) {
            case 'video':
                return item.videoDetails?.URL || '';
            case 'quiz':
                return JSON.stringify(item.quizDetails) || '';
            case 'article':
            case 'blog':
                return item.blogDetails?.content || '';
            default:
                return '';
        }
    };

    // Loading state
    if (isLoadingCourse || isLoadingVersion || isLoadingProgress) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground">Loading your course...</p>
                </div>
            </div>
        );
    }

    // Error or not found state
    if (!courseId || !courseVersionId || !course || !version || !progress) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background">
                <h2 className="text-xl font-medium text-muted-foreground">
                    {!user ? "Please log in to view this course" :
                        !courseId ? "No course selected" :
                            "Course not found"}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md text-center">
                    {!courseId ? "Please select a course from your dashboard to start learning" :
                        "The course you're looking for could not be found or you don't have access to it."}
                </p>
                <button
                    className="px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
                    onClick={() => navigate({ to: !user ? '/login' : '/student/courses' })}
                >
                    {!user ? "Go to Login" : "Return to Courses"}
                </button>
            </div>
        );
    }

    const courseVersion = version as unknown as CourseVersion;

    return (
        <SidebarProvider defaultOpen={true}>
            <div className="flex h-screen overflow-hidden bg-background">
                <Sidebar variant="inset">
                    <SidebarHeader className="flex items-center justify-between p-4 border-b">
                        <div>
                            <h2 className="text-lg font-bold truncate">{course.name}</h2>
                            <p className="text-xs text-muted-foreground">{courseVersion.version || "Current Version"}</p>
                        </div>
                        <SidebarTrigger />
                    </SidebarHeader>

                    <SidebarContent className="py-2">
                        {courseVersion.modules?.map((module, moduleIndex) => (
                            <SidebarMenu key={module._id}>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        isActive={progress.currentModule === module._id}
                                        variant={progress.currentModule === module._id ? "default" : "outline"}
                                        size="lg"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="flex items-center justify-center w-6 h-6 text-xs rounded-full bg-muted">
                                                {moduleIndex + 1}
                                            </span>
                                            <span className="font-medium">{module.name}</span>
                                        </span>
                                    </SidebarMenuButton>

                                    <SidebarMenuSub>
                                        {module.sections?.map((section, sectionIndex) => (
                                            <SidebarMenuSubItem key={section._id}>
                                                <SidebarMenuSubButton
                                                    isActive={progress.currentSection === section._id}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-xs text-muted-foreground">
                                                            {moduleIndex + 1}.{sectionIndex + 1}
                                                        </span>
                                                        <span className="font-medium">{section.name}</span>
                                                    </span>
                                                </SidebarMenuSubButton>

                                                <SidebarMenuSub>
                                                    {section.items?.map((item, itemIndex) => (
                                                        <SidebarMenuSubItem key={item._id}>
                                                            <SidebarMenuSubButton
                                                                isActive={progress.currentItem === item._id}
                                                                onClick={() => handleSelectItem(module._id, section._id, item._id)}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {moduleIndex + 1}.{sectionIndex + 1}.{itemIndex + 1}
                                                                    </span>
                                                                    <span className={progress.currentItem === item._id ? "font-medium" : ""}>
                                                                        {item.name}
                                                                    </span>
                                                                </span>
                                                            </SidebarMenuSubButton>
                                                        </SidebarMenuSubItem>
                                                    ))}
                                                </SidebarMenuSub>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        ))}
                    </SidebarContent>
                </Sidebar>

                <SidebarInset className="p-0">
                    <div className="flex flex-col h-full">
                        <div className="flex-1 p-6 overflow-y-auto">
                            {currentItem ? (
                                <div className="max-w-3xl mx-auto">
                                    <ItemContainer
                                        item={currentItem}
                                        userId={userId}
                                        courseId={courseId}
                                        courseVersionId={courseVersionId}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <p className="text-lg text-muted-foreground">Select an item from the sidebar to begin learning</p>
                                    <button
                                        className="px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
                                        onClick={() => {
                                            // Navigate to the first item if available
                                            const firstModule = courseVersion.modules?.[0];
                                            const firstSection = firstModule?.sections?.[0];
                                            const firstItem = firstSection?.items?.[0];

                                            if (firstModule && firstSection && firstItem) {
                                                handleSelectItem(firstModule._id, firstSection._id, firstItem._id);
                                            }
                                        }}
                                    >
                                        Start Course
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
};

export default CoursePage;
