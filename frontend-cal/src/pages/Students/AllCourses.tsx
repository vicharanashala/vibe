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
  const [filter, setFilter] = useState('Completed') // Default filter

  // Fetch courses from API
  const { data, error, isLoading } = useFetchCoursesWithAuthQuery()

  if (isLoading) {
    return <p>Loading courses...</p>
  }

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
    'https://i.pinimg.com/originals/24/12/bc/2412bc5c012e7360f602c13a92901055.jpg'

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

  const courseData: MappedCourse[] =
    data?.results.map((course: Course) => ({
      id: course.course_id,
      title: course.name,
      image: course.image || defaultImage,
      status: course.enrolled ? 'On going' : 'Completed',
    })) || []

  // Filtered courses based on selected filter
  const filteredCourses =
    filter === 'All'
      ? courseData
      : courseData.filter((course) => course.status === filter)

  return (
    <div className='p-4'>
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

      {/* Courses Grid */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {filteredCourses.map((course) => (
          <Card key={course.id} className='w-full'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle>{course.title}</CardTitle>
                {/* Status Badge */}
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
