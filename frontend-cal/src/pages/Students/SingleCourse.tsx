import React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useFetchCoursesWithAuthQuery,
  useFetchModulesWithAuthQuery,
} from '../../store/apiService'

interface Module {
  id: number
  title: string
  sequence: number
}

const SingleCourse = () => {
  const { courseId } = useParams() // Get courseId from route params

  // Fetch all courses to get course details
  const {
    data: courseData,
    isLoading: courseLoading,
    error: courseError,
  } = useFetchCoursesWithAuthQuery()

  // Fetch modules for the specific course
  const {
    data: moduleData,
    isLoading: moduleLoading,
    error: moduleError,
  } = useFetchModulesWithAuthQuery(courseId ? parseInt(courseId, 10) : 0)

  if (courseLoading || moduleLoading) {
    return <p>Loading course and modules...</p>
  }

  if (courseError) {
    return (
      <p>
        Error fetching course:{' '}
        {courseError instanceof Error ? courseError.message : 'Unknown error'}
      </p>
    )
  }

  if (moduleError) {
    return (
      <p>
        Error fetching modules:{' '}
        {moduleError instanceof Error ? moduleError.message : 'Unknown error'}
      </p>
    )
  }

  // Find the specific course details
  const course = courseData?.results?.find(
    (c) => c.course_id === (courseId ? parseInt(courseId, 10) : 0)
  )

  if (!course) {
    return <p>Course not found!</p>
  }

  const defaultImage =
    'https://i.pinimg.com/originals/24/12/bc/2412bc5c012e7360f602c13a92901055.jpg'

  // Modules data
  const modules = moduleData?.results || []
  console.log('modules', modules)
  console.log("courseID",courseId)

  return (
    <div className='flex h-full justify-between'>
      {/* Left Section: Background Image with Course Info */}
      <div
        className='flex h-full w-1/2 flex-col justify-end bg-cover bg-center p-8 text-white'
        style={{
          backgroundImage: `url('${course.image || defaultImage}')`,
        }}
      >
        <h1 className='mb-2 text-4xl font-bold'>{course.name}</h1>
        <h2 className='text-2xl'>{course.description}</h2>
      </div>

      {/* Right Section: Modules Table */}
      <div className='h-full w-1/2 bg-white p-4'>
        <div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
          <h1 className='text-xl font-semibold text-gray-700'>
            Course Modules
          </h1>
        </div>
        <div className='custom-scroll overflow-auto px-6 py-4'>
          <Table>
            <TableCaption>All modules of this course.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[100px]'>ID</TableHead>
                <TableHead>Module Title</TableHead>
                <TableHead className='text-right'>Description</TableHead>
                <TableHead className='text-right'>Created At</TableHead>
                <TableHead className='text-right'>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module: Module) => (
                <TableRow key={module.id}>
                  <TableCell className='font-medium'>
                    {module.module_id}
                  </TableCell>
                  <TableCell>{module.title}</TableCell>
                  <TableCell className='text-right'>
                    {module.description}
                  </TableCell>
                  <TableCell className='text-right'>
                    {new Date(module.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className='text-right'>
                    <Link
                      to={`/singleCourse/${courseId}/${module.module_id}`}
                      className='inline-block w-full rounded bg-gray-800 px-4 py-2 text-center text-white'
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export default SingleCourse
