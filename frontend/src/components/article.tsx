import { useEffect, useMemo, useState, useImperativeHandle, forwardRef, useRef } from "react";
import MathRenderer from "./math-renderer";

// Import Yoopta Editor Core
import YooptaEditor, { createYooptaEditor, YooptaContentValue} from '@yoopta/editor';

// Import Yoopta Plugins
import Paragraph from '@yoopta/paragraph';
import Blockquote from '@yoopta/blockquote';
import Image from '@yoopta/image';
import Link from '@yoopta/link';
import { NumberedList, BulletedList, TodoList } from '@yoopta/lists';
import Code from '@yoopta/code';
import { HeadingOne, HeadingTwo, HeadingThree } from '@yoopta/headings';
import Divider from '@yoopta/divider';
import 'katex/dist/katex.min.css';

// Import Markdown Serialization
import { markdown } from '@yoopta/exports';

// Import ShadCN UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Star, ChevronRight } from "lucide-react";
import { useStartItem, useStopItem } from "@/hooks/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useCourseStore } from "@/store/course-store";



// ✅ PLUGINS for Yoopta Editor (read-only display)
const plugins = [
    Paragraph,
    Blockquote,
    Link,
    Image,
    Divider,
    HeadingOne,
    HeadingTwo,
    HeadingThree,
    NumberedList,
    BulletedList,
    TodoList,
    Code,
];

interface ArticleProps {
    content: string;
    estimatedReadTimeInMinutes?: string;
    points?: string;
    tags?: string[];
    onNext?: () => void;
    isProgressUpdating?: boolean;
}

export interface ArticleRef {
    stopItem: () => void;
}

const Article = forwardRef<ArticleRef, ArticleProps>(({ content, estimatedReadTimeInMinutes, points, tags, onNext, isProgressUpdating }, ref) => {
    // ✅ Initialize Yoopta Editor
    const editor = useMemo(() => createYooptaEditor(), []);
    const [value, setValue] = useState<YooptaContentValue>();
    
    // ✅ Get user and course data from stores
    const userId = useAuthStore((state) => state.user?.userId);
    const { currentCourse, setWatchItemId } = useCourseStore();
    const startItem = useStartItem();
    const stopItem = useStopItem();
    
    // ✅ Track if item has been started
    const itemStartedRef = useRef(false);

    function handleSendStartItem() {
        if (!userId || !currentCourse?.itemId) return;
        startItem.mutate({
            params: {
                path: {
                    userId,
                    courseId: currentCourse.courseId,
                    courseVersionId: currentCourse.versionId ?? '',
                },
            },
            body: {
                itemId: currentCourse.itemId,
                moduleId: currentCourse.moduleId ?? '',
                sectionId: currentCourse.sectionId ?? '',
            }
        });
        if (startItem.data?.watchItemId) setWatchItemId(startItem.data?.watchItemId);
        itemStartedRef.current = true;
    }

    function handleStopItem() {
        if (!userId || !currentCourse?.itemId || !currentCourse.watchItemId || !itemStartedRef.current) return;
        stopItem.mutate({
            params: {
                path: {
                    userId,
                    courseId: currentCourse.courseId,
                    courseVersionId: currentCourse.versionId ?? '',
                },
            },
            body: {
                watchItemId: currentCourse.watchItemId,
                itemId: currentCourse.itemId,
                moduleId: currentCourse.moduleId ?? '',
                sectionId: currentCourse.sectionId ?? '',
            }
        });
        itemStartedRef.current = false;
    }

    // ✅ Expose stop function to parent component
    useImperativeHandle(ref, () => ({
        stopItem: handleStopItem
    }));

    // ✅ Load content from prop when component mounts or content changes
    useEffect(() => {
        if (content) {
            // Preprocess content to handle math expressions better
            let processedContent = content;
            
            // Ensure math expressions are properly formatted
            // Convert \( \) to $ $ for inline math
            processedContent = processedContent.replace(/\\\((.*?)\\\)/gs, '$$$1$$');
            // Convert \[ \] to $$ $$ for display math
            processedContent = processedContent.replace(/\\\[(.*?)\\\]/gs, '$$$$1$$$$');
            
            // Fix common LaTeX formatting issues
            // Ensure proper escaping for backslashes in math contexts
            processedContent = processedContent.replace(/\$\$(.*?)\$\$/gs, (_, mathContent) => {
                // Clean up the math content - remove extra escaping that might interfere
                const cleanMath = mathContent.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
                return `$$${cleanMath}$$`;
            });
            
            const deserializedValue = markdown.deserialize(editor, processedContent);
            setValue(deserializedValue);
            editor.setEditorValue(deserializedValue);

            // ✅ Start tracking item when content is loaded
            handleSendStartItem();
        }
    }, [editor, content]);

    // ✅ Stop item when component unmounts
    useEffect(() => {
        return () => {
            if (itemStartedRef.current) {
                handleStopItem();
            }
        };
    }, []);

    // ✅ Add dark mode styles for Yoopta Editor
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .dark .yoopta-mark-code {
                background-color: hsl(var(--muted)) !important;
                color: hsl(var(--muted-foreground)) !important;
            }

            .dark .yoopta-link-preview {
                background-color: hsl(var(--popover)) !important;
                border-color: hsl(var(--border)) !important;
                color: hsl(var(--popover-foreground)) !important;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);


    return (
        <MathRenderer className="h-full w-full bg-background">
            <div className="h-full w-full flex flex-col">
                {/* Article Metadata Topbar */}
                {(estimatedReadTimeInMinutes || points || tags?.length) && (
                    <div className="border-b bg-muted/50 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {estimatedReadTimeInMinutes && (
                                <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    <span>{estimatedReadTimeInMinutes} min read</span>
                                </div>
                            )}
                            {points && (
                                <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4" />
                                    <span>{points} points</span>
                                </div>
                            )}
                            {tags && tags.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span>Tags:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {tags.map((tag, index) => (
                                            <Badge key={index} variant="secondary" className="text-xs">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Article Content */}
                <div className="flex-1 w-full p-4 overflow-y-auto">
                    <YooptaEditor
                        width="100%"
                        value={value}
                        editor={editor}
                        plugins={plugins}
                        readOnly={true}
                        autoFocus={false}
                        className="prose prose-lg max-w-none w-full"
                    />
                </div>

                {/* Next Lesson Button */}
                {onNext && (
                    <div className="p-4 border-t border-border/20 bg-background/50 backdrop-blur-sm">
                        <div className="flex justify-end">
                            <Button
                                onClick={onNext}
                                disabled={isProgressUpdating}
                                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
                                size="lg"
                            >
                                {isProgressUpdating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />
                                        Processing
                                    </>
                                ) : (
                                    <>
                                        Next Lesson
                                        <ChevronRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </MathRenderer>
    );
})

Article.displayName = "Article";

export default Article;