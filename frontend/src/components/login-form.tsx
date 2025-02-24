/**
 * LoginForm Component
 *
 * This component renders a login form that allows users to log into their account.
 * It provides email and password input fields, a login button, and error handling.
 *
 * Features:
 * - Collects email and password inputs and manages their state.
 * - Handles login submission using Firebase Authentication
 * - Displays loading state on the login button to prevent multiple submissions.
 * - Handles errors and displays an error message if the login attempt fails.
 * - Includes a "Forgot your password?" button (logic for it can be added later).
 * - A Google login button is available for users to log in via their Google account.
 * - A "Sign up" link redirects users to a sign-up form if they don't have an account.
 * - After successful login, user data is stored in Redux, and the user is redirected to the `/course-view` page.
 *
 * Props:
 * - `className`: A string that can be passed to customize the form's CSS classes.
 * - `toggleCover`: A function that toggles between the login and sign-up forms.
 *
 * State:
 * - `email`: Tracks the value of the email input field.
 * - `password`: Tracks the value of the password input field.
 * - `isLoading`: Indicates whether the login request is in progress (disables the login button).
 * - `error`: Stores any error message if the login fails.
 */

import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { setUser } from '../store/slices/authSlice'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import Cookies from 'js-cookie'
import axios from 'axios'

// Props interface for LoginForm component
interface LoginFormProps extends React.ComponentPropsWithoutRef<'form'> {
  toggleCover: () => void
}

export function LoginForm({
  className,
  toggleCover,
  ...props
}: LoginFormProps) {
  // State management for form inputs
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redux dispatch and navigation hooks
  const dispatch = useDispatch()
  const navigate = useNavigate()

  // Handle form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!email || !password) {
      setError('Please enter both email and password')
      setIsLoading(false)
      return
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      )
      console.log('User credential:', userCredential)
      const user = userCredential.user
      console.log('User:', user)
      console.log('user_id', user.uid)
      console.log('User email:', user.accessToken)
      Cookies.set('user_id', user.uid)
      Cookies.set('access_token', user.accessToken)
      // try {
      //   await axios.post('http://192.168.1.15:8000/token', {
      //     access_token: user.accessToken,
      //   })
      //   console.log('Token sent successfully')
      // } catch (err) {
      //   console.error('Failed to send token:', err)
      // }

      if (!user.email) {
        throw new Error('No email found')
      }

      // Update Redux store with user data
      dispatch(
        setUser({
          id: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0], // Fallback to email username if no display name
        })
      )

      // Redirect to courses page on success
      navigate('/')
    } catch (err: any) {
      setError('Invalid email or password. Please try again.')
      console.error('Login failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      if (!user.email) {
        throw new Error('No email found from Google login')
      }
      console.log('User:', user)

      // Update Redux store with user data
      dispatch(
        setUser({
          id: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
        })
      )

      navigate('/')
    } catch (err: any) {
      setError('Failed to login with Google. Please try again.')
      console.error('Google login failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      className={cn('flex flex-col gap-6', className)}
      onSubmit={handleLogin}
      {...props}
    >
      {/* Header section */}
      <div className='flex flex-col items-center gap-2 text-center'>
        <h1 className='text-2xl font-bold'>Welcome Back !</h1>
        <p className='text-balance text-sm text-muted-foreground'>
          Enter your Username below to login to your account
        </p>
      </div>

      {/* Form fields container */}
      <div className='grid gap-6'>
        {/* Email input field */}
        <div className='grid gap-2'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            type='email'
            placeholder='example@example.com'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password input field */}
        <div className='grid gap-2'>
          <div className='flex items-center'>
            <Label htmlFor='password'>Password</Label>
            <button
              type='button'
              className='ml-auto text-sm underline-offset-4 hover:underline'
              onClick={() => {
                // Add your forgot password logic here
              }}
            >
              Forgot your password?
            </button>
          </div>
          <Input
            id='password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Login button */}
        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>

        {/* Error message display */}
        {error && <p className='text-sm text-red-500'>{error}</p>}

        {/* Divider with text */}
        {/* <div className='relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border'>
          <span className='relative z-10 bg-background px-2 text-muted-foreground'>
            Or continue with
          </span>
        </div> */}

        {/* Google login button */}
        {/* <Button
          type='button'
          variant='outline'
          className='w-full'
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 48 48'
            width='24px'
            height='24px'
          >
            <path
              fill='#4285F4'
              d='M24 9.5c3.9 0 6.6 1.6 8.1 2.9l6-6C34.7 2.7 29.9 0 24 0 14.6 0 6.8 5.8 3.3 14.1l7.1 5.5C12.2 13.1 17.5 9.5 24 9.5z'
            />
            <path
              fill='#34A853'
              d='M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v8.1h12.7c-.5 2.7-2 5-4.2 6.5l6.5 5.1c3.8-3.5 6-8.6 6-15.6z'
            />
            <path
              fill='#FBBC05'
              d='M10.4 28.6c-1.1-3.3-1.1-6.9 0-10.2L3.3 13c-2.4 4.8-2.4 10.4 0 15.2l7.1-5.6z'
            />
            <path
              fill='#EA4335'
              d='M24 48c6.5 0 12-2.1 16-5.7l-6.5-5.1c-2.4 1.6-5.4 2.6-9.5 2.6-6.5 0-12-4.3-14-10.2l-7.1 5.5C6.8 42.2 14.6 48 24 48z'
            />
            <path fill='none' d='M0 0h48v48H0z' />
          </svg>
          Login with Google
        </Button> */}
      </div>

      {/* Sign up link */}
      {/* <div className='text-center text-sm'>
        Don&apos;t have an account?{' '}
        <button
          onClick={(e) => {
            e.preventDefault()
            toggleCover()
          }}
          className='underline underline-offset-4'
        >
          Sign up
        </button>
      </div> */}
    </form>
  )
}
