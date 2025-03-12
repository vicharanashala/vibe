import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchUsers } from '@/store/slices/GetUsersSlice' // Ensure correct import path
import { useCourseEnrollMutation } from '@/store/apiService'

const EnrollStudents = () => {
  const dispatch = useDispatch()
  const { users, isLoading, error } = useSelector((state) => state.users)
  const [selectedUsers, setSelectedUsers] = useState([])
  const courses = useSelector((state) => state.courses.courses ?? [])
  const [courseEnroll] = useCourseEnrollMutation();
  const [selectedCourse, setSelectedCourse] = useState('')

  useEffect(() => {
    if (!users || users.length === 0) {
      console.log(
        'Users list is empty or undefined. Attempting to fetch users...'
      )
      dispatch(fetchUsers())
    }
  }, [dispatch, users])

  React.useEffect(() => {
      if (!courses || courses.length === 0) {
        dispatch(fetchCoursesWithAuth())
      }
    }, [dispatch, courses])

  const handleSelectUser = (userId) => {
    const isAlreadySelected = selectedUsers.includes(userId)
    if (isAlreadySelected) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId))
    } else {
      setSelectedUsers([...selectedUsers, userId])
    }
  }

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allUserIds = users.map((user) => user.firebase_id)
      setSelectedUsers(allUserIds)
    } else {
      setSelectedUsers([])
    }
  }

  const handleSelectedCourse = (courseId) => {
    console.log('Selected course ID:', courseId)
    setSelectedCourse(courseId)
  }
  
  const handleBulkEnroll = () => {
    console.log('Bulk enrolling users with IDs:', selectedUsers)
    const courseId = selectedCourse; // Replace with your actual course ID
    courseEnroll({
      courseId,
      studentIds: selectedUsers
    });
  }


  return (
    <div className='container mx-auto p-4'>
      <h2 className='text-2xl font-bold mb-4'>Enroll Students</h2>
      {isLoading ? (
        <p className='text-blue-500'>Loading...</p>
      ) : error ? (
        <p className='text-red-500'>Error: {error}</p>
      ) : (
        <div>
          <div>
            <div className='mb-4'>
              <label
                htmlFor='user-select'
                className='block text-gray-700 text-sm font-bold mb-2'
              >
                Select the course to enroll students:
              </label>
              <select
                id='user-select'
                className='shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                onChange={(e) => handleSelectedCourse(e.target.value)}
              >
                <option value=''>--Select a Course--</option>
                {courses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleBulkEnroll}
              className='mb-4 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-700'
              disabled={selectedUsers.length === 0}
            >
              Bulk Enroll
            </button>
          </div>
          <div className='overflow-x-auto'>
            <table className='min-w-full bg-white shadow-md rounded-lg overflow-hidden'>
              <thead className='bg-gray-800 text-white'>
                <tr>
                  <th className='py-2 px-4'>
                    <input
                      type='checkbox'
                      onChange={handleSelectAll}
                      checked={
                        selectedUsers.length === users.length &&
                        users.length > 0
                      }
                    />
                  </th>
                  <th className='py-2 px-4'>ID</th>
                  <th className='py-2 px-4'>Email</th>
                  <th className='py-2 px-4'>Role</th>
                </tr>
              </thead>
                <tbody>
                {users.map((user) => (
                  <tr key={user.firebase_id} className='border-b text-center'>
                    <td className='py-2 px-4'>
                    <input
                      type='checkbox'
                      checked={selectedUsers.includes(user.firebase_id)}
                      onChange={() => handleSelectUser(user.firebase_id)}
                    />
                    </td>
                    <td className='py-2 px-4'>{user.firebase_id}</td>
                    <td className='py-2 px-4'>{user.email}</td>
                    <td className='py-2 px-4'>{user.role}</td>
                  </tr>
                  ))}
                </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnrollStudents
