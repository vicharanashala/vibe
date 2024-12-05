// src/components/Login.tsx

import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLoginMutation } from '../store/apiService';
import { setUser } from '../store/slices/authSlice';

const Login: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [login, { isLoading, error }] = useLoginMutation();
  const dispatch = useDispatch();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await login({ username, password }).unwrap();
      dispatch(setUser(response));
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          type="username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={isLoading}>
          Login
        </button>

      </form>
      {error && <p>Error: {error.message}</p>}
    </div>
  );
};

export default Login;
