import React from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface CodeEditorProps {
  language: string;
  code: string;
  onChange: (value: string | undefined) => void;
  height?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ language, code, onChange, height = '400px' }) => {
  const monaco = useMonaco();

  React.useEffect(() => {
    if (monaco) {
      // You can define custom themes or configure monaco here
    }
  }, [monaco]);

  const mapLanguage = (lang: string) => {
    const l = lang.toLowerCase();
    if (l === 'c++' || l === 'cpp') return 'cpp';
    return l;
  };

  return (
    <div className="border rounded-md overflow-hidden bg-[#1e1e1e] w-full h-full">
      <Editor
        height={height}
        language={mapLanguage(language)}
        theme="vs-dark"
        value={code}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 }
        }}
      />
    </div>
  );
};
