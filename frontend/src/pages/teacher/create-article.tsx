import { useEffect, useMemo, useState } from "react";

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

// Import Yoopta Tools
import LinkTool, { DefaultLinkToolRender } from '@yoopta/link-tool';
import ActionMenu, { DefaultActionMenuRender } from '@yoopta/action-menu-list';
import Toolbar, { DefaultToolbarRender } from '@yoopta/toolbar';

// Import Yoopta Marks
import { Bold, Italic, CodeMark, Underline, Strike, Highlight } from '@yoopta/marks';

// Import Markdown Serialization
import { markdown, html } from '@yoopta/exports';

// Import ShadCN UI Components
import { Button } from "@/components/ui/button";



// ✅ MARKS for Rich Text
const MARKS = [Bold, Italic, CodeMark, Underline, Strike, Highlight];

// ✅ TOOLS for Yoopta Editor
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

// ✅ PLUGINS for Yoopta Editor
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
    if (screenWidth < 1024) return "80vw"; // Tablets/iPads (80% of viewport width)
    return "60vw"; // Laptops & Desktops (60% of viewport width)
};

const Editor = () => {
    // ✅ Initialize Yoopta Editor
    const [bIsReadOnly, setBIsReadOnly] = useState(false);
    const editor = useMemo(() => createYooptaEditor(), []);
    const [value, setValue] = useState<YooptaContentValue>();
    const [editorWidth, setEditorWidth] = useState(getEditorWidth());
    const [showPreview, ] = useState(false);

  // ✅ Load content from localStorage when the component mounts
  useEffect(() => {
    const savedContent = localStorage.getItem('editor-value');
    if (savedContent) {
      const deserializedValue = html.deserialize(editor, savedContent);
      editor.setEditorValue(deserializedValue);
    }
  }, [editor]); // Add dependency array with editor

      // ✅ Update width on window resize
      useEffect(() => {
        const handleResize = () => {
            setEditorWidth(getEditorWidth());
        };
        
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // ✅ HTML Serialization
    const serializeHTML = () => {
        const data = editor.getEditorValue();
        const htmlString = html.serialize(editor, data);
        console.log('html string', htmlString);
        navigator.clipboard.writeText(htmlString)
    };

    // ✅ Markdown Serialization
    const serializeMarkdown = () => {
        const data = editor.getEditorValue();
        const markdownString = markdown.serialize(editor, data);
        console.log('markdown string', markdownString);
        navigator.clipboard.writeText(markdownString)
    };

    // ✅ HTML Deserialization
    const deserializeHTML = () => {
        const htmlString = `
        <body id="yoopta-clipboard" data-editor-id="7a0d626a-1d82-483a-871a-2ee3e4522e47"><h1 data-meta-align="left" data-meta-depth="0" style="margin-left: 0px; text-align: left">First title</h1><p data-meta-align="left" data-meta-depth="0" style="margin-left: 0px; text-align: left"><strong style="font-weight: bolder;">Microsoft Edge</strong> is moving towards a new experience that allows users to <u>choose</u> to browse without third-party <s>cookies</s> <code style="background-color: rgb(242 242 242); border-radius: .25rem; font-size: 75%; padding: 3px 6px;">code.</code></p><ul data-meta-align="left" data-meta-depth="0" style="margin-left: 0px; text-align: left"><li>[ ] This is item 1</li></ul><ul data-meta-align="left" data-meta-depth="0" style="margin-left: 0px; text-align: left"><li>[ ] This is item 2</li></ul><pre data-theme="Copilot" data-language="python" data-meta-align="left" data-meta-depth="0" style="margin-left: 0px; display: flex; width: 100%; justify-content: flex-start; background-color: #263238; color: #fff; padding: 20px 24px; white-space: pre-line;"><code>def func():
  print(&quot;Hello World.&quot;)</code></pre><hr data-meta-theme="solid" data-meta-color="#EFEFEE" style="background-color: #8383e0; height: 1.2px" /><h2 data-meta-align="left" data-meta-depth="0" style="margin-left: 0px; text-align: left">This is new section</h2><blockquote data-meta-align="left" data-meta-depth="0" style="margin-left: 0px; text-align: left; border-left: 3px solid; color: #292929; padding: 2px 14px; margin-top: 8px;">This is a blockquote</blockquote><p data-meta-align="left" data-meta-depth="0" style="margin-left: 0px; text-align: left"></p></body>
        `;
        const content = html.deserialize(editor, htmlString);
        console.log('content', content);

        editor.setEditorValue(content);
    };

    // ✅ Markdown Deserialization
    const deserializeMarkdown = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.markdown';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const markdownString = e.target?.result as string;
                    const content = markdown.deserialize(editor, markdownString);
                    console.log('markdown content', content);
                    editor.setEditorValue(content);
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const onEditorChange = (value: YooptaContentValue, /*options: YooptaOnChangeOptions*/) => {
        localStorage.setItem('editor-value', html.serialize(editor, value));
        setValue(value);
    }


    // ✅ Add dark mode styles for Yoopta Editor
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .dark .yoopta-toolbar-root {
                background-color: hsl(var(--popover)) !important;
                border-color: hsl(var(--border)) !important;
                color: hsl(var(--popover-foreground)) !important;
            }

            .dark .yoopta-toolbar-separator {
                background-color: hsl(var(--border)) !important;
            }

            .dark .yoopta-toolbar-item:hover,
            .dark .yoopta-toolbar-item-mark:hover {
                background-color: hsl(var(--accent)) !important;
            }

            .dark .yoopta-mark-code {
                background-color: hsl(var(--muted)) !important;
                color: hsl(var(--muted-foreground)) !important;
            }

            .dark .yoopta-extended-block-actions {
                background-color: hsl(var(--popover)) !important;
                border-color: hsl(var(--border)) !important;
            }

            .dark .yoopta-block-options-menu-content {
                background-color: hsl(var(--popover)) !important;
                border-color: hsl(var(--border)) !important;
                color: hsl(var(--popover-foreground)) !important;
            }

            .dark .yoopta-block-options-button:hover {
                background-color: hsl(var(--accent)) !important;
            }

            .dark .yoo-code-text-popover-foreground {
                background-color: hsl(var(--popover)) !important;
                color: hsl(var(--popover-foreground)) !important;
            }

            .dark .yoo-code-text-popover-foreground > * > .yoopta-button:hover {
                background-color: hsl(var(--accent)) !important;
            }

            .dark .yoopta-action-menu-list-content {
                background-color: hsl(var(--popover)) !important;
                border-color: hsl(var(--border)) !important;
                color: hsl(var(--popover-foreground)) !important;
            }

            .dark .yoopta-action-menu-list-content > * > * > .yoopta-button:hover {
                background-color: hsl(var(--accent)) !important;
            }

            .dark .yoopta-action-menu-list-content > * > * > .yoopta-button[aria-selected='true'] {
                background-color: hsl(var(--accent)) !important;
            }

            .dark .yoopta-action-menu-list-content > * > * > .yoopta-button > .yoo-action-menu-flex {
                background-color: hsl(var(--muted)) !important;
            }

            .dark .yoopta-block-actions-plus,
            .dark .yoopta-block-actions-drag {
                color: hsl(var(--muted-foreground)) !important;
            }

            .dark .yoopta-block-actions-plus:hover,
            .dark .yoopta-block-actions-drag:hover {
                color: hsl(var(--foreground)) !important;
            }

            .dark .yoopta-link-preview {
                background-color: hsl(var(--popover)) !important;
                border-color: hsl(var(--border)) !important;
                color: hsl(var(--popover-foreground)) !important;
            }

            .dark [data-radix-popper-content-wrapper] button {
                color: hsl(var(--popover-foreground)) !important;
            }

            .dark [data-radix-popper-content-wrapper] {
                background-color: hsl(var(--popover)) !important;
            }

            /* Action button dropdown specific styles */
            .dark .yoopta-action-menu-list-content .yoo-action-menu-item {
                background-color: transparent !important;
                color: hsl(var(--popover-foreground)) !important;
            }

            .dark .yoopta-action-menu-list-content .yoo-action-menu-item:hover {
                background-color: hsl(var(--accent)) !important;
                color: hsl(var(--accent-foreground)) !important;
            }

            .dark .yoopta-action-menu-list-content .yoo-action-menu-item-icon {
                color: hsl(var(--muted-foreground)) !important;
            }

            .dark .yoopta-action-menu-list-content .yoo-action-menu-item:hover .yoo-action-menu-item-icon {
                color: hsl(var(--accent-foreground)) !important;
            }

            /* Dropdown menu portal containers */
            .dark [data-radix-popper-content-wrapper] > div {
                background-color: hsl(var(--popover)) !important;
                border: 1px solid hsl(var(--border)) !important;
                border-radius: 6px !important;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
            }

            /* Button text colors in dropdowns */
            .dark .yoopta-action-menu-list-content button,
            .dark .yoo-code-text-popover-foreground button {
                color: hsl(var(--popover-foreground)) !important;
            }

            .dark .yoopta-action-menu-list-content button:hover,
            .dark .yoo-code-text-popover-foreground button:hover {
                color: hsl(var(--accent-foreground)) !important;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    const toggleReadOnly = () => {
        setBIsReadOnly(!bIsReadOnly);
        console.log('read only', bIsReadOnly);
    };

    return (
        <div className="min-h-screen py-8 px-2 bg-background text-foreground">
            <h2 className="text-2xl font-bold mb-4 text-center text-foreground">Markdown Editor</h2>

            {/* Button Section - Always Centered */}
            <div className="mt-4 flex justify-center gap-4 flex-wrap">
                <Button
                    onClick={deserializeHTML}
                    variant="outline"
                    className="border-primary text-primary hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    Import HTML
                </Button>
                <Button 
                    onClick={serializeHTML}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    Export HTML
                </Button>
                <Button
                    onClick={deserializeMarkdown}
                    variant="outline"
                    className="border-primary text-primary hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    Import Markdown
                </Button>
                <Button 
                    onClick={serializeMarkdown}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    Export Markdown
                </Button>
                <Button
                    onClick={toggleReadOnly}
                    className="bg-muted text-muted-foreground border border-primary hover:bg-muted/80 hover:text-foreground transition-colors"
                >
                    Toggle Read Only
                </Button>
            </div>

            

            {/* Editor Section - Takes Full Width but Stays Centered */}
            {!showPreview && (
                <div className="mt-8 flex justify-center">
                    <div
                        className="w-full flex justify-center rounded-xl shadow-md bg-card border border-border py-6 px-2"
                        style={{ maxWidth: editorWidth }}
                    >
                        <YooptaEditor
                            width="100%"
                            key={bIsReadOnly.toString()}
                            value={value}
                            editor={editor}
                            plugins={plugins}
                            marks={MARKS}
                            readOnly={bIsReadOnly}
                            autoFocus={true}
                            tools={TOOLS}
                            onChange={onEditorChange}
                        />
                    </div>
                </div>
            )}
        </div>
    );
    
    
}


export default Editor;