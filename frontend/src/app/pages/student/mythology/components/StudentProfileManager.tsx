import React, { useState, useEffect } from 'react';
import { User, UserPlus, LogOut, Award, ChevronDown, AlertTriangle } from 'lucide-react';

/** Only allow safe alphanumeric usernames (no HTML/script injection possible) */
const USERNAME_REGEX = /^[a-zA-Z0-9 _\-]{2,40}$/;

/** Safely parse localStorage value. Returns null on any failure. */
function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    // Must be a plain object, not an array or primitive
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

interface StudentProfileManagerProps {
  currentUser: string | null;
  onSwitchUser: (username: string) => void;
  onLogout: () => void;
}

export const StudentProfileManager: React.FC<StudentProfileManagerProps> = ({ currentUser, onSwitchUser, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [newUsername, setNewUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    // Safely load profiles — discard corrupt data
    const stored = safeParseJSON<Record<string, any>>(localStorage.getItem('vibe_profiles'));
    if (stored) {
      // Strip any keys that aren't valid usernames to prevent XSS from stored data
      const sanitized: Record<string, any> = {};
      for (const key of Object.keys(stored)) {
        if (USERNAME_REGEX.test(key)) {
          sanitized[key] = stored[key];
        }
      }
      setProfiles(sanitized);
    }
  }, [isOpen]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    const cleanName = newUsername.trim();

    // Strict validation — reject anything that doesn't match our safe pattern
    if (!USERNAME_REGEX.test(cleanName)) {
      setValidationError('Name must be 2–40 chars: letters, numbers, spaces, - or _ only.');
      return;
    }

    if (Object.keys(profiles).some(k => k.toLowerCase() === cleanName.toLowerCase())) {
      setValidationError('This student name is already registered!');
      return;
    }

    onSwitchUser(cleanName);
    setNewUsername('');
    setIsRegistering(false);
    setIsOpen(false);
  };

  const handleSelectProfile = (username: string) => {
    // Re-validate even existing profile keys before trusting them
    if (!USERNAME_REGEX.test(username)) return;
    onSwitchUser(username);
    setIsOpen(false);
  };

  return (
    <div className="relative z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/50 text-indigo-100 hover:bg-indigo-900 hover:text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] backdrop-blur-md"
      >
        <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span className="text-xs font-serif font-bold tracking-wide">
          {currentUser ? currentUser : "Guest"}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          <div className="p-4 border-b border-indigo-500/20 bg-indigo-950/20">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <User className="w-4 h-4" />
              Student Profiles
            </h3>
            <p className="text-[10px] text-indigo-200/60 mt-1 font-mono">
              Switch between registered learners.
            </p>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {Object.entries(profiles).length === 0 && !isRegistering && (
              <div className="p-4 text-center text-xs text-slate-400 font-mono">
                No students registered yet.
              </div>
            )}

            {Object.entries(profiles).map(([username, state]) => (
              <button
                key={username}
                onClick={() => handleSelectProfile(username)}
                className={`w-full flex items-center justify-between p-3 border-b border-slate-800/50 hover:bg-indigo-900/20 transition-all text-left ${
                  currentUser === username ? 'bg-indigo-500/10 border-l-2 border-l-indigo-400' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200">{username}</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                      <span className="flex items-center gap-0.5 text-amber-400"><Award className="w-3 h-3" /> {(state as any).karmaPoints || 0}</span>
                      <span>🔥 {(state as any).currentStreak || 0} Streak</span>
                    </div>
                  </div>
                </div>
                {currentUser === username && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">Active</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-3 bg-slate-950 border-t border-slate-800">
            {isRegistering ? (
              <form onSubmit={handleRegister} className="space-y-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Student Name..."
                  value={newUsername}
                  onChange={(e) => { setNewUsername(e.target.value); setValidationError(''); }}
                  maxLength={40}
                  pattern="[a-zA-Z0-9 _\-]{2,40}"
                  className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 transition-colors ${
                    validationError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                />
                {validationError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-rose-400 font-mono">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                    Register
                  </button>
                  <button type="button" onClick={() => { setIsRegistering(false); setValidationError(''); }} className="px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsRegistering(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-lg transition-colors border border-slate-700"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  New Student
                </button>
                {currentUser && (
                  <button
                    onClick={() => {
                      onLogout();
                      setIsOpen(false);
                    }}
                    className="px-3 flex items-center justify-center bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 text-xs font-bold rounded-lg transition-colors border border-rose-500/20"
                    title="Log Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
