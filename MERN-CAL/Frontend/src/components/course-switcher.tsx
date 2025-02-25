'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, GalleryVerticalEnd } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'

export function CourseSwitcher({
  onCourseSelect, // Callback function for course selection
}: {
  onCourseSelect: (courseId: string) => void // Function type definition
}) {
  const [selectedCourse, setSelectedCourse] = React.useState('String')
  const [selectedCourseName, setSelectedCourseName] = React.useState('Select')

  const handleCourseSelect = (courseId: string, courseName: string) => {
    setSelectedCourse(courseId)
    onCourseSelect(courseId, courseName) // Notify parent component
  }

  const dispatch = useDispatch()

  const courses = useSelector((state) => state.courses.courses ?? [])
  const isLoading = useSelector((state) => state.courses.isLoading ?? true)
  const error = useSelector((state) => state.courses.error ?? null)

  React.useEffect(() => {
    if (!courses || courses.length === 0) {
      dispatch(fetchCoursesWithAuth())
    }
  }, [dispatch, courses])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                <GalleryVerticalEnd className='size-4' />
              </div>
              <div className='flex flex-col gap-0.5 leading-none'>
                <span className='font-semibold'>Select Course</span>
                <span className=''>{selectedCourseName}</span>
              </div>
              <ChevronsUpDown className='ml-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width]'
            align='start'
          >
            {courses.map((course) => (
              <DropdownMenuItem
                key={course.course_id}
                onSelect={() => {
                  handleCourseSelect(course.course_id, course.name)
                  setSelectedCourseName(course.name)
                }}
              >
                {course.name}{' '}
                {course.course_id === selectedCourse && (
                  <Check className='ml-auto' />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
