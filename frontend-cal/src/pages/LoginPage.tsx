import React, { useState } from 'react'
import { GalleryVerticalEnd } from 'lucide-react'
import { LoginForm } from '@/components/login-form'
import { SignUpForm } from '@/components/signup-form'

const LoginPage: React.FC = () => {
  const [coverLeft, setCoverLeft] = useState(false) // State to determine which side to cover

  const toggleCover = () => {
    setCoverLeft(!coverLeft) // Toggle between covering left and right
    console.log('Toggle coverleft', coverLeft)
  }

  return (
    <div>
      <>
        <div className='grid min-h-svh lg:grid-cols-2'>
          <div className='flex flex-col gap-4 p-6 md:p-10'>
            <div className='flex justify-center gap-2 md:justify-start'>
              <button className='flex items-center gap-2 font-medium'>
                <div className='flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground'>
                  <GalleryVerticalEnd className='size-4' />
                </div>
                CAL
              </button>
            </div>
            <div className='flex flex-1 items-center justify-center'>
              <div className='w-full max-w-xs'>
                <LoginForm toggleCover={toggleCover} />
              </div>
            </div>
          </div>
          <div className='flex flex-col gap-4 p-6 md:p-10'>
            <div className='flex justify-center gap-2 md:justify-start'>
              <button className='flex items-center gap-2 font-medium'>
                <div className='flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground'>
                  <GalleryVerticalEnd className='size-4' />
                </div>
                CAL
              </button>
            </div>
            <div className='flex flex-1 items-center justify-center'>
              <div className='w-full max-w-xs'>
                <SignUpForm toggleCover={toggleCover} />
              </div>
            </div>
          </div>
          <div
            className='window'
            style={{ left: coverLeft ? '0%' : '50%' }}
          ></div>
        </div>
      </>
    </div>
  )
}

export default LoginPage
