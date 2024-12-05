// src/components/Signup.tsx

import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSignupMutation } from '../store/apiService';
import { setUser } from '../store/slices/authSlice';

const Signup: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [signup, { isLoading, error }] = useSignupMutation();
  const dispatch = useDispatch();

  const handleSignup = async (e: React.FormEvent) => {
    
  };

  return (
    <div>
      <h2>Signup</h2>
      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={isLoading}>
          Signup
        </button>
      </form>
      {error && (
        <p>
          Error: {'status' in error ? error.status : error.message}
        </p>
      )}
    </div>
  );
};

export default Signup;
