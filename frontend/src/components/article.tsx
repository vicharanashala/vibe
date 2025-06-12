import { useEffect, useMemo, useState } from "react";
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
import { Clock, Star } from "lucide-react";



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
}

const Article = ({ content, estimatedReadTimeInMinutes, points, tags }: ArticleProps) => {
    // ✅ Initialize Yoopta Editor
    const editor = useMemo(() => createYooptaEditor(), []);
    const [value, setValue] = useState<YooptaContentValue>();

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
        }
    }, [editor, content]);

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
            <div className="h-full w-full">
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
                <div className="h-full w-full p-4">
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
            </div>
        </MathRenderer>
    );
}

export default Article;