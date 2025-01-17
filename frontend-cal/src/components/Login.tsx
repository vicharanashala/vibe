// src/components/Login.tsx

import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useLoginMutation } from '../store/apiService'
import { setUser } from '../store/slices/authSlice'

const Login: React.FC = () => {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [login, { isLoading, error }] = useLoginMutation()
  const dispatch = useDispatch()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await login({ username, password }).unwrap()
      dispatch(setUser(response))
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-100'>
      <div className='w-full max-w-md space-y-6 rounded bg-white p-8 shadow-md'>
        <h2 className='text-center text-2xl font-bold'>Login</h2>
        <form onSubmit={handleLogin} className='space-y-4'>
          <div>
            <input
              type='text'
              placeholder='Username'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className='w-full rounded border px-3 py-2 focus:border-blue-300 focus:outline-none focus:ring'
            />
          </div>
          <div>
            <input
              type='password'
              placeholder='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='w-full rounded border px-3 py-2 focus:border-blue-300 focus:outline-none focus:ring'
            />
          </div>
          <div>
            <button
              type='submit'
              disabled={isLoading}
              className='w-full rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50'
            >
              Login
            </button>
          </div>
        </form>
        {error && (
          <p className='mt-4 text-sm text-red-500'>
            Error: {'status' in error ? error.status : error.message}
          </p>
        )}
      </div>
    </div>
  )
}

export default Login
