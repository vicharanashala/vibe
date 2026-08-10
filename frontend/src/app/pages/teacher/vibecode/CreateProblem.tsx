import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth-store';
import { useBreadcrumbStore } from '@/store/breadcrumb-store';
import { CodeEditor } from '@/components/CodeEditor';

export default function CreateProblem() {
  const navigate = useNavigate();
  const { problemId } = useParams({ strict: false }) as { problemId?: string };
  const { token } = useAuthStore();
  const setDynamicLabel = useBreadcrumbStore(state => state.setDynamicLabel);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  
  const [testCases, setTestCases] = useState([
    { input: '', expectedOutput: '', isHidden: false }
  ]);
  
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['javascript', 'typescript', 'python', 'java', 'cpp']);
  const [activeTab, setActiveTab] = useState('javascript');
  const [templates, setTemplates] = useState<Record<string, { studentBoilerplate: string, executionWrapper: string }>>({
    javascript: { studentBoilerplate: '', executionWrapper: '' },
    typescript: { studentBoilerplate: '', executionWrapper: '' },
    python: { studentBoilerplate: '', executionWrapper: '' },
    java: { studentBoilerplate: '', executionWrapper: '' },
    cpp: { studentBoilerplate: '', executionWrapper: '' }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!problemId);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!problemId) return;
    
    const fetchProblem = async () => {
      try {
        const res = await fetch(`http://localhost:3141/api/vibecode/problems/${problemId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch problem');
        
        const data = await res.json();
        setTitle(data.title);
        
        if (problemId) {
          setDynamicLabel(problemId, data.title);
        }

        setDescription(data.description);
        setDifficulty(data.difficulty);
        setTestCases(data.testCases?.length ? data.testCases : [{ input: '', expectedOutput: '', isHidden: false }]);
        setSelectedLanguages(data.supportedLanguages || ['javascript']);
        if (data.supportedLanguages?.length > 0) {
          setActiveTab(data.supportedLanguages[0]);
        }
        
        const newTemplates = { ...templates };
        data.templates?.forEach((t: any) => {
          newTemplates[t.language] = {
            studentBoilerplate: t.studentBoilerplate || '',
            executionWrapper: t.executionWrapper || ''
          };
        });
        setTemplates(newTemplates);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProblem();
  }, [problemId, token]);

  const addTestCase = () => {
    setTestCases([...testCases, { input: '', expectedOutput: '', isHidden: false }]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        const parseCSVLine = (line: string) => {
          const result = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
              inQuotes = !inQuotes;
            } else if (line[i] === ',' && !inQuotes) {
              result.push(cur);
              cur = '';
            } else {
              cur += line[i];
            }
          }
          result.push(cur);
          return result.map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        };

        const newCases = [];
        let startIdx = 0;
        
        if (lines.length > 0) {
          const header = parseCSVLine(lines[0]);
          if (header[0]?.toLowerCase().includes('input')) {
            startIdx = 1;
          }
        }
        
        for (let i = startIdx; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length >= 2) {
            // Replace literal '\n' sequences in CSV with actual newlines
            newCases.push({
              input: cols[0].replace(/\\n/g, '\n'),
              expectedOutput: cols[1].replace(/\\n/g, '\n'),
              isHidden: cols[2]?.toLowerCase() === 'true'
            });
          }
        }
        
        if (newCases.length > 0) {
          setTestCases(prev => {
            // If the only existing test case is empty, replace it
            if (prev.length === 1 && prev[0].input === '' && prev[0].expectedOutput === '') {
              return newCases;
            }
            return [...prev, ...newCases];
          });
          alert(`Successfully loaded ${newCases.length} test cases!`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const removeTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (index: number, field: string, value: any) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };

  const updateTemplate = (language: string, field: 'studentBoilerplate' | 'executionWrapper', value: string) => {
    setTemplates({
      ...templates,
      [language]: {
        ...templates[language],
        [field]: value
      }
    });
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => {
      const next = prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang];
      if (next.length > 0 && !next.includes(activeTab)) {
        setActiveTab(next[0]);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Transform templates dictionary into the array format our backend expects
    const templatesArray = ['javascript', 'typescript', 'python', 'java', 'cpp']
      .filter(lang => templates[lang].studentBoilerplate.trim() !== '' || templates[lang].executionWrapper.trim() !== '')
      .map(lang => ({
        language: lang,
        studentBoilerplate: templates[lang].studentBoilerplate,
        executionWrapper: templates[lang].executionWrapper
      }));

    try {
      const url = problemId 
        ? `http://localhost:3141/api/vibecode/problems/${problemId}` 
        : 'http://localhost:3141/api/vibecode/problems';
      
      const res = await fetch(url, {
        method: problemId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          difficulty,
          testCases,
          templates: templatesArray,
          supportedLanguages: templatesArray.map(t => t.language),
          timeLimitMs: 3000,
          memoryLimitMb: 256
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to ${problemId ? 'update' : 'create'} problem`);
      }

      alert(`Problem ${problemId ? 'updated' : 'created'} successfully!`);
      if (problemId) {
        navigate({ to: '/teacher/vibecode/problems' });
      } else {
        // Reset form
        setTitle('');
      setDescription('');
      setDifficulty('Easy');
      setTestCases([{ input: '', expectedOutput: '', isHidden: false }]);
      setSelectedLanguages(['javascript', 'typescript', 'python', 'java', 'cpp']);
      setActiveTab('javascript');
      setTemplates({
        javascript: { studentBoilerplate: '', executionWrapper: '' },
        typescript: { studentBoilerplate: '', executionWrapper: '' },
        python: { studentBoilerplate: '', executionWrapper: '' },
        java: { studentBoilerplate: '', executionWrapper: '' },
        cpp: { studentBoilerplate: '', executionWrapper: '' }
      });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 max-w-5xl mx-auto">Loading problem details...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center mb-8 gap-4">
        <button 
          onClick={() => navigate({ to: '/teacher/vibecode/problems' })}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          title="Back to Problems"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {problemId ? 'Edit VibeCode Problem' : 'Create VibeCode Problem'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Problem Title</label>
              <input 
                required 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-[#2d2d2d] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Two Sum"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
              <select 
                value={difficulty} 
                onChange={e => setDifficulty(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-[#2d2d2d] focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Markdown Supported)</label>
              <textarea 
                required 
                rows={6}
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-[#2d2d2d] focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                placeholder="Describe the problem here..."
              />
            </div>
          </div>
        </div>

        {/* Test Cases */}
        <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Test Cases</h2>
            <div className="flex space-x-3">
              <label className="text-sm bg-gray-50 text-gray-700 border border-gray-300 dark:border-gray-700 dark:text-gray-300 px-3 py-1.5 rounded font-medium hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer">
                <span>Upload CSV</span>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
              <button 
                type="button" 
                onClick={addTestCase}
                className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded font-medium hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
              >
                + Add Test Case
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {testCases.map((tc, idx) => (
              <div key={idx} className="flex gap-4 p-4 border border-gray-200 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-[#252526] relative">
                <button type="button" onClick={() => removeTestCase(idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="flex-1 space-y-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Input</label>
                  <textarea 
                    required 
                    rows={2} 
                    value={tc.input} 
                    onChange={e => updateTestCase(idx, 'input', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-[#1e1e1e] font-mono text-sm focus:ring-1 outline-none"
                    placeholder="[2,7,11,15]\n9"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Expected Output</label>
                  <textarea 
                    required 
                    rows={2} 
                    value={tc.expectedOutput} 
                    onChange={e => updateTestCase(idx, 'expectedOutput', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-[#1e1e1e] font-mono text-sm focus:ring-1 outline-none"
                    placeholder="[0,1]"
                  />
                </div>
                <div className="w-32 flex flex-col justify-center space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={tc.isHidden} 
                      onChange={e => updateTestCase(idx, 'isHidden', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">Hidden Case</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Code Templates */}
        <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Language Support & Templates</h2>
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Language to Edit</label>
              <select 
                value={activeTab}
                onChange={e => setActiveTab(e.target.value)}
                className="w-64 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-[#2d2d2d] focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6 h-96">
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-2 flex items-center space-x-1">
                <span>Student Boilerplate</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-1 rounded">(Starting code)</span>
              </label>
              <div className="flex-1 border rounded overflow-hidden relative">
                <CodeEditor 
                  language={activeTab} 
                  code={templates[activeTab].studentBoilerplate}
                  onChange={(val) => updateTemplate(activeTab, 'studentBoilerplate', val || '')}
                  height="100%"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold mb-2 flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <span>Execution Wrapper</span>
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-1 rounded">(Hidden Execution Engine)</span>
                </div>
              </label>
              <div className="flex-1 border rounded overflow-hidden relative">
                <CodeEditor 
                  language={activeTab} 
                  code={templates[activeTab].executionWrapper}
                  onChange={(val) => updateTemplate(activeTab, 'executionWrapper', val || '')}
                  height="100%"
                />
                {!templates[activeTab].executionWrapper && (
                  <div className="absolute inset-0 pointer-events-none p-4 text-gray-400 opacity-50 font-mono text-sm whitespace-pre-wrap">
                    {`// Write the hidden runner code here.\n// IMPORTANT: Include a placeholder {{STUDENT_CODE}} where the student's boilerplate will be injected.\n\n// Example for JavaScript:\n\n{{STUDENT_CODE}}\n\n// Run the function and log output:\nconsole.log(JSON.stringify(twoSum(inputNums, inputTarget)));`}
                  </div>
                )}
              </div>
            </div>
          </div>
    </div>

        <div className="flex justify-end pt-4 space-x-4">
          {problemId && (
            <button 
              type="button" 
              onClick={() => navigate({ to: '/teacher/vibecode/problems' })}
              className="px-6 py-2.5 bg-gray-200 text-gray-800 font-semibold rounded hover:bg-gray-300 transition-all shadow-sm"
            >
              Cancel
            </button>
          )}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 transition-all shadow-sm"
          >
            {isSubmitting ? 'Saving...' : problemId ? 'Update Problem' : 'Publish Problem'}
          </button>
        </div>
      </form>
    </div>
  );
}
