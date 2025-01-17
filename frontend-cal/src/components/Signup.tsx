// src/components/Signup.tsx

import React, { useState } from 'react'
import { useSignupMutation } from '../store/apiService'

const Signup: React.FC = () => {
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [last_name, setLast_name] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [signup, { isLoading, error }] = useSignupMutation()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
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

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-100'>
      <div className='w-full max-w-md space-y-6 rounded bg-white p-8 shadow-md'>
        <h2 className='text-center text-2xl font-bold'>Signup</h2>
        <form onSubmit={handleSignup} className='space-y-4'>
          <input
            type='text'
            placeholder='First Name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          <input
            type='text'
            placeholder='Last Name'
            value={last_name}
            onChange={(e) => setLast_name(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          <input
            type='text'
            placeholder='Username'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          <input
            type='email'
            placeholder='Email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          <input
            type='password'
            placeholder='Password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className='w-full rounded border px-3 py-2 text-black'
          />
          <button
            type='submit'
            disabled={isLoading}
            className='w-full rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50'
          >
            Signup
          </button>
        </form>
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
