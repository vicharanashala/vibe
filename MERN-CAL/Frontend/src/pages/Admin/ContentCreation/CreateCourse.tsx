import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCoursesWithAuth } from '@/store/slices/courseSlice'
import { Plus } from 'lucide-react'
import { AdminCourseCreation } from '@/components/AdminComponents/AdminCourseCreation'

const CreateCourse = () => {
  const dispatch = useDispatch()
  const courses = useSelector((state) => state.courses.courses ?? [])
  const isLoading = useSelector((state) => state.courses.isLoading ?? true)
  const error = useSelector((state) => state.courses.error ?? null)

  // Effect to fetch courses
  React.useEffect(() => {
    if (!courses || courses.length === 0) {
      dispatch(fetchCoursesWithAuth())
    }
  }, [dispatch, courses])

  // Handle adding a new course (this function should eventually trigger a dispatch to a redux action or a route change)
  const handleAddCourse = () => {
    console.log('Add Course Clicked')
    // Dispatch an action or route to a form to add a new course
  }

  return (
    <div className='p-6 bg-gray-50 h-full'>
      <div className='mb-6 flex justify-between items-center'>
        <h1 className='text-3xl font-bold text-gray-800'>All Courses</h1>
        <AdminCourseCreation />
      </div>
      {isLoading ? (
        <p className='text-center text-gray-500'>Loading...</p>
      ) : error ? (
        <p className='text-center text-red-500'>Error: {error}</p>
      ) : (
        <div className='bg-white shadow-lg rounded-lg p-6'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                >
                  Course Name
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                >
                  Description
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                >
                  Start Date
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                >
                  End Date
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                >
                  Modules
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {courses.map((course) => (
                <tr key={course.course_id}>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
                    {course.name}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {course.description}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {new Date(course.startDate).toLocaleDateString()}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {new Date(course.endDate).toLocaleDateString()}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {course.modules.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default CreateCourse
