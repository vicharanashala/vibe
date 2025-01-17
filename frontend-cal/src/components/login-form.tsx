import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useLoginMutation } from '../store/apiService'
import { setUser } from '../store/slices/authSlice'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate } from 'react-router-dom'

interface LoginFormProps extends React.ComponentPropsWithoutRef<'form'> {
  toggleCover: () => void
}

export function LoginForm({
  className,
  toggleCover,
  ...props
}: LoginFormProps) {
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [login, { isLoading, error }] = useLoginMutation()
  const client_id = 'vgkais5eGt2s7QlNyxeL1z9NbPsnqCp81eXPlSMj'
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await login({ email, password, client_id }).unwrap()
      console.log(email, password, client_id)
      dispatch(setUser(response))
      navigate('/allCourses')
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  return (
    <form
      className={cn('flex flex-col gap-6', className)}
      onSubmit={handleLogin}
      {...props}
    >
      <div className='flex flex-col items-center gap-2 text-center'>
        <h1 className='text-2xl font-bold'>Welcome Back !</h1>
        <p className='text-balance text-sm text-muted-foreground'>
          Enter your Username below to login to your account
        </p>
      </div>
      <div className='grid gap-6'>
        <div className='grid gap-2'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            type='email'
            placeholder='example@example.com'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
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
          />
        </div>
        <Button type='submit' className='w-full' disabled={isLoading}>
          Login
        </Button>
        {error && (
          <p className='text-red-500'>
            Error: {'status' in error ? error.status : error.message}
          </p>
        )}
        <div className='relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border'>
          <span className='relative z-10 bg-background px-2 text-muted-foreground'>
            Or continue with
          </span>
        </div>
        <Button variant='outline' className='w-full'>
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
        </Button>
      </div>
      <div className='text-center text-sm'>
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
      </div>
    </form>
  )
}
