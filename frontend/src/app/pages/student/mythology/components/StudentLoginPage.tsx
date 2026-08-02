import React, { useState } from 'react';
import { User, Shield, GraduationCap, ArrowRight, Award } from 'lucide-react';

interface StudentLoginPageProps {
  onLogin: (username: string, details: { department: string; track: string; avatar: string }, passcode: string) => void;
}

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Metallurgical & Materials Engineering',
  'Physics & Mathematics'
];

const TRACKS = [
  { id: 'vibe-github-tutorial', name: 'GitHub Version Control' },
  { id: 'vibe-typescript', name: 'TypeScript Core Foundations' },
  { id: 'vibe-react', name: 'React & TSX Development' },
  { id: 'vibe-express', name: 'Express Scalable API Backends' },
  { id: 'vibe-mongo-db', name: 'MongoDB & Schema Modeling' }
];

const AVATARS = ['🎓', '⚔️', '🛡️', '👑', '🔮', '📜', '🧙‍♂️', '🚀', '🤖', '👾'];

export const StudentLoginPage: React.FC<StudentLoginPageProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [track, setTrack] = useState(TRACKS[0].id);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setError('Name must be at least 2 characters long.');
      return;
    }

    if (!/^[a-zA-Z0-9 _\-]{2,30}$/.test(cleanName)) {
      setError('Name can only contain letters, numbers, spaces, hyphens, and underscores.');
      return;
    }

    if (passcode.length < 4) {
      setError('Passcode must be at least 4 characters long.');
      return;
    }

    onLogin(cleanName, { department, track, avatar: selectedAvatar }, passcode);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Mystical Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute -left-48 -bottom-48 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-48 -top-48 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(99,102,241,0.1)] relative z-10">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center shadow-lg shadow-indigo-500/30 mb-4 animate-pulse">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-100 tracking-wide">
            ViBe Platform
          </h1>
          <p className="text-xs text-indigo-400 font-mono tracking-widest uppercase mt-1">
            IIT Ropar Vicharanashala Lab
          </p>
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent my-4" />
          <p className="text-sm text-slate-400 font-serif italic">
            "Enter the Chronicles of Vikram & Betaal. Set your learning vows and log your daily streaks."
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              Student Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Vikramaditya"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              maxLength={30}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-serif"
            />
          </div>

          {/* Secure Passcode Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Secure Passcode
            </label>
            <input
              type="password"
              required
              placeholder="Enter PIN or Password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError('');
              }}
              maxLength={50}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
            />
            <p className="text-[10px] text-slate-500 italic">This securely encrypts your local progress.</p>
          </div>

          {/* Department Select */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5" />
              Academic Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept} className="bg-slate-900 text-slate-300">
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Track Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Learning Quest Track
            </label>
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-300">
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Avatar Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <Award className="w-3.5 h-3.5" />
              Select Mythological Avatar
            </label>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`w-full aspect-square text-xl rounded-xl flex items-center justify-center transition-all ${
                    selectedAvatar === avatar
                      ? 'bg-indigo-600/30 border-2 border-indigo-500 scale-105 shadow-md shadow-indigo-500/20'
                      : 'bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/60'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-xs text-rose-400 font-mono bg-rose-950/20 border border-rose-500/30 rounded-xl p-3">
              ⚠️ {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-serif font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] mt-6"
          >
            Enter the Chronicles of ViBe
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
