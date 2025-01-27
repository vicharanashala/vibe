/**
 * AllCourses
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

import { useState } from 'react'
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

import { useFetchCoursesWithAuthQuery } from '../../store/apiService'
import { Link } from 'react-router-dom'

const AllCourses = () => {
  // State for filtering courses (default to Completed)
  const [filter, setFilter] = useState('Completed')

  // Fetch courses data using RTK Query hook
  const { data, error, isLoading } = useFetchCoursesWithAuthQuery()

  // Show loading state while fetching data
  if (isLoading) {
    return <p>Loading courses...</p>
  }

  // Show error message if fetch fails
  if (error) {
    return (
      <p>
        Error loading courses:{' '}
        {'status' in error ? error.status : error.message}
      </p>
    )
  }

  // Default image URL
  const defaultImage =
    'https://excellentia.org.in/images/courses.jpg'

  // Map API response to match the expected structure
  interface Course {
    course_id: string
    name: string
    image?: string
    enrolled: boolean
  }

  interface MappedCourse {
    course_id: string
    title: string
    image: string
    status: string
  }

  // Transform API data to match component needs
  const courseData: MappedCourse[] =
    data?.results.map((course: Course) => ({
      id: course.course_id,
      title: course.name,
      image: course.image || defaultImage,
      status: course.enrolled ? 'On going' : 'Completed',
    })) || []

  // Filter courses based on selected status
  const filteredCourses =
    filter === 'All'
      ? courseData
      : courseData.filter((course) => course.status === filter)

  return (
    <div className='p-4'>
      {/* Header with title and filter */}
      <div className='flex items-center justify-between'>
        <h1 className='mb-4 text-2xl font-bold uppercase'>All Courses</h1>

        {/* Select Filter */}
        <div className='mb-6'>
          <Select
            onValueChange={(value) => setFilter(value)}
            defaultValue='On going'
          >
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Filter by status' />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Filter</SelectLabel>
                <SelectItem value='All'>All</SelectItem>
                <SelectItem value='On going'>On going</SelectItem>
                <SelectItem value='Completed'>Completed</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Responsive course grid */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {filteredCourses.map((course) => (
          <Card key={course.id} className='w-full'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle>{course.title}</CardTitle>
                {/* Status badge - yellow for ongoing, gray for completed */}
                <div
                  className={`flex w-20 justify-center rounded-sm p-1 text-xs text-white ${
                    course.status === 'On going'
                      ? 'bg-yellow-500'
                      : 'bg-gray-500'
                  }`}
                >
                  {course.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <img
                src={course.image}
                alt={course.title}
                className='h-40 w-full rounded object-cover'
              />
            </CardContent>
            <div className='p-4 text-center'>
              <Link
                to={`/singleCourse/${course.id}`}
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

export default AllCourses
