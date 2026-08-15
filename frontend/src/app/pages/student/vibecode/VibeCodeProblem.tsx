import React, { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { CodeEditor } from '@/components/CodeEditor';
import { useAuthStore } from '@/store/auth-store';

export default function VibeCodeProblem() {
  const { problemId } = useParams({ strict: false });
  const { token } = useAuthStore();
  const [language, setLanguage] = useState('javascript');
  
  // Dummy problem data for MVP
  const problemsData: Record<string, any> = {
    '64b5f92d4f1a2c3d4e5f6001': {
      title: 'Two Sum',
      difficulty: 'Easy',
      templates: [
        { language: 'javascript', studentBoilerplate: `var twoSum = function(nums, target) {\n    // Write your logic here\n    \n};` },
        { language: 'typescript', studentBoilerplate: `function twoSum(nums: number[], target: number): number[] {\n    // Write your logic here\n    return [];\n};` }
      ],
      description: (
        <>
          <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.</p>
          <p>You may assume that each input would have exactly one solution, and you may not use the same element twice.</p>
          <p>You can return the answer in any order.</p>
          <h4 className="mt-4 font-bold">Example 1:</h4>
          <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
            <code className="text-sm">
              <span className="font-semibold">Input:</span> nums = [2,7,11,15], target = 9{`\n`}
              <span className="font-semibold">Output:</span> [0,1]{`\n`}
              <span className="font-semibold">Explanation:</span> Because nums[0] + nums[1] == 9, we return [0, 1].
            </code>
          </pre>
        </>
      )
    },
    '64b5f92d4f1a2c3d4e5f6002': {
      title: 'Add Two Numbers',
      difficulty: 'Medium',
      templates: [
        { language: 'javascript', studentBoilerplate: `var addTwoNumbers = function(l1, l2) {\n    // Write your logic here\n    \n};` },
        { language: 'typescript', studentBoilerplate: `function addTwoNumbers(l1: ListNode | null, l2: ListNode | null): ListNode | null {\n    // Write your logic here\n    return null;\n};` }
      ],
      description: (
        <>
          <p>You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit.</p>
          <p>Add the two numbers and return the sum as a linked list.</p>
          <h4 className="mt-4 font-bold">Example 1:</h4>
          <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
            <code className="text-sm">
              <span className="font-semibold">Input:</span> l1 = [2,4,3], l2 = [5,6,4]{`\n`}
              <span className="font-semibold">Output:</span> [7,0,8]{`\n`}
              <span className="font-semibold">Explanation:</span> 342 + 465 = 807.
            </code>
          </pre>
        </>
      )
    },
    '64b5f92d4f1a2c3d4e5f6003': {
      title: 'Longest Substring Without Repeating Characters',
      difficulty: 'Medium',
      templates: [
        { language: 'javascript', studentBoilerplate: `var lengthOfLongestSubstring = function(s) {\n    // Write your logic here\n    \n};` },
        { language: 'typescript', studentBoilerplate: `function lengthOfLongestSubstring(s: string): number {\n    // Write your logic here\n    return 0;\n};` }
      ],
      description: (
        <>
          <p>Given a string <code>s</code>, find the length of the longest substring without repeating characters.</p>
          <h4 className="mt-4 font-bold">Example 1:</h4>
          <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
            <code className="text-sm">
              <span className="font-semibold">Input:</span> s = "abcabcbb"{`\n`}
              <span className="font-semibold">Output:</span> 3{`\n`}
              <span className="font-semibold">Explanation:</span> The answer is "abc", with the length of 3.
            </code>
          </pre>
        </>
      )
    },
    '64b5f92d4f1a2c3d4e5f6004': {
      title: 'Median of Two Sorted Arrays',
      difficulty: 'Hard',
      templates: [
        { language: 'javascript', studentBoilerplate: `var findMedianSortedArrays = function(nums1, nums2) {\n    // Write your logic here\n    \n};` },
        { language: 'typescript', studentBoilerplate: `function findMedianSortedArrays(nums1: number[], nums2: number[]): number {\n    // Write your logic here\n    return 0;\n};` }
      ],
      description: (
        <>
          <p>Given two sorted arrays <code>nums1</code> and <code>nums2</code> of size <code>m</code> and <code>n</code> respectively, return the median of the two sorted arrays.</p>
          <h4 className="mt-4 font-bold">Example 1:</h4>
          <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
            <code className="text-sm">
              <span className="font-semibold">Input:</span> nums1 = [1,3], nums2 = [2]{`\n`}
              <span className="font-semibold">Output:</span> 2.00000{`\n`}
              <span className="font-semibold">Explanation:</span> merged array = [1,2,3] and median is 2.
            </code>
          </pre>
        </>
      )
    }
  };

  const boilerplates: Record<string, string> = {
    javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    // Write your logic here\n    \n};`,
    python: `class Solution(object):\n    def twoSum(self, nums, target):\n        """\n        :type nums: List[int]\n        :type target: int\n        :rtype: List[int]\n        """\n        # Write your logic here\n        `,
    java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your logic here\n        \n    }\n}`,
    cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your logic here\n        \n    }\n};`
  };

  const fallbackTemplate = problemsData[problemId as string]?.templates?.find((t: any) => t.language === 'java')?.studentBoilerplate;

  const [problem, setProblem] = useState<any>(problemsData[problemId as string] || null);
  const [isLoading, setIsLoading] = useState(!problemsData[problemId as string]);
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const currentCode = codeMap[language] !== undefined 
    ? codeMap[language] 
    : (problem?.templates?.find((t: any) => t.language === language)?.studentBoilerplate || boilerplates[language] || '');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [runtimeMs, setRuntimeMs] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [lastActionWasRun, setLastActionWasRun] = useState(false);
  const submitInProgress = React.useRef(false);

  React.useEffect(() => {
    if (!problemsData[problemId as string]) {
      // Fetch dynamic problem from backend
      fetch(`http://localhost:3141/api/vibecode/problems/${problemId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (!data.message) {
          setProblem(data);
          // Set language to the first available if not already loaded from submissions
          if (data.templates && data.templates.length > 0) {
            const defaultLang = data.templates[0].language;
            setLanguage(defaultLang);
          }
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
    }
  }, [problemId, token]);

  React.useEffect(() => {
    if (!problemId || !token) return;
    fetch(`http://localhost:3141/api/vibecode/submissions/${problemId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data) && data.length > 0) {
        // Load most recent code for each language
        setCodeMap(prev => {
          const newMap = { ...prev };
          for (const sub of data) {
            if (newMap[sub.language] === undefined) {
              newMap[sub.language] = sub.code;
            }
          }
          return newMap;
        });
        
        setLanguage(data[0].language);
        setStatus(data[0].status);
        setOutput(data[0].output);
        setRuntimeMs(data[0].runtimeMs ?? null);
        
        // Check if any submission was accepted (excluding test runs)
        if (data.some((sub: any) => sub.status === 'Accepted' && !sub.isRun)) {
          setIsSolved(true);
        }
      }
    })
    .catch(err => console.error(err));
  }, [problemId, token]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  if (isLoading) return <div className="p-8">Loading problem...</div>;
  if (!problem) return <div className="p-8 text-red-500 font-bold">Problem not found!</div>;

  const handleSubmit = async (isRun = false) => {
    if (submitInProgress.current) return;
    submitInProgress.current = true;
    setLastActionWasRun(isRun);

    if (isRun) setIsRunning(true);
    else setIsSubmitting(true);

    setStatus('Evaluating...');
    setOutput('');
    setRuntimeMs(null);
    
    try {
      const response = await fetch('http://localhost:3141/api/vibecode/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          problemId: problemId,
          language: language,
          code: currentCode,
          isRun: isRun
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        setStatus('Error');
        setOutput(data.message || 'Failed to submit code');
      } else {
        setStatus(data.status);
        setOutput(data.output || data.errorDetail || 'Execution completed.');
        setRuntimeMs(data.runtimeMs ?? null);
        if (data.status === 'Accepted' && !isRun) {
          setIsSolved(true);
        }
      }
    } catch (error: any) {
      setStatus('Error');
      setOutput(error.message);
    } finally {
      setIsSubmitting(false);
      setIsRunning(false);
      submitInProgress.current = false;
    }
  };

  const renderOutput = () => {
    if (!output && status !== 'Evaluating...') return <div className="text-gray-500">Run your code to see the output here.</div>;
    if (status === 'Evaluating...') return (
      <div className="text-gray-500 flex items-center space-x-2">
        <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>Running Code...</span>
      </div>
    );
    
    let results: any[] = [];
    try {
      results = JSON.parse(output);
      if (!Array.isArray(results)) throw new Error('Not an array');
    } catch (e) {
      return (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-red-600 dark:text-red-500">{status || 'Error'}</h3>
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 p-4 rounded-md overflow-x-auto">
            {output.split('\\n').filter(Boolean).map((line, i) => (
              <div key={i} className="text-red-700 dark:text-red-400 font-mono text-sm whitespace-pre-wrap">{line}</div>
            ))}
          </div>
        </div>
      );
    }

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const isSuccess = status === 'Accepted';

    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-1 mb-2">
          <h3 className={`text-2xl font-bold ${isSuccess ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
            {status}
          </h3>
          <div className="flex items-center space-x-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {passedCount} / {totalCount} test cases passed.
            </div>
            {!lastActionWasRun && runtimeMs !== null && runtimeMs !== undefined && (
              <div className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded font-mono">
                Runtime: {runtimeMs} ms
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
        {results.map((res, i) => {
          if (res.isHidden && res.passed) return null;
          if (res.skipped) return null;

          return (
            <div key={i} className={`border rounded-md overflow-hidden shadow-sm ${res.passed ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
              <div className={`px-4 py-2 flex items-center space-x-2 border-b ${res.passed ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                {res.passed ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                )}
                <span className="font-semibold">{res.isHidden ? 'Hidden Case' : `Case ${i + 1}`}: {res.passed ? 'Accepted' : 'Failed'}</span>
              </div>
              
              {!res.isHidden ? (
                <div className="p-4 bg-white dark:bg-[#1e1e1e] space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Input</div>
                    <div className="bg-gray-100 dark:bg-[#252526] p-2 rounded text-sm font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-300">
                      {res.input.split('\\n').join(', ')}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Expected Output</div>
                    <div className="bg-gray-100 dark:bg-[#252526] p-2 rounded text-sm font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-300">
                      {res.expected}
                    </div>
                  </div>

                  {(!res.passed && res.actual) && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Your Output</div>
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/50 p-2 rounded text-sm font-mono whitespace-pre-wrap text-red-600 dark:text-red-400">
                        {res.actual}
                      </div>
                    </div>
                  )}

                  {(!res.passed && res.error) && (
                    <div>
                      <div className="text-xs font-semibold text-red-500 mb-1 uppercase tracking-wider">Error Output</div>
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/50 p-2 rounded text-sm font-mono whitespace-pre-wrap text-red-600 dark:text-red-400">
                        {res.error}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-white dark:bg-[#1e1e1e]">
                  <div className="text-red-500 font-semibold mb-2">Your code failed on a hidden test case.</div>
                  {res.error && (
                    <div>
                      <div className="text-xs font-semibold text-red-500 mb-1 uppercase tracking-wider">Error Details</div>
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/50 p-2 rounded text-sm font-mono whitespace-pre-wrap text-red-600 dark:text-red-400">
                        {res.error}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full">
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-800 p-6 overflow-y-auto bg-white dark:bg-[#17171a]">
        <Link to="/student/vibecode" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline mb-4 font-medium transition-colors">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Problems
        </Link>
        <h2 className="text-2xl font-bold mb-2 flex items-center space-x-2">
          <span>{problem.title}</span>
          {isSolved && (
            <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </h2>
        <span className={`px-2 py-1 rounded text-xs font-semibold mb-6 inline-block ${
          problem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
          problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {problem.difficulty}
        </span>
        {isSolved && (
          <span className="ml-2 px-2 py-1 rounded text-xs font-semibold mb-6 inline-block bg-green-100 text-green-700 border border-green-200">
            Solved
          </span>
        )}
        <div className="prose dark:prose-invert mt-4 text-sm whitespace-pre-wrap font-sans">
          {problem.description}
        </div>

        {problem.testCases && problem.testCases.length > 0 && (
          <div className="mt-8 space-y-6">
            {problem.testCases.map((tc: any, idx: number) => (
              <div key={idx}>
                <h4 className="font-bold mb-2 text-sm text-gray-800 dark:text-gray-200">Example {idx + 1}:</h4>
                <pre className="bg-gray-100 dark:bg-[#252526] p-3 rounded-md border border-gray-200 dark:border-gray-800 overflow-x-auto break-words whitespace-pre-wrap">
                  <code className="text-sm font-mono">
                    <div className="mb-1"><span className="font-semibold text-gray-700 dark:text-gray-400">Input:</span> <span className="text-gray-900 dark:text-gray-300">{tc.input}</span></div>
                    <div><span className="font-semibold text-gray-700 dark:text-gray-400">Output:</span> <span className="text-gray-900 dark:text-gray-300">{tc.expectedOutput}</span></div>
                  </code>
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-2/3 flex flex-col bg-gray-50 dark:bg-[#1e1e1e]">
        <div className="p-2 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#252526]">
          <select 
            value={language}
            onChange={handleLanguageChange}
            className="p-1.5 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
          >
            {problem.templates && problem.templates.map((t: any) => (
              <option key={t.language} value={t.language}>
                {t.language === 'cpp' ? 'C++' : t.language === 'javascript' ? 'JavaScript' : t.language === 'typescript' ? 'TypeScript' : t.language}
              </option>
            ))}
          </select>
          <div className="flex space-x-2">
            <button 
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || isRunning}
              className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-4 focus:ring-gray-300/50 dark:focus:ring-gray-700/50 disabled:opacity-50 text-sm transition-all shadow-sm flex items-center space-x-1"
            >
              {isRunning ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                  <span>Run Code</span>
                </>
              )}
            </button>
            <button 
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || isRunning}
              className="px-5 py-1.5 bg-green-600 text-white font-semibold rounded hover:bg-green-700 focus:ring-4 focus:ring-green-500/30 disabled:opacity-50 text-sm transition-all shadow-sm flex items-center space-x-1"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Submit Code</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          <CodeEditor 
            language={language}
            code={currentCode}
            onChange={(v) => setCodeMap(prev => ({ ...prev, [language]: v || '' }))}
            height="100%"
          />
        </div>

        <div className="h-64 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1e1e] flex flex-col shadow-inner">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 font-semibold text-sm flex items-center justify-between text-gray-500 bg-gray-50 dark:bg-[#252526]">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>Console</span>
            </div>
            {status && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm ${status === 'Accepted' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                {status}
              </span>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-[#1e1e1e]">
            {renderOutput()}
          </div>
        </div>
      </div>
    </div>
  );
}
