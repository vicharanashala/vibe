/**
 * Signup Component
 *
 * This component provides a user registration form with the following features:
 * - Collects user information (first name, last name, username, email, password)
 * - Handles form submission with error handling
 * - Provides loading state feedback
 * - Uses RTK Query mutation for API integration
 * - Responsive design with Tailwind CSS
 *
 * Form Fields:
 * - First Name: User's first name
 * - Last Name: User's last name
 * - Username: Unique username for the account
 * - Email: User's email address
 * - Password: Account password
 *
 * State Management:
 * - Uses React useState hooks for form field states
 * - Integrates with Redux using RTK Query for API calls
 * - Handles loading and error states
 *
 * Styling:
 * - Responsive layout with centered content
 * - Clean, modern UI with consistent spacing
 * - Visual feedback for form interactions
 * - Error message display
 */

// src/components/Signup.tsx

// Import required dependencies
import React, { useState } from 'react'
import { useSignupMutation } from '../store/apiService'

// Main Signup component
const Signup: React.FC = () => {
  // State variables for form fields
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [last_name, setLast_name] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  // RTK Query mutation hook for signup
  const [signup, { isLoading, error }] = useSignupMutation()

  // Handle form submission
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Call signup mutation with form data
      await signup({
        email,
        password,
        first_name: name,
        last_name: last_name,
        username: username,
      }).unwrap()
      // handle successful signup
    } catch (err) {
      console.error('Signup error:', err)
      // handle error
    }
  }

  // Render signup form
  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-100'>
      <div className='w-full max-w-md space-y-6 rounded bg-white p-8 shadow-md'>
        <h2 className='text-center text-2xl font-bold'>Signup</h2>
        <form onSubmit={handleSignup} className='space-y-4'>
          {/* First Name input field */}
          <input
            type='text'
            placeholder='First Name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          {/* Last Name input field */}
          <input
            type='text'
            placeholder='Last Name'
            value={last_name}
            onChange={(e) => setLast_name(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          {/* Username input field */}
          <input
            type='text'
            placeholder='Username'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          {/* Email input field */}
          <input
            type='email'
            placeholder='Email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          {/* Password input field */}
          <input
            type='password'
            placeholder='Password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          {/* Submit button */}
          <button
            type='submit'
            disabled={isLoading}
            className='w-full rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50'
          >
            Signup
          </button>
        </form>
        {/* Error message display */}
        {error && (
          <p className='mt-4 text-red-500'>
            Error: {'status' in error ? error.status : error.message}
          </p>
        )}
      </div>
    </div>
  )
}

export default Signup
