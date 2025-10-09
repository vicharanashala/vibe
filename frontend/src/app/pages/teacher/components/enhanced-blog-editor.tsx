import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Edit,
  FileText,
  Clock,
  Star,
  Loader2,
  X
} from "lucide-react";
import { useUpdateCourseItem } from '@/hooks/hooks';
import { toast } from 'sonner';
import YooptaEditor, { createYooptaEditor, YooptaContentValue } from '@yoopta/editor';
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

interface EnhancedBlogEditorProps {
  blogId: string | null;
  courseId: string;
  courseVersionId: string;
  moduleId: string;
  sectionId: string;
  selectedItemName: string;
  isLoading: boolean;
  details: any;
  onDelete: () => void;
  onRefetch?: () => void;
}

interface BlogFormData {
  name: string;
  description: string;
  content: string;
  points: string;
  estimatedReadTimeInMinutes: number;
}

const EnhancedBlogEditor: React.FC<EnhancedBlogEditorProps> = ({
  isLoading,
  blogId,
  courseVersionId,
  selectedItemName,
  details,
  onDelete,
  onRefetch,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalForm, setOriginalForm] = useState<BlogFormData | null>(null);
  const [blogForm, setBlogForm] = useState<BlogFormData>({
    name: '',
    description: '',
    content: '',
    points: '2.0',
    estimatedReadTimeInMinutes: 0,
  });

  const editor = useMemo(() => createYooptaEditor(), []);
  const [editorValue, setEditorValue] = useState<YooptaContentValue>();
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const focusEditor = () => {
    if (!editor || !isEditMode) return;
    
    try {
      const editorElement = editorContainerRef.current?.querySelector('[data-yoopta-editor] [contenteditable="true"]') as HTMLElement;
      if (editorElement) {
        editorElement.focus();
        
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(editorElement);
          range.collapse(false);
          selection.addRange(range);
        }
      }
    } catch (error) {
      console.error('Error focusing editor:', error);
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isEditMode) return;
    
    if (e.target === e.currentTarget || 
        (e.target as Element).classList.contains('yoopta-editor-container')) {
      e.preventDefault();
      e.stopPropagation();
      focusEditor();
    }
  };

  useEffect(() => {
    if (editor && !editorValue) {
      try {
        const emptyValue = markdown.deserialize(editor, '');
        setEditorValue(emptyValue);
        editor.setEditorValue(emptyValue);
      } catch (error) {
        console.error('Error initializing editor:', error);
      }
    }
  }, [editor, editorValue]);

  useEffect(() => {
    const applyDarkModeStyles = () => {
      const style = document.createElement('style');
      style.id = 'yoopta-dark-mode-styles';
      style.textContent = `
        /* Force dark mode styles for Yoopta Editor text content */
        .dark [data-yoopta-editor] .yoopta-editor-content,
        .dark [data-yoopta-editor] .yoopta-editor-content *,
        .dark [data-yoopta-editor] .yoopta-paragraph,
        .dark [data-yoopta-editor] .yoopta-heading,
        .dark [data-yoopta-editor] .yoopta-blockquote,
        .dark [data-yoopta-editor] .yoopta-code,
        .dark [data-yoopta-editor] .yoopta-link,
        .dark [data-yoopta-editor] p,
        .dark [data-yoopta-editor] h1,
        .dark [data-yoopta-editor] h2,
        .dark [data-yoopta-editor] h3,
        .dark [data-yoopta-editor] strong,
        .dark [data-yoopta-editor] em,
        .dark [data-yoopta-editor] span {
          color: #ffffff !important;
        }
        
        /* Comprehensive toolbar dark mode styles */
        .dark [data-yoopta-editor] .yoopta-toolbar,
        .dark [data-yoopta-editor] .yoopta-toolbar *,
        .dark .yoopta-toolbar,
        .dark .yoopta-toolbar *,
        .dark [data-yoopta-editor] .yoopta-toolbar-container,
        .dark .yoopta-toolbar-container,
        .dark [data-yoopta-editor] .yoopta-toolbar-container *,
        .dark .yoopta-toolbar-container *,
        .dark [data-yoopta-editor] [class*="toolbar"],
        .dark [class*="toolbar"],
        .dark [data-yoopta-editor] [class*="Toolbar"],
        .dark [class*="Toolbar"],
        .dark [data-yoopta-editor] [class*="yoopta-toolbar"],
        .dark [class*="yoopta-toolbar"] {
          background-color: #1f2937 !important;
          color: #ffffff !important;
          border-color: #374151 !important;
        }
        
        .dark [data-yoopta-editor] .yoopta-toolbar button,
        .dark .yoopta-toolbar button,
        .dark [data-yoopta-editor] .yoopta-toolbar-container button,
        .dark .yoopta-toolbar-container button,
        .dark [data-yoopta-editor] [class*="toolbar"] button,
        .dark [class*="toolbar"] button,
        .dark [data-yoopta-editor] [class*="Toolbar"] button,
        .dark [class*="Toolbar"] button,
        .dark [data-yoopta-editor] [class*="yoopta-toolbar"] button,
        .dark [class*="yoopta-toolbar"] button {
          background-color: #1f2937 !important;
          color: #ffffff !important;
          border-color: #374151 !important;
        }
        
        .dark [data-yoopta-editor] .yoopta-toolbar button:hover,
        .dark .yoopta-toolbar button:hover,
        .dark [data-yoopta-editor] .yoopta-toolbar-container button:hover,
        .dark .yoopta-toolbar-container button:hover,
        .dark [data-yoopta-editor] [class*="toolbar"] button:hover,
        .dark [class*="toolbar"] button:hover,
        .dark [data-yoopta-editor] [class*="Toolbar"] button:hover,
        .dark [class*="Toolbar"] button:hover,
        .dark [data-yoopta-editor] [class*="yoopta-toolbar"] button:hover,
        .dark [class*="yoopta-toolbar"] button:hover {
          background-color: #374151 !important;
          color: #ffffff !important;
        }
        
        /* Floating toolbar specific styling */
        .dark [data-yoopta-editor] .yoopta-toolbar[data-yoopta-toolbar="true"],
        .dark .yoopta-toolbar[data-yoopta-toolbar="true"],
        .dark [data-yoopta-editor] .yoopta-toolbar[data-yoopta-toolbar="true"] *,
        .dark .yoopta-toolbar[data-yoopta-toolbar="true"] *,
        .dark [data-yoopta-editor] [data-yoopta-toolbar="true"],
        .dark [data-yoopta-toolbar="true"],
        .dark [data-yoopta-editor] [data-yoopta-toolbar="true"] *,
        .dark [data-yoopta-toolbar="true"] * {
          background-color: #1f2937 !important;
          color: #ffffff !important;
          border: 1px solid #374151 !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3) !important;
        }
        
        /* Force override any white backgrounds */
        .dark [data-yoopta-editor] *[style*="background-color: white"],
        .dark [data-yoopta-editor] *[style*="background-color: #fff"],
        .dark [data-yoopta-editor] *[style*="background-color: #ffffff"],
        .dark [class*="toolbar"] *[style*="background-color: white"],
        .dark [class*="toolbar"] *[style*="background-color: #fff"],
        .dark [class*="toolbar"] *[style*="background-color: #ffffff"] {
          background-color: #1f2937 !important;
          color: #ffffff !important;
        }
        
        /* Action menu dark mode styles */
        .dark [data-yoopta-editor] .yoopta-action-menu,
        .dark [data-yoopta-editor] .yoopta-action-menu *,
        .dark .yoopta-action-menu,
        .dark .yoopta-action-menu * {
          background-color: #1f2937 !important;
          color: #ffffff !important;
          border-color: #374151 !important;
        }
        
        .dark [data-yoopta-editor] .yoopta-action-menu-item,
        .dark .yoopta-action-menu-item {
          background-color: #1f2937 !important;
          color: #ffffff !important;
        }
        
        .dark [data-yoopta-editor] .yoopta-action-menu-item:hover,
        .dark .yoopta-action-menu-item:hover {
          background-color: #374151 !important;
          color: #ffffff !important;
        }
        
        /* Selection highlight dark mode */
        .dark [data-yoopta-editor] ::selection,
        .dark .yoopta-editor-container ::selection {
          background-color: #3b82f6 !important;
          color: #ffffff !important;
        }
        
        /* Code block dark mode */
        .dark [data-yoopta-editor] .yoopta-code,
        .dark .yoopta-code {
          background-color: #1f2937 !important;
          color: #ffffff !important;
          border-color: #374151 !important;
        }
        
        /* Inline code styling */
        [data-yoopta-editor] code,
        [data-yoopta-editor] .yoopta-code-mark,
        [data-yoopta-editor] [data-yoopta-mark="code"],
        code,
        .yoopta-code-mark,
        [data-yoopta-mark="code"] {
          background-color: #f1f5f9 !important;
          color: #1e293b !important;
          padding: 0.125rem 0.25rem !important;
          border-radius: 0.25rem !important;
          font-family: 'Courier New', monospace !important;
          font-size: 0.875em !important;
        }
        
        /* Inline code dark mode */
        .dark [data-yoopta-editor] code,
        .dark [data-yoopta-editor] .yoopta-code-mark,
        .dark [data-yoopta-editor] [data-yoopta-mark="code"],
        .dark code,
        .dark .yoopta-code-mark,
        .dark [data-yoopta-mark="code"] {
          background-color: #374151 !important;
          color: #f3f4f6 !important;
          padding: 0.125rem 0.25rem !important;
          border-radius: 0.25rem !important;
          font-family: 'Courier New', monospace !important;
          font-size: 0.875em !important;
        }
        
        /* Blockquote dark mode */
        .dark [data-yoopta-editor] .yoopta-blockquote {
          border-left-color: #374151 !important;
          background-color: #1f2937 !important;
          color: #ffffff !important;
        }
        
        /* Link dark mode */
        .dark [data-yoopta-editor] .yoopta-link {
          color: #3b82f6 !important;
        }
        
        /* Focus styles */
        .dark [data-yoopta-editor] .yoopta-editor:focus,
        .dark .yoopta-editor:focus {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px !important;
        }
        
        /* Placeholder text */
        .dark [data-yoopta-editor] .yoopta-editor::placeholder,
        .dark .yoopta-editor::placeholder {
          color: #6b7280 !important;
        }

        /* Make the entire editor container clickable */
        .yoopta-editor-container {
          cursor: text;
        }
        
        .yoopta-editor-container:not(.edit-mode) {
          cursor: default;
        }
      `;
      
      const existingStyle = document.getElementById('yoopta-dark-mode-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      document.head.appendChild(style);
    };

    applyDarkModeStyles();

    const timeoutId = setTimeout(applyDarkModeStyles, 100);

    const observer = new MutationObserver((mutations) => {
      let shouldReapply = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.classList.contains('yoopta-toolbar') || 
                  element.querySelector('.yoopta-toolbar') ||
                  element.getAttribute('data-yoopta-toolbar') ||
                  element.classList.toString().includes('toolbar')) {
                shouldReapply = true;
              }
            }
          });
        }
      });
      
      if (shouldReapply) {
        setTimeout(applyDarkModeStyles, 50);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-yoopta-toolbar']
    });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      const styleToRemove = document.getElementById('yoopta-dark-mode-styles');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, []);

  const updateItem = useUpdateCourseItem();

  useEffect(() => {
    if (details?.item) {
      const item = details.item;
      const blogData = item.blogDetails || item.details || {};
      
      const newFormData = {
        name: item.name || '',
        description: item.description || '',
        content: blogData.content || '',
        points: blogData.points || '2.0',
        estimatedReadTimeInMinutes: blogData.estimatedReadTimeInMinutes || 0,
      };
      
      setBlogForm(newFormData);
      
      if (!isEditMode) {
        setOriginalForm(newFormData);
      }

      if (blogData.content) {
        try {
          const deserializedValue = markdown.deserialize(editor, blogData.content);
          setEditorValue(deserializedValue);
          editor.setEditorValue(deserializedValue);
        } catch (error) {
          console.error('Error deserializing content:', error);
          const plainTextValue = markdown.deserialize(editor, blogData.content);
          setEditorValue(plainTextValue);
          editor.setEditorValue(plainTextValue);
        }
      } else {
        const emptyValue = markdown.deserialize(editor, '');
        setEditorValue(emptyValue);
        editor.setEditorValue(emptyValue);
      }
    }
  }, [details, editor]);

  useEffect(() => {
    if (isEditing && editor) {
      const currentValue = editor.getEditorValue();
      if (currentValue) {
        setEditorValue(currentValue);
      } else {
        const emptyValue = markdown.deserialize(editor, '');
        setEditorValue(emptyValue);
        editor.setEditorValue(emptyValue);
      }
    }
  }, [isEditing, editor]);

  const handleEdit = () => {
    setOriginalForm({ ...blogForm });
    setIsEditMode(true);
    setTimeout(() => {
      focusEditor();
    }, 100);
  };

  const handleCancel = () => {
    if (originalForm) {
      setBlogForm(originalForm);
      if (originalForm.content) {
        try {
          const deserializedValue = markdown.deserialize(editor, originalForm.content);
          setEditorValue(deserializedValue);
          editor.setEditorValue(deserializedValue);
        } catch (error) {
          console.error('Error reverting editor content:', error);
        }
      }
    }
    setIsEditMode(false);
  };

  const handleSave = async () => {
    if (!blogId || !courseVersionId) {
      toast.error('Missing required data for saving');
      return;
    }

    setIsSaving(true);
    try {
      setOriginalForm(null);
      const editorData = editor.getEditorValue();
      const markdownContent = markdown.serialize(editor, editorData);

      const updatedBlogData = {
        name: blogForm.name,
        description: blogForm.description,
        type: 'BLOG' as const,
        details: {
          content: markdownContent,
          points: blogForm.points,
          estimatedReadTimeInMinutes: blogForm.estimatedReadTimeInMinutes,
        },
      };

      await updateItem.mutateAsync({
        params: {
          path: {
            versionId: courseVersionId,
            itemId: blogId,
          },
        },
        body: updatedBlogData,
      });

      if (onRefetch) {
        onRefetch();
      }

      toast.success('Blog article saved successfully!');
      setIsEditMode(false);
    } catch (error) {
      console.error('Error saving blog:', error);
      toast.error('Failed to save blog article');
    } finally {
      setIsSaving(false);
    }
  };


  const calculateReadTime = (content: string): number => {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  };

  const convertHTMLToMarkdown = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    let markdown = '';
    
    const processNode = (node: Node, isListItem: boolean = false): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        
        switch (tagName) {
          case 'h1':
            return `# ${element.textContent || ''}\n\n`;
          case 'h2':
            return `## ${element.textContent || ''}\n\n`;
          case 'h3':
            return `### ${element.textContent || ''}\n\n`;
          case 'h4':
            return `#### ${element.textContent || ''}\n\n`;
          case 'h5':
            return `##### ${element.textContent || ''}\n\n`;
          case 'h6':
            return `###### ${element.textContent || ''}\n\n`;
          case 'p':
            const pContent = Array.from(element.childNodes)
              .map(child => processNode(child, isListItem))
              .join('');
            return isListItem ? pContent : `${pContent}\n\n`;
          case 'ul':
            const ulContent = Array.from(element.children)
              .map(li => {
                const liText = Array.from(li.childNodes)
                  .map(child => processNode(child, true))
                  .join('');
                return `- ${liText}`;
              })
              .join('\n');
            return `${ulContent}\n\n`;
          case 'ol':
            const olContent = Array.from(element.children)
              .map((li, index) => {
                const liText = Array.from(li.childNodes)
                  .map(child => processNode(child, true))
                  .join('');
                return `${index + 1}. ${liText}`;
              })
              .join('\n');
            return `${olContent}\n\n`;
          case 'li':
            const liContent = Array.from(element.childNodes)
              .map(child => processNode(child, true))
              .join('');
            return liContent;
          case 'strong':
          case 'b':
            return `**${element.textContent || ''}**`;
          case 'em':
          case 'i':
            return `*${element.textContent || ''}*`;
          case 'code':
            return `\`${element.textContent || ''}\``;
          case 'blockquote':
            return `> ${element.textContent || ''}\n\n`;
          case 'br':
            return '\n';
          case 'hr':
            return '---\n\n';
          case 'a':
            const href = element.getAttribute('href') || '';
            return `[${element.textContent || ''}](${href})`;
          case 'img':
            const src = element.getAttribute('src') || '';
            const alt = element.getAttribute('alt') || '';
            return `![${alt}](${src})`;
          case 'div':
            const divContent = Array.from(element.childNodes)
              .map(child => processNode(child, isListItem))
              .join('');
            return isListItem ? divContent : `${divContent}\n\n`;
          default:
            return Array.from(element.childNodes)
              .map(child => processNode(child, isListItem))
              .join('');
        }
      }
      
      return '';
    };
    
    Array.from(tempDiv.childNodes).forEach(node => {
      markdown += processNode(node);
    });
    
    return markdown.replace(/\n{3,}/g, '\n\n').trim();
  };

  const processStructuredContent = (text: string): string => {
    const lines = text.split('\n');
    let processedLines: string[] = [];
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.length === 0) {
        if (inList) {
          processedLines.push('');
          inList = false;
        }
        continue;
      }
      
      if (line.match(/^[•\-\*]\s+/) || line.match(/^\d+\.\s+/)) {
        if (!inList) {
          inList = true;
        }
        if (line.match(/^[•\-\*]\s+/)) {
          processedLines.push(`- ${line.replace(/^[•\-\*]\s+/, '')}`);
        } else {
          processedLines.push(line);
        }
      } else {
        if (inList) {
          processedLines.push('');
          inList = false;
        }
        
        if (line.match(/^\*\*.*:\*\*$/)) {
          processedLines.push(line);
        } else {
          processedLines.push(line);
        }
      }
    }
    
    return processedLines.join('\n');
  };

  const handleContentChange = (value: YooptaContentValue) => {
    if (!isEditMode) return;
    
    setEditorValue(value);
    const markdownContent = markdown.serialize(editor, value);
    const readTime = calculateReadTime(markdownContent);
    setBlogForm(prev => ({
      ...prev,
      estimatedReadTimeInMinutes: readTime,
    }));
  };

  const handleDirectPaste = (event: ClipboardEvent) => {
    if (!isEditMode) return;
    
    event.preventDefault();
    
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;
    
    const htmlContent = clipboardData.getData('text/html');
    const plainText = clipboardData.getData('text/plain');
    
    if (htmlContent) {
      try {
        const markdownContent = convertHTMLToMarkdown(htmlContent);
        const newContent = markdown.deserialize(editor, markdownContent);
        setEditorValue(newContent);
        editor.setEditorValue(newContent);
        
        const serializedContent = markdown.serialize(editor, newContent);
        const readTime = calculateReadTime(serializedContent);
        setBlogForm(prev => ({
          ...prev,
          estimatedReadTimeInMinutes: readTime,
        }));
        
      } catch (error) {
        console.error('Error in direct paste:', error);
        const newContent = markdown.deserialize(editor, plainText);
        setEditorValue(newContent);
        editor.setEditorValue(newContent);
        
        const serializedContent = markdown.serialize(editor, newContent);
        const readTime = calculateReadTime(serializedContent);
        setBlogForm(prev => ({
          ...prev,
          estimatedReadTimeInMinutes: readTime,
        }));
      }
    } else if (plainText) {
      const processedText = processStructuredContent(plainText);
      const newContent = markdown.deserialize(editor, processedText);
      setEditorValue(newContent);
      editor.setEditorValue(newContent);
      
      const serializedContent = markdown.serialize(editor, newContent);
      const readTime = calculateReadTime(serializedContent);
      setBlogForm(prev => ({
        ...prev,
        estimatedReadTimeInMinutes: readTime,
      }));
    }
  };


  useEffect(() => {
    const editorContainer = editorContainerRef.current;
    if (!editorContainer) return;

    const handlePasteEvent = (event: Event) => {
      handleDirectPaste(event as ClipboardEvent);
    };

    if (isEditMode) {
      editorContainer.addEventListener('paste', handlePasteEvent);
      
      const editorContent = editorContainer.querySelector('[contenteditable="true"]');
      if (editorContent) {
        editorContent.addEventListener('paste', handlePasteEvent);
      }
    }

    return () => {
      editorContainer.removeEventListener('paste', handlePasteEvent);
      const editorContent = editorContainer.querySelector('[contenteditable="true"]');
      if (editorContent) {
        editorContent.removeEventListener('paste', handlePasteEvent);
      }
    };
  }, [isEditMode, handleDirectPaste]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading blog editor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl">{selectedItemName}</CardTitle>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{blogForm.estimatedReadTimeInMinutes} min read</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    <span>{blogForm.points} points</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Blog Article
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button
                    onClick={handleSave}
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="ml-2"
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleEdit}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Update Article
                </Button>
              )}
              <Button
                onClick={onDelete}
                variant="outline"
                className="border-border bg-background ml-2"
                disabled={isEditMode}
              >
                <X className="h-3 w-3 mr-1" />
                Delete Article
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="blog-title">Title *</Label>
              <Input
                id="blog-title"
                value={blogForm.name}
                onChange={(e) => setBlogForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter blog title"
                disabled={!isEditMode}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-points">Points</Label>
              <Input
                id="blog-points"
                type="number"
                step="0.1"
                min="0"
                value={blogForm.points}
                onChange={(e) => setBlogForm(prev => ({ ...prev, points: e.target.value }))}
                placeholder="2.0"
                disabled={!isEditMode}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-description">Description *</Label>
            <Textarea
              id="blog-description"
              value={blogForm.description}
              onChange={(e) => setBlogForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter blog description"
              rows={3}
              disabled={!isEditMode}             
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Content *</Label>
            <div className="border border-border rounded-lg overflow-hidden">
              <div 
                ref={editorContainerRef}
                className={` overflow-y-auto yoopta-editor-container ${isEditMode ? 'cursor-text edit-mode' : 'pointer-events-none'}`}
                data-yoopta-editor="true"
                onClick={handleContainerClick}
              >
                <YooptaEditor
                  key={`editor-${blogId}-${isEditMode}`}
                  width="100%"
                  value={editorValue}
                  editor={editor}
                  plugins={plugins}
                  marks={MARKS}
                  autoFocus={false}
                  tools={isEditMode ? TOOLS : {}}
                  onChange={handleContentChange}
                  className={`prose prose-sm max-w-none dark:prose-invert p-4 text-foreground ${!isEditMode ? 'opacity-80' : ''}`}
                  readOnly={!isEditMode}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Rich text editor with markdown support</span>
              <span>Estimated read time: {blogForm.estimatedReadTimeInMinutes} minutes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedBlogEditor;
