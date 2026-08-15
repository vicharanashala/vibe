import React, { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth-store';
const dummyProblems = [
  { _id: '64b5f92d4f1a2c3d4e5f6001', title: 'Two Sum', difficulty: 'Easy' },
  { _id: '64b5f92d4f1a2c3d4e5f6002', title: 'Add Two Numbers', difficulty: 'Medium' },
  { _id: '64b5f92d4f1a2c3d4e5f6003', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium' },
  { _id: '64b5f92d4f1a2c3d4e5f6004', title: 'Median of Two Sorted Arrays', difficulty: 'Hard' }
];

export default function VibeCodeMain() {
  const { token } = useAuthStore();
  const [problems, setProblems] = useState<any[]>(dummyProblems);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:3141/api/vibecode/problems', { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
      fetch('http://localhost:3141/api/vibecode/submissions/solved', { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json())
    ])
    .then(([problemsData, solvedData]) => {
      if (Array.isArray(problemsData)) {
        setProblems([...dummyProblems, ...problemsData]);
      }
      if (Array.isArray(solvedData)) {
        setSolvedIds(new Set(solvedData));
      }
      setIsLoading(false);
    })
    .catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, [token]);

  const filteredProblems = problems.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">VibeCode Problems</h1>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[#252526] text-sm"
            placeholder="Search problems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="bg-white dark:bg-[#1e1e1e] rounded-lg shadow border border-gray-200 dark:border-gray-800">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 font-medium">Loading problems...</div>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-4 font-semibold text-gray-500">Title</th>
                <th className="p-4 font-semibold text-gray-500">Difficulty</th>
                <th className="p-4 font-semibold text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
            {filteredProblems.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-500">No problems found matching "{searchQuery}"</td>
              </tr>
            ) : filteredProblems.map(p => (
              <tr key={p._id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="p-4 font-medium flex items-center space-x-2">
                  <span>{p.title}</span>
                  {solvedIds.has(p._id) && (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold
                    ${p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                    {p.difficulty}
                  </span>
                </td>
                <td className="p-4">
                  <Link 
                    to={`/student/vibecode/${p._id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Solve
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
