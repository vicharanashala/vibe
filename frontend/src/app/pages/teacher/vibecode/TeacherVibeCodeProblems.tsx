import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth-store';

export default function TeacherVibeCodeProblems() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [problems, setProblems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProblems = async () => {
    try {
      const res = await fetch('http://localhost:3141/api/vibecode/teacher/problems', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch problems');
      const data = await res.json();
      setProblems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, [token]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to completely delete the problem "${title}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:3141/api/vibecode/problems/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to delete problem');
      
      // Refresh list
      fetchProblems();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (isLoading) return <div className="p-8">Loading problems...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">VibeCode Problems</h1>
        <Link 
          to="/teacher/vibecode/create"
          className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          + Create New Problem
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {problems.length === 0 ? (
        <div className="text-center p-12 bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <h2 className="text-xl font-bold mb-2">No problems found</h2>
          <p className="text-gray-500 mb-6">You haven't created any VibeCode problems yet.</p>
          <Link 
            to="/teacher/vibecode/create"
            className="bg-blue-600 text-white px-6 py-2.5 rounded font-semibold hover:bg-blue-700 inline-block"
          >
            Create Your First Problem
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-[#252526] border-b border-gray-200 dark:border-gray-800 text-gray-500 text-sm uppercase">
              <tr>
                <th className="p-4 font-semibold">Title</th>
                <th className="p-4 font-semibold">Difficulty</th>
                <th className="p-4 font-semibold">Test Cases</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {problems.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-[#252526]/50 transition-colors group">
                  <td className="p-4">
                    <Link to={`/teacher/vibecode/edit/${p._id}`} className="font-semibold text-lg text-blue-600 hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.difficulty || 'Easy'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 font-medium text-sm">
                    {p.testCases?.length || 0} cases
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => navigate({ to: `/teacher/vibecode/edit/${p._id}` })}
                        className="p-2 text-gray-500 hover:text-blue-600 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-300"
                        title="Edit Problem"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button 
                        onClick={() => handleDelete(p._id, p.title)}
                        className="p-2 text-gray-500 hover:text-red-600 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-red-300"
                        title="Delete Problem"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
