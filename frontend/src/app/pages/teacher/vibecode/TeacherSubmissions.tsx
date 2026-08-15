import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';

type GroupedSubmissions = Record<string, {
  displayName: string;
  email: string;
  submissions: any[];
}>;

export default function TeacherSubmissions() {
  const { token } = useAuthStore();
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<{code: string, language: string} | null>(null);

  useEffect(() => {
    fetch('http://localhost:3141/api/vibecode/teacher/submissions', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      const submissions = Array.isArray(data) ? data.filter(s => !s.isRun) : [];
      setAllSubmissions(submissions);
      setIsLoading(false);
    })
    .catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, [token]);

  const groupedStudents = useMemo(() => {
    const grouped: GroupedSubmissions = {};
    allSubmissions.forEach(s => {
      const studentId = s.studentId || 'unknown_id';
      if (!grouped[studentId]) {
        let name = '';
        if (s.studentFirstName) name += s.studentFirstName;
        if (s.studentLastName) name += (name ? ' ' : '') + s.studentLastName;
        
        const displayName = name.trim() || 'Unknown Student';

        grouped[studentId] = {
          displayName,
          email: '', // Deprecated: Kept for type compatibility but not used
          submissions: []
        };
      }
      grouped[studentId].submissions.push(s);
    });
    return grouped;
  }, [allSubmissions]);

  const filteredStudentIds = useMemo(() => {
    return Object.keys(groupedStudents).filter(id => {
      const student = groupedStudents[id];
      const q = searchQuery.toLowerCase();
      return student.displayName.toLowerCase().includes(q);
    });
  }, [groupedStudents, searchQuery]);

  const toggleStudent = (studentId: string) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
    } else {
      setExpandedStudentId(studentId);
    }
  };

  const getPassRatio = (outputStr: string) => {
    if (!outputStr) return null;
    try {
      const results = JSON.parse(outputStr);
      if (!Array.isArray(results)) return null;
      const passedCount = results.filter(r => r.passed).length;
      return `${passedCount}/${results.length}`;
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">VibeCode Submissions Tracking</h1>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
               <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-blue-500 bg-white dark:bg-[#252526] text-sm"
            placeholder="Search by Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 font-medium bg-white dark:bg-[#1e1e1e] rounded-lg shadow border border-gray-200 dark:border-gray-800">
            Loading submissions...
          </div>
        ) : filteredStudentIds.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-white dark:bg-[#1e1e1e] rounded-lg shadow border border-gray-200 dark:border-gray-800">
            No students found matching "{searchQuery}"
          </div>
        ) : (
          filteredStudentIds.map(studentId => {
            const student = groupedStudents[studentId];
            const isExpanded = expandedStudentId === studentId;
            return (
              <div key={studentId} className="bg-white dark:bg-[#1e1e1e] rounded-lg shadow border border-gray-200 dark:border-gray-800 overflow-hidden transition-all">
                <div 
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 select-none"
                  onClick={() => toggleStudent(studentId)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center font-bold text-lg">
                      {student.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{student.displayName}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-semibold">
                      {student.submissions.length} Submissions
                    </span>
                    <svg 
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-800 overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="p-4 font-semibold text-gray-500 text-sm">Problem</th>
                          <th className="p-4 font-semibold text-gray-500 text-sm">Status</th>
                          <th className="p-4 font-semibold text-gray-500 text-sm">Timestamp</th>
                          <th className="p-4 font-semibold text-gray-500 text-sm">Language</th>
                          <th className="p-4 font-semibold text-gray-500 text-sm">Code</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {student.submissions.map(s => {
                          const passRatio = getPassRatio(s.output);
                          return (
                          <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="p-4">{s.problemTitle || 'Unknown Problem'}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-semibold
                                ${s.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                                  s.status === 'Wrong Answer' ? 'bg-red-100 text-red-700' :
                                  s.status === 'Memory Limit Exceeded' ? 'bg-purple-100 text-purple-700' :
                                  s.status === 'Time Limit Exceeded' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                {s.status} {passRatio && s.status !== 'Accepted' && s.status !== 'Compilation Error' ? `(${passRatio})` : ''}
                              </span>
                              {s.runtimeMs !== undefined && s.runtimeMs !== null && (
                                <div className="text-xs text-gray-500 mt-1 font-mono">Runtime: {s.runtimeMs} ms</div>
                              )}
                            </td>
                            <td className="p-4 text-gray-500 text-sm">{new Date(s.createdAt).toLocaleString()}</td>
                            <td className="p-4 text-sm text-gray-500">{s.language}</td>
                            <td className="p-4">
                              <button onClick={() => setSelectedCode({code: s.code, language: s.language})} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                                View Code
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-lg">Submitted Code</h3>
              <button onClick={() => setSelectedCode(null)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto bg-gray-50 dark:bg-[#151515] rounded-b-xl">
              <pre className="text-sm font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-300">
                {selectedCode.code}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
