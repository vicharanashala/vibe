import React, { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'
import { fetchModulesWithAuth } from '@/store/slices/fetchModulesSlice'

const ModuleView = () => {
  const { courseId } = useParams()
  const dispatch = useDispatch()
  console.log('courseId', courseId)
  const courseData = useSelector((state) => state.courses.courses)
  const courseLoading = useSelector((state) => state.courses.isLoading)
  const courseError = useSelector((state) => state.courses.error)
  console.log('courseData', courseData)
  console.log('courseId', courseId)
  console.log('courseLoading', courseLoading)
  const moduleData = useSelector(
    (state) => state.modules?.modules?.[courseId] ?? null
  )
  const moduleLoading = useSelector(
    (state) => state.modules?.isLoading ?? false
  )
  const moduleError = useSelector((state) => state.modules?.error ?? null)

  useEffect(() => {
    if (!courseData || courseData.length === 0) {
      dispatch(fetchCoursesWithAuth())
    }
  }, [dispatch, courseData.length])

  useEffect(() => {
    if (!moduleData) {
      dispatch(fetchModulesWithAuth(courseId?.toString()))
    }
  }, [dispatch, courseId, moduleData])

  if (courseLoading || moduleLoading) {
    return <p>Loading course and modules...</p>
  }

  if (courseError) {
    return <p>Error fetching course: {courseError}</p>
  }

  if (moduleError) {
    return <p>Error fetching modules: {moduleError}</p>
  }

  const course = courseData

  if (!moduleData) {
    return <p>Module not found!</p>
  }
  console.log('moduleData', moduleData)
  const defaultImage = 'https://excellentia.org.in/images/courses.jpg'
  const modules = moduleData || []

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
              {modules.map((module) => (
                <TableRow key={module.id}>
                  <TableCell className='font-medium'>
                    {modules.indexOf(module) + 1}
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
                      to={`/section-view/${courseId}/${module.module_id}`}
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

export default ModuleView
