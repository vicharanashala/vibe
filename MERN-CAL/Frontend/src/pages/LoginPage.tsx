/**
 * LoginPage Component
 *
 * A responsive login/signup page with an animated sliding cover effect.
 * The page is split into two sections - login and signup forms, with a sliding
 * cover that transitions between them.
 *
 * Features:
 * - Split screen layout with login and signup forms
 * - Responsive design that adapts to different screen sizes
 * - Animated sliding cover effect when switching between forms
 * - Consistent branding with CAL logo on both sides
 * - Mobile-friendly layout adjustments
 *
 * Layout Structure:
 * - Two column grid layout on large screens
 * - Each column contains:
 *   - Header with CAL logo
 *   - Centered form container
 *   - Login form on left side
 *   - Signup form on right side
 * - Sliding cover overlay that moves between sections
 *
 * State:
 * - coverLeft: Boolean to control the position of sliding cover
 */

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
          {/* <div className='flex flex-col gap-4 p-6 md:p-10'>
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
          </div> */}
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
