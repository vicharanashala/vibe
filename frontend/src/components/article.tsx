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
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// Import Markdown Serialization
import { markdown } from '@yoopta/exports';
import { html } from "@yoopta/exports";


// Import ShadCN UI Components
import { Button } from "@/components/ui/button";



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

const getEditorWidth = () => {
    const screenWidth = window.innerWidth;
    
    if (screenWidth < 640) return "95vw"; // Mobile (95% of viewport width)
    if (screenWidth < 1024) return "100%"; // Tablets/iPads (80% of viewport width)
    return "100vw"; // Laptops & Desktops (60% of viewport width)
};

interface ArticleProps {
    content: string;
}

const Article = ({ content }: ArticleProps) => {
    // ✅ Initialize Yoopta Editor
    const editor = useMemo(() => createYooptaEditor(), []);
    const [value, setValue] = useState<YooptaContentValue>();
    const [editorWidth, setEditorWidth] = useState(getEditorWidth());

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
            processedContent = processedContent.replace(/\$\$(.*?)\$\$/gs, (match, mathContent) => {
                // Clean up the math content - remove extra escaping that might interfere
                const cleanMath = mathContent.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
                return `$$${cleanMath}$$`;
            });
            
            const deserializedValue = markdown.deserialize(editor, processedContent);
            setValue(deserializedValue);
            editor.setEditorValue(deserializedValue);
        }
    }, [editor, content]);

    // ✅ Update width on window resize
    useEffect(() => {
        const handleResize = () => {
            setEditorWidth(getEditorWidth());
        };
        
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
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
        <MathRenderer className="min-h-screen py-8 px-2 bg-background text-foreground">
            {/* Article Display Section */}
            <div className="mt-8 flex justify-center">
                <div className="w-full flex justify-center">
                    <YooptaEditor
                        width="100%"
                        value={value}
                        editor={editor}
                        plugins={plugins}
                        readOnly={true}
                        autoFocus={false}
                    />
                </div>
            </div>
        </MathRenderer>
    );
}

export default Article;