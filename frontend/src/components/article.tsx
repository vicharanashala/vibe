import { useEffect, useMemo, useState, useImperativeHandle, forwardRef, useRef } from "react";
import MathRenderer from "./math-renderer";

// Import Yoopta Editor Core
import YooptaEditor, { createYooptaEditor, YooptaContentValue } from '@yoopta/editor';

// Import Yoopta Plugins
import Paragraph from '@yoopta/paragraph';
import Blockquote from '@yoopta/blockquote';
import Image from '@yoopta/image';
import Link from '@yoopta/link';
import { NumberedList, BulletedList, TodoList } from '@yoopta/lists';
import Code from '@yoopta/code';
import { HeadingOne, HeadingTwo, HeadingThree } from '@yoopta/headings';
import Divider from '@yoopta/divider';
import LinkTool, { DefaultLinkToolRender } from '@yoopta/link-tool';
import ActionMenu, { DefaultActionMenuRender } from '@yoopta/action-menu-list';
import Toolbar, { DefaultToolbarRender } from '@yoopta/toolbar';
import { Bold, Italic, CodeMark, Underline, Strike, Highlight } from '@yoopta/marks';
import 'katex/dist/katex.min.css';

// Import Markdown Serialization
import { markdown } from '@yoopta/exports';

const MARKS = [Bold, Italic, CodeMark, Underline, Strike, Highlight];

const TOOLS = {
  Toolbar: {
    tool: Toolbar,
    render: DefaultToolbarRender,
  },
  ActionMenu: {
    tool: ActionMenu,
    render: DefaultActionMenuRender,
  },
  LinkTool: {
    tool: LinkTool,
    render: DefaultLinkToolRender,
  },
};

// Import ShadCN UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Star, ChevronRight, ExternalLink, Link as LinkIcon, X, Maximize2 } from "lucide-react";
import { useStartItem, useStopItem, useUpsertWatchTime } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";

// Helper function to convert Google Docs/Sheets URLs to embeddable format
const convertToEmbedUrl = (url: string): string | null => {
  // Google Docs
  if (url.includes('docs.google.com/document')) {
    const docId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (docId) return `https://docs.google.com/document/d/${docId}/preview`;
  }
  // Google Sheets
  if (url.includes('docs.google.com/spreadsheets')) {
    const sheetId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (sheetId) return `https://docs.google.com/spreadsheets/d/${sheetId}/preview`;
  }
  // Google Slides
  if (url.includes('docs.google.com/presentation')) {
    const slideId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (slideId) return `https://docs.google.com/presentation/d/${slideId}/preview`;
  }
  return null;
};

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
import type { ArticleProps, ArticleRef } from "@/types/article.types";
import { NavigatingOverlay } from "./video";
import { toast } from "sonner";


const Article = forwardRef<ArticleRef, ArticleProps>(({ content, estimatedReadTimeInMinutes, points, tags, onNext, isProgressUpdating, isAlreadyWatched, completedItemIdsRef }, ref) => {
    // ✅ Initialize Yoopta Editor
    const editor = useMemo(() => createYooptaEditor(), []);
    const [value, setValue] = useState<YooptaContentValue>();
    const [extractedLinks, setExtractedLinks] = useState<Array<{ text: string; href: string }>>([]);
    const [selectedLink, setSelectedLink] = useState<{ text: string; href: string; embedUrl: string } | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // ✅ Get user and course data from stores
    const { currentCourse, setWatchItemId } = useCourseStore();
    const startItem = useStartItem();
    const stopItem = useStopItem();
    const upsertWatchTime = useUpsertWatchTime();
    const [isStopping, setIsStopping] = useState(false);

    // ✅ Track if item has been started and if start request has been sent
    const itemStartedRef = useRef(false);
    const startRequestSentRef = useRef(false);

    function handleSendStartItem() {
        if (!currentCourse?.itemId || startRequestSentRef.current) return;
        // Mark that we've sent the start request to prevent multiple calls
        startRequestSentRef.current = true;
        if(!isAlreadyWatched && (currentCourse!.itemId && !completedItemIdsRef.current.has(currentCourse!.itemId))){
            startItem.mutate({
                params: {
                    path: {
                        courseId: currentCourse.courseId,
                        courseVersionId: currentCourse.versionId ?? '',
                    },
                },
                body: {
                    itemId: currentCourse.itemId,
                    moduleId: currentCourse.moduleId ?? '',
                    sectionId: currentCourse.sectionId ?? '',
                    cohortId: currentCourse.cohortId ?? '',
                }
            });
        }
    }

   async function handleStopItem() {
        if (!currentCourse?.itemId || !currentCourse.watchItemId || !itemStartedRef.current) return;
        
        try {
            if(!isAlreadyWatched && (currentCourse!.itemId && !completedItemIdsRef.current.has(currentCourse!.itemId))){
                await stopItem.mutateAsync({
                    params: {
                        path: {
                            courseId: currentCourse.courseId,
                            courseVersionId: currentCourse.versionId ?? '',
                        },
                    },
                    body: {
                        watchItemId: currentCourse.watchItemId,
                        itemId: currentCourse.itemId,
                        moduleId: currentCourse.moduleId ?? '',
                        sectionId: currentCourse.sectionId ?? '',
                        cohortId: currentCourse.cohortId ?? '',
                    }
                });
            }
            completedItemIdsRef.current.add(currentCourse!.itemId);
            itemStartedRef.current = false;
        } catch (error: any) {
            console.error('❌ handleStopItem error:', error);
            // Re-throw the error so it can be caught by the parent
            throw error;
        }
    }

    // // ✅ Handle Next button click - send stop request only when user clicks Next
    // const handleNextClick = () => {
    //     if (itemStartedRef.current) {
    //         handleStopItem();
    //     }
    //     if (onNext) {
    //         onNext();
    //     }
    // };

    const handleNextClick = async () => {
        if (isStopping || isProgressUpdating) return;
        
        try {
            setIsStopping(true);
            if (itemStartedRef.current) {
            await handleStopItem(); //  wait until stop finishes
            }

            onNext?.(); //  only after stop succeeds
        } catch (err: any) {
            // toast.error('Unable to save progress. Please try again.');
            toast.warning(err.response?.data?.message || 'You must spend more time reading this article to proceed.');
            console.error('Stop item failed:', err);
        } finally {
            setIsStopping(false);
        }
    };

    // ✅ Expose stop function to parent component
    useImperativeHandle(ref, () => ({
        stopItem: handleStopItem
    }));

    // ✅ Watch for start request completion and update watchItemId
    useEffect(() => {
        if (startItem.data?.watchItemId && startRequestSentRef.current && !itemStartedRef.current) {
            setWatchItemId(startItem.data.watchItemId);
            itemStartedRef.current = true;
        }
    }, [startItem.data?.watchItemId, setWatchItemId]);

    // ✅ Call upsert watch time API every 10 seconds while article is being read
    useEffect(() => {
        if (!currentCourse?.watchItemId || !itemStartedRef.current) return;

        const interval = setInterval(() => {
            upsertWatchTime.mutate({
                body: {
                    watchItemId: currentCourse.watchItemId!,
                    itemId: currentCourse.itemId!,
                    cohortId: currentCourse.cohortId ?? undefined,
                }
            } as any);
        }, 15000); // every 15 seconds

        return () => clearInterval(interval); // cleanup on unmount
    }, [currentCourse?.watchItemId]);

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

            // ✅ Start tracking item when content is loaded (only once)
            handleSendStartItem();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, content]);

    // ✅ Extract links from article content to display in Resources section
    useEffect(() => {
        const contentDiv = document.querySelector('.prose');
        if (!contentDiv) return;

        const links = Array.from(contentDiv.querySelectorAll('a'))
            .map(a => ({
                text: a.textContent || 'Link',
                href: a.getAttribute('href') || ''
            }))
            .filter(link => link.href && (
                link.href.includes('docs.google.com') ||
                link.href.includes('dropbox.com') ||
                link.href.includes('onedrive.live.com') ||
                link.href.includes('http') ||
                link.href.startsWith('//')
            ));

        // Remove duplicates
        const uniqueLinks = Array.from(new Map(links.map(l => [l.href, l])).values());
        setExtractedLinks(uniqueLinks);
    }, [value]);

    // ✅ Clean up on unmount - but don't send stop request here
    useEffect(() => {
        return () => {
            // Reset refs on unmount
            itemStartedRef.current = false;
            startRequestSentRef.current = false;
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

    // Handle link click - prevent default and open in viewer
    const handleLinkClick = (link: { text: string; href: string }) => {
        const embedUrl = convertToEmbedUrl(link.href);
        if (embedUrl) {
            setSelectedLink({ ...link, embedUrl });
        } else {
            // For non-embeddable links, open in new tab
            window.open(link.href, '_blank', 'noopener,noreferrer');
        }
    };


    return (
        <MathRenderer className="h-full w-full bg-background">
            <div className="h-full w-full flex flex-col">
                <NavigatingOverlay
                    visible={isStopping}
                    title="Verifying answers"
                    message="Please wait while we submit and validate your responses…"
                />
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
                        marks={MARKS}
                        tools={TOOLS}
                        readOnly={true}
                        autoFocus={false}
                        className="prose prose-lg max-w-none w-full dark:prose-invert"
                    />
                </div>

                {/* Resources/Links Section - Click to embed in viewer below */}
                {extractedLinks.length > 0 && !selectedLink && (
                    <div className="border-t border-border/20 bg-background/50 px-4 py-4">
                        <div className="max-h-32 overflow-y-auto">
                            <div className="flex items-center gap-2 mb-3">
                                <LinkIcon className="h-4 w-4 text-primary" />
                                <h3 className="font-semibold text-sm">Resources & Links</h3>
                                <Badge variant="secondary" className="text-xs">{extractedLinks.length}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {extractedLinks.map((link, index) => (
                                    <Button
                                        key={index}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleLinkClick(link)}
                                        className="gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20 hover:border-primary/40 text-xs"
                                        title={link.href}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        <span className="truncate max-w-[150px]">
                                            {link.text.length > 20 ? link.text.substring(0, 20) + '...' : link.text}
                                        </span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Embedded Document Viewer */}
                {selectedLink && (
                    <div className={`border-t border-border/20 bg-background/50 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 p-4' : 'h-96'}`}>
                        {/* Viewer Header */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 border-b border-border/20 rounded-t">
                            <div className="flex items-center gap-2 min-w-0">
                                <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
                                <h3 className="font-semibold text-sm truncate">{selectedLink.text}</h3>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsFullscreen(!isFullscreen)}
                                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                                >
                                    <Maximize2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedLink(null);
                                        setIsFullscreen(false);
                                    }}
                                    title="Close Viewer"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Embedded Document */}
                        <div className="flex-1 overflow-hidden rounded-b">
                            <iframe
                                src={selectedLink.embedUrl}
                                className="w-full h-full border-0"
                                title={selectedLink.text}
                                allowFullScreen
                            />
                        </div>

                        {/* Back to links button */}
                        {!isFullscreen && (
                            <div className="p-3 border-t border-border/20 bg-muted/30 flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedLink(null)}
                                    className="text-xs"
                                >
                                    ← Back to Links
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(selectedLink.href, '_blank', 'noopener,noreferrer')}
                                    className="text-xs"
                                >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Open in New Tab
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Next Lesson Button */}
                {onNext && !selectedLink && (
                    <div className="p-4 border-t border-border/20 bg-background/50 backdrop-blur-sm">
                        <div className="flex justify-end">
                            <Button
                                onClick={handleNextClick}
                                disabled={isProgressUpdating || isStopping}
                                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                                size="lg"
                            >
                                {isProgressUpdating || isStopping ? (
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