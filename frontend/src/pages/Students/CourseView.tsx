/**
 * Course View Page
 *
 * This component displays a grid of available courses for students with filtering capabilities.
 * It fetches course data from an API and allows filtering between ongoing and completed courses.
 *
 * Features:
 * - Responsive grid layout of course cards
 * - Filter dropdown to show All/Ongoing/Completed courses
 * - Course cards with images, titles and status badges
 * - Loading and error states for API requests
 * - Links to individual course pages
 *
 * Layout Structure:
 * - Header with title and filter dropdown
 * - Grid of course cards (1/2/3 columns based on screen size)
 * - Each card shows:
 *   - Course title
 *   - Status badge (yellow for ongoing, gray for completed)
 *   - Course image
 *   - View button linking to course details
 */

import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'

interface Course {
  course_id: string
  name: string
  image?: string
}

interface CourseStatus {
  [key: string]: 'IN_PROGRESS' | 'COMPLETED' | 'UNKNOWN'
}

// Custom hook to fetch course statuses
function useFetchCourseStatuses(courses: Course[]) {
  const [statuses, setStatuses] = useState<CourseStatus>({})

  useEffect(() => {
    courses.forEach((course) => {
      fetchCourseStatus(course.course_id).then((status) => {
        setStatuses((prevStatuses) => ({
          ...prevStatuses,
          [course.course_id]: status,
        }))
      })
    })
  }, [courses])

  // Simulate an API call to fetch status
  async function fetchCourseStatus(
    courseId: string
  ): Promise<'IN_PROGRESS' | 'COMPLETED' | 'UNKNOWN'> {
    // This should be replaced with a real API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('IN_PROGRESS') // Simulated status
      }, 1000) // Simulate network delay
    })
  }

  return statuses
}

const CourseView = () => {
  const dispatch = useDispatch()
  const [filter, setFilter] = useState<'All' | 'IN_PROGRESS' | 'COMPLETED'>(
    'IN_PROGRESS'
  )

  const courses = useSelector((state) => state.courses.courses ?? null)
  const isLoading = useSelector((state) => state.courses.isLoading ?? true)
  const error = useSelector((state) => state.courses.error ?? null)

  const courseStatuses = useFetchCourseStatuses(courses || [])

  useEffect(() => {
    console.log('Courses:', courses)
    if (!courses || courses.length === 0) {
      console.log('Dispatching fetchCoursesWithAuth')
      dispatch(fetchCoursesWithAuth())
    }
  }, [dispatch, courses])

  if (isLoading) return <p>Loading courses...</p>
  if (error) {
    return <p>Error loading courses: {error}</p>
  }

  const filteredCourses = courses
    ? courses.filter(
        (course) =>
          filter === 'All' || courseStatuses[course.course_id] === filter
      )
    : []

  return (
    <div className='p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='mb-4 text-2xl font-bold uppercase'>All Courses</h1>
        <div className='mb-6'>
          <Select
            onValueChange={(value) =>
              setFilter(value as 'All' | 'IN_PROGRESS' | 'COMPLETED')
            }
            defaultValue='IN_PROGRESS'
          >
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Filter by status' />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Filter</SelectLabel>
                <SelectItem value='All'>All</SelectItem>
                <SelectItem value='IN_PROGRESS'>On going</SelectItem>
                <SelectItem value='COMPLETED'>Completed</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {filteredCourses.map((course) => (
          <Card key={course.course_id} className='w-full'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle>{course.name}</CardTitle>
                <div
                  className={`flex w-20 justify-center rounded-sm p-1 text-xs text-white ${
                    courseStatuses[course.course_id] === 'IN_PROGRESS'
                      ? 'bg-yellow-500'
                      : 'bg-gray-500'
                  }`}
                >
                  {courseStatuses[course.course_id] || 'Loading...'}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <img
                src={
                  course.image ||
                  'https://excellentia.org.in/images/courses.jpg'
                }
                alt={course.name}
                className='h-40 w-full rounded object-cover'
              />
            </CardContent>
            <div className='p-4 text-center'>
              <Link
                to={`/module-view/${course.course_id}`}
                className='inline-block w-full rounded bg-gray-800 px-4 py-2 text-center text-white'
              >
                View
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default CourseView
