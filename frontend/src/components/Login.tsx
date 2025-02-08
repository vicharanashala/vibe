/**
 * Login Component
 *
 * This component provides a user authentication interface with a login form.
 * It manages username and password inputs, handles form submission, and displays errors.
 *
 * Features:
 * - Username and password input fields with state management
 * - Form submission handling with API integration using RTK Query
 * - Loading state management during authentication
 * - Error display for failed login attempts
 * - Redux integration for user state management
 * - Responsive design with Tailwind CSS styling
 *
 * State:
 * - username: Tracks the username input value
 * - password: Tracks the password input value
 * - isLoading: Indicates if login request is in progress
 * - error: Stores any authentication errors
 */

import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useLoginMutation } from '../store/apiServices/apiServicesLMS'
import { setUser } from '../store/slices/authSlice'

const Login: React.FC = () => {
  // State management for form inputs
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')

  // RTK Query hook for login mutation
  const [login, { isLoading, error }] = useLoginMutation()

  // Redux dispatch hook
  const dispatch = useDispatch()

  // Handle form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Attempt login and unwrap the response
      const response = await login({ username, password }).unwrap()
      // Update Redux store with user data
      dispatch(setUser(response))
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  return (
    // Main container with centered content
    <div className='flex min-h-screen items-center justify-center bg-gray-100'>
      {/* Login card container */}
      <div className='w-full max-w-md space-y-6 rounded bg-white p-8 shadow-md'>
        <h2 className='text-center text-2xl font-bold'>Login</h2>
        {/* Login form */}
        <form onSubmit={handleLogin} className='space-y-4'>
          {/* Username input field */}
          <div>
            <input
              type='text'
              placeholder='Username'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className='w-full rounded border px-3 py-2 focus:border-blue-300 focus:outline-none focus:ring'
            />
          </div>
          {/* Password input field */}
          <div>
            <input
              type='password'
              placeholder='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='w-full rounded border px-3 py-2 focus:border-blue-300 focus:outline-none focus:ring'
            />
          </div>
          {/* Submit button */}
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
        {/* Error message display */}
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
